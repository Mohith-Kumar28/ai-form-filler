import type { Fill, FillPlan, FillRequest, FillTier, Identity, Plan, Skip } from '@aff/shared'
import { ApiErrorResponse, hasAnswer, PLAN_SOLO_ESSAY_LIMITS } from '@aff/shared'
import { and, eq, sql } from 'drizzle-orm'
import { fillLog, profileDocs, profileSources } from '../db/schema.js'
import type { Env } from '../env.js'
import { generateFills } from '../llm/generate.js'
import { compileProfileDoc } from '../profile/compile.js'
import { classifyForm } from '../router/classify.js'
import { resolveTier0 } from '../router/tier0.js'
import type { Db } from './account.js'
import { readNegatives } from './learned-store.js'
import { emptyProfile, recompileProfile } from './profile.js'
import { gatherFillContext } from './retrieval.js'

export interface FillContext {
  db: Db
  userId: string
  /** Carries the AI Gateway endpoint and token. */
  env: Env
  plan: Plan
  /** AI actions left this period. Enforced here, not merely reported — see `affordable`. */
  quotaRemaining: number
  /** Long answers left this period. The tighter of the two ceilings on an essay-heavy form. */
  longRemaining: number
}

/** One field the router decided needs a model, and which tier should answer it. */
interface Unresolved {
  fieldId: string
  tier: FillTier
}

/**
 * Trims the work to what this month's remaining allowance can pay for.
 *
 * `quotaRemaining` used to be carried into `runFill` and echoed straight back out, so the only
 * enforcement anywhere was the all-or-nothing pre-flight check in `enforceQuota`. Somebody with
 * eight actions left meeting a forty-field application either got the whole form for eight actions
 * or a refusal — and it was the first of those.
 *
 * Fields are kept in **document order** rather than cheapest-first. Reordering would squeeze a few
 * more answers out of a nearly-empty allowance and cost the user the ability to see where the tool
 * stopped: a form answered down to question nineteen is legible, the same form with holes scattered
 * through it is not.
 *
 * Tier 0 passes through free. In practice `runFill` only ever hands this the unresolved set, so a
 * tier-0 classification never arrives — but the rule that a free lookup is not rationed belongs in
 * the function that does the rationing, not in an invariant of one caller.
 *
 * Extracted from `runFill` so it can be tested without a database, a profile document or a
 * provider — it is the part of a fill that decides what the user is charged for.
 */
export function budgetFills<T extends Unresolved>(
  unresolved: readonly T[],
  quotaRemaining: number,
  longRemaining: number,
): { affordable: T[]; unaffordable: Skip[] } {
  const affordable: T[] = []
  const unaffordable: Skip[] = []
  let actionBudget = Math.max(0, quotaRemaining)
  let longBudget = Math.max(0, longRemaining)

  for (const classification of unresolved) {
    // A lookup against the user's own saved information: no model call, no cost, never charged.
    if (classification.tier === 0) {
      affordable.push(classification)
      continue
    }

    const isLong = classification.tier === 3
    const outOfLong = isLong && longBudget <= 0

    if (actionBudget <= 0 || outOfLong) {
      unaffordable.push({
        fieldId: classification.fieldId,
        reason: 'quota_exhausted',
        // Distinguishes the two ways to run out, because they need different remedies: one waits
        // for the month, the other is specifically about essays and rewrites.
        ...(outOfLong && actionBudget > 0 ? { detail: 'long answer' } : {}),
      })
      continue
    }

    affordable.push(classification)
    actionBudget -= 1
    if (isLong) longBudget -= 1
  }

  return { affordable, unaffordable }
}

/**
 * Runs a form through the tier pipeline and produces a FillPlan.
 *
 * Tiers are executed in parallel because they are independent — a tier-1 dropdown does not
 * depend on a tier-3 essay. On a mixed form this makes the wall-clock roughly the slowest
 * single tier rather than the sum of all of them.
 */
