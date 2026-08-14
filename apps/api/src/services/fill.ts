import type { Fill, FillPlan, FillRequest, FillTier, Identity, Skip } from '@aff/shared'
import { ApiErrorResponse } from '@aff/shared'
import { and, eq, sql } from 'drizzle-orm'
import { fillLog, profileDocs, profileSources } from '../db/schema.js'
import type { Env } from '../env.js'
import { generateFills } from '../llm/generate.js'
import { compileProfileDoc } from '../profile/compile.js'
import { classifyForm } from '../router/classify.js'
import { resolveTier0 } from '../router/tier0.js'
import type { Db } from './account.js'
import { emptyProfile, recompileProfile } from './profile.js'
import { gatherFillContext } from './retrieval.js'

export interface FillContext {
  db: Db
  userId: string
  /** Carries the AI Gateway endpoint and token. */
  env: Env
  quotaRemaining: number
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

  let structured: { identity: Identity } = { identity: { links: {} } }
  try {
    const parsed = JSON.parse(docRow.structured) as { identity?: Identity }
    structured = { identity: parsed.identity ?? { links: {} } }
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

  // Fields the user has already filled are left alone unless explicitly asked otherwise.
  const candidates = request.overwriteExisting
    ? request.form.fields
    : request.form.fields.filter((f) => !f.currentValue)

  const alreadyFilled: Skip[] = request.overwriteExisting
    ? []
    : request.form.fields
        .filter((f) => f.currentValue)
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
  const labels = new Map(candidates.map((f) => [f.id, f.label]))
  const tier0 = resolveTier0(identity, classifications, labels)

  const byId = new Map(candidates.map((f) => [f.id, f]))

  const batches: { tier: Exclude<FillTier, 0>; fieldIds: string[] }[] = []

  for (const tier of [1, 2] as const) {
    const fieldIds = tier0.unresolved.filter((c) => c.tier === tier).map((c) => c.fieldId)
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
   */
  const MAX_SOLO_ESSAYS = 6
  const essays = tier0.unresolved.filter((c) => c.tier === 3).map((c) => c.fieldId)

  for (const fieldId of essays.slice(0, MAX_SOLO_ESSAYS)) {
    batches.push({ tier: 3, fieldIds: [fieldId] })
  }
  const overflow = essays.slice(MAX_SOLO_ESSAYS)
  if (overflow.length > 0) {
    console.debug('[aff] essay batch overflow', { solo: MAX_SOLO_ESSAYS, batched: overflow.length })
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
  const context =
    batches.length > 0
      ? await gatherFillContext({
          env: ctx.env,
          userId: ctx.userId,
          questions: tier0.unresolved.map((c) => ({
            fieldId: c.fieldId,
            question: labels.get(c.fieldId) ?? '',
          })),
        })
      : { byField: new Map() }

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
  const skipped: Skip[] = [...alreadyFilled, ...tier0.skipped, ...results.flatMap((r) => r.skipped)]

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