export async function runFill(
  ctx: FillContext,
  request: FillRequest,
): Promise<{ plan: FillPlan; tierCounts: Record<FillTier, number>; models: string[] }> {
  const startedAt = Date.now()

  const docRows = await ctx.db
    .select({
      doc: profileDocs.doc,
      structured: profileDocs.structuredJson,
      tokens: profileDocs.estimatedTokens,
    })
    .from(profileDocs)
    .where(eq(profileDocs.userId, ctx.userId))
    .limit(1)

  const docRow = docRows[0]

  /**
   * Ready means "has a source", not "the identity block is non-empty".
   *
   * `PROFILE_DOC` now renders only identity and the user's own facts, so a voice note, an
   * image, or a PDF the extractor found no contact details in all compile to an empty
   * document. Those users have a fully indexed corpus in memory and were being told to add
   * a source they had already added — with no way to get past it.
   */
  const [{ count: sourceCount = 0 } = { count: 0 }] = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(profileSources)
    .where(and(eq(profileSources.userId, ctx.userId), eq(profileSources.status, 'ready')))

  if (!docRow || sourceCount === 0) {
    throw new ApiErrorResponse(
      'PROFILE_NOT_READY',
      'Add at least one source before filling a form.',
    )
  }

  /*
    `custom` is read here too, and it used not to be.

    The stored blob has always held both halves of the profile — `identity`, the twelve fixed
    slots, and `custom`, the facts the user typed under names they chose. This parsed out the
    first and dropped the second on the floor, so every typed fact was invisible to tier 0 and
    reached the model tiers only as prose inside `profileDoc`.

    The visible symptom was that the panel could fill an address field from a stored fact the
    instant you focused it, and the fill button could not fill the same field from the same
    fact. Two different code paths reading two different subsets of one profile row.
  */
  let structured: { identity: Identity; custom: Record<string, string> } = {
    identity: { links: {} },
    custom: {},
  }
  try {
    const parsed = JSON.parse(docRow.structured) as {
      identity?: Identity
      custom?: Record<string, string>
    }
    structured = { identity: parsed.identity ?? { links: {} }, custom: parsed.custom ?? {} }
  } catch {
    // A corrupt structured blob costs us tier-0 answers, not the whole request — the model
    // tiers can still read the same facts out of the profile document.
  }

  const identity = structured.identity

  /**
   * A stored document compiled by older code is rebuilt before it is used.
   *
   * `PROFILE_DOC` is written once and re-read on every fill, so a change to what the compiler
   * emits does not reach an existing profile until something else happens to trigger a
   * recompile — a profile edit, a new source. When learned answers were removed from the
   * document, every profile already in the database kept shipping them in every prompt, which
   * is the exact cost this was meant to remove, and nothing anywhere would have said so.
   *
   * Compiling is a pure string build plus one hash over data already loaded, so checking costs
   * nothing measurable. `recompileProfile` no-ops when the bytes match, so the write only
   * happens on a genuine change — and this now self-heals for any future compiler change
   * rather than needing a backfill script per release.
   */
  const compiled = await compileProfileDoc({ ...emptyProfile(), ...structured, sources: [] })
  let profileDoc = docRow.doc

  if (compiled.doc !== docRow.doc) {
    await recompileProfile(ctx.db, ctx.userId)
    profileDoc = compiled.doc
    console.debug('[aff] profile document rebuilt by a newer compiler', {
      wasTokens: docRow.tokens,
      nowTokens: compiled.estimatedTokens,
    })
  }

  // Fields the user has already answered are left alone unless explicitly asked otherwise.
  // `hasAnswer`, not `currentValue`: a phone widget's `+91` is the page talking, not the user.
  const candidates = request.overwriteExisting
    ? request.form.fields
    : request.form.fields.filter((f) => !hasAnswer(f))

  const alreadyFilled: Skip[] = request.overwriteExisting
    ? []
    : request.form.fields
        .filter((f) => hasAnswer(f))
        .map((f) => ({ fieldId: f.id, reason: 'already_filled' as const }))

  if (candidates.length === 0) {
    return {
      plan: {
        fills: [],
        skipped: alreadyFilled,
        usage: emptyUsage(Date.now() - startedAt),
        quotaRemaining: ctx.quotaRemaining,
      },
      tierCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
      models: [],
    }
  }

  const { classifications, counts } = classifyForm(candidates)
  const byId = new Map(candidates.map((f) => [f.id, f]))
  const tier0 = resolveTier0(identity, classifications, byId, structured.custom)

  const { affordable, unaffordable } = budgetFills(
    tier0.unresolved,
    ctx.quotaRemaining,
    ctx.longRemaining,
  )

  if (unaffordable.length > 0) {
    console.debug('[aff] fill trimmed to allowance', {
      wanted: tier0.unresolved.length,
      afforded: affordable.length,
      quotaRemaining: ctx.quotaRemaining,
      longRemaining: ctx.longRemaining,
    })
  }

  const batches: { tier: Exclude<FillTier, 0>; fieldIds: string[] }[] = []

  for (const tier of [1, 2] as const) {
    const fieldIds = affordable.filter((c) => c.tier === tier).map((c) => c.fieldId)
    if (fieldIds.length > 0) batches.push({ tier, fieldIds })
  }

  /**
   * Essays get a call each; everything else is batched.
   *
   * A constrained choice and a short text answer do not compete for attention — the model picks
   * an option and moves on, and batching them is what keeps a 20-field form to a couple of
   * calls. An essay is the opposite: it wants the whole context window pointed at one question,
   * and sharing a call with four other essays measurably flattens all five into the same
   * paragraph shape.
   *
   * Bounded, because tier 3 is the frontier model and a page of thirty textareas would
   * otherwise be thirty frontier calls on our own key. Past the cap the remainder is batched —
   * degraded, but not a surprise invoice.
   *
   * The bound is per plan, and it is the one gate where paying buys a *better* answer rather than
   * more of the same. That follows from the paragraph above: batching is measurably worse writing,
   * so a higher ceiling is a real difference and it costs us exactly what it is worth. It is not a
   * capability withheld to create a reason to upgrade.
   */
  const maxSoloEssays = PLAN_SOLO_ESSAY_LIMITS[ctx.plan]
  const essays = affordable.filter((c) => c.tier === 3).map((c) => c.fieldId)

  for (const fieldId of essays.slice(0, maxSoloEssays)) {
    batches.push({ tier: 3, fieldIds: [fieldId] })
  }
  const overflow = essays.slice(maxSoloEssays)
  if (overflow.length > 0) {
    console.debug('[aff] essay batch overflow', { solo: maxSoloEssays, batched: overflow.length })
    batches.push({ tier: 3, fieldIds: overflow })
  }

  /**
   * One search per question, all of them concurrent.
   *
   * This used to be a single search whose query was every field label concatenated — the wrong
   * shape for an embedding index, which then returned six passages near the average of the form
   * and specific to nothing. See `gatherFillContext`.
   *
   * Gathered here rather than inside each batch so a question searched once is not searched
   * again by the tier that happens to own it.
   */
  const unresolvedQuestions = affordable.map((c) => ({
    fieldId: c.fieldId,
    question: byId.get(c.fieldId)?.label ?? '',
  }))

  /**
   * Passages and rejections together, in one round of concurrency.
   *
   * Both are keyed by the same questions and neither depends on the other, so waiting for one
   * before starting the other would add a round trip to every fill for no reason.
   *
   * Only the fields we are actually going to answer are asked about, which is the point rather
   * than an optimisation: a value the user typed into their own profile is answered by tier 0 with
   * no model call, and something they once cleared on somebody else's form must never override it.
   * Their own stated fact wins. Fields trimmed for want of allowance are excluded for the duller
   * reason that searching for an answer we will not write is a request we pay for and discard.
   */
  const [context, avoid] = await Promise.all([
    batches.length > 0
      ? gatherFillContext({
          env: ctx.env,
          userId: ctx.userId,
          questions: unresolvedQuestions,
        })
      : Promise.resolve({ byField: new Map() }),
    batches.length > 0
      ? readNegatives(
          ctx.db,
          ctx.userId,
          unresolvedQuestions.map((entry) => ({
            ...entry,
            section: byId.get(entry.fieldId)?.section,
            origin: request.form.origin,
          })),
        )
      : Promise.resolve(new Map<string, string[]>()),
  ])

  const results = await Promise.all(
    batches.map(async (batch) => {
      const fields = batch.fieldIds
        .map((id) => byId.get(id))
        .filter((f): f is NonNullable<typeof f> => f !== undefined)

      return generateFills({
        tier: batch.tier,
        profileDoc,
        env: ctx.env,
        userId: ctx.userId,
        fields,
        classifications,
        origin: request.form.origin,
        pageContext: request.form.pageContext,
        retrieved: context.byField,
        avoid,
      })
    }),
  )

  /**
   * Every fill carries the kind of field it answered.
   *
   * Stamped in one place rather than in each producer: tier 0 and the recall step see
   * classifications, and the generators see their own batch, so each would have had to be
   * handed the schema separately and any new producer would have quietly omitted it. The
   * review panel needs it to route a confirmation to the right store.
   */
  const fills: Fill[] = [...tier0.fills, ...results.flatMap((r) => r.fills)].map((fill) => {
    const kind = byId.get(fill.fieldId)?.kind
    return kind ? { ...fill, kind } : fill
  })
  const skipped: Skip[] = [
    ...alreadyFilled,
    ...tier0.skipped,
    ...unaffordable,
    ...results.flatMap((r) => r.skipped),
  ]

  const usage = results.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.usage.inputTokens,
      outputTokens: acc.outputTokens + r.usage.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + r.usage.cacheReadTokens,
      cacheWriteTokens: acc.cacheWriteTokens + r.usage.cacheWriteTokens,
      costMicroUsd: acc.costMicroUsd + r.costMicroUsd,
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costMicroUsd: 0 },
  )

  return {
    plan: {
      fills,
      skipped,
      usage: {
        ...usage,
        latencyMs: Date.now() - startedAt,
        modelsUsed: results.map((r) => r.model),
      },
      quotaRemaining: ctx.quotaRemaining,
    },
    tierCounts: counts,
    models: results.map((r) => r.model),
  }
}

function emptyUsage(latencyMs: number) {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicroUsd: 0,
    latencyMs,
    modelsUsed: [],
  }
}

/**
 * One row per request. This table is how we find out whether the free tier is affordable —
 * written on every fill, including zero-cost ones, so the denominator is honest.
 */
export async function writeFillLog(
  db: Db,
  userId: string,
  request: FillRequest,
  plan: FillPlan,
  tierCounts: Record<FillTier, number>,
): Promise<void> {
  await db.insert(fillLog).values({
    id: `fl_${crypto.randomUUID()}`,
    userId,
    origin: request.form.origin,
    adapter: request.form.adapter,
    fieldCount: request.form.fields.length,
    tier0Count: tierCounts[0],
    tier1Count: tierCounts[1],
    tier2Count: tierCounts[2],
    tier3Count: tierCounts[3],
    inputTokens: plan.usage.inputTokens,
    outputTokens: plan.usage.outputTokens,
    cacheReadTokens: plan.usage.cacheReadTokens,
    cacheWriteTokens: plan.usage.cacheWriteTokens,
    costMicroUsd: plan.usage.costMicroUsd,
    latencyMs: plan.usage.latencyMs,
    models: plan.usage.modelsUsed.join(','),
    createdAt: Date.now(),
  })
}

/**
 * One row for one rewrite.
 *
 * Rewrites were the only inference path that wrote nothing here, so `scripts/costs.mjs` — the
 * report whose whole purpose is deciding whether a plan is affordable — could not see the most
 * expensive request the product makes. `adapter` is the sentinel `'rewrite'` so these rows are
 * separable from form fills without a schema change.
 */
export async function writeRewriteLog(
  db: Db,
  userId: string,
  input: {
    origin: string
    usage: { inputTokens: number; outputTokens: number }
    costMicroUsd: number
    latencyMs: number
    model: string
  },
): Promise<void> {
  await db.insert(fillLog).values({
    id: `fl_${crypto.randomUUID()}`,
    userId,
    origin: input.origin,
    adapter: 'rewrite',
    fieldCount: 1,
    tier0Count: 0,
    tier1Count: 0,
    tier2Count: 0,
    tier3Count: 1,
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicroUsd: input.costMicroUsd,
    latencyMs: input.latencyMs,
    models: input.model,
    createdAt: Date.now(),
  })
}
