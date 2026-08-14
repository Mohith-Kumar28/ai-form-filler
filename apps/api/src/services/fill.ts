import type { Fill, FillPlan, FillRequest, FillTier, Identity, Skip } from '@aff/shared'
import { ApiErrorResponse } from '@aff/shared'
import { eq } from 'drizzle-orm'
import { fillLog, profileDocs } from '../db/schema.js'
import type { Env } from '../env.js'
import { generateFills } from '../llm/generate.js'
import { classifyForm } from '../router/classify.js'
import { resolveTier0 } from '../router/tier0.js'
import type { Db } from './account.js'
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
  if (!docRow || docRow.tokens === 0) {
    throw new ApiErrorResponse(
      'PROFILE_NOT_READY',
      'Add at least one source before filling a form.',
    )
  }

  let identity: Identity = { links: {} }
  try {
    identity = (JSON.parse(docRow.structured) as { identity?: Identity }).identity ?? {
      links: {},
    }
  } catch {
    // A corrupt structured blob costs us tier-0 answers, not the whole request — the model
    // tiers can still read the same facts out of the profile document.
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

  const { classifications, counts } = classifyForm(candidates, request.quality)
  const labels = new Map(candidates.map((f) => [f.id, f.label]))
  const tier0 = resolveTier0(identity, classifications, labels)

  const byId = new Map(candidates.map((f) => [f.id, f]))
  const batches: { tier: Exclude<FillTier, 0>; fieldIds: string[] }[] = []

  for (const tier of [1, 2, 3] as const) {
    const fieldIds = tier0.unresolved.filter((c) => c.tier === tier).map((c) => c.fieldId)
    if (fieldIds.length > 0) batches.push({ tier, fieldIds })
  }

  /**
   * One retrieval for the whole form, shared by every tier.
   *
   * It used to run for tier 3 only, because the profile document carried everything else
   * inline. It no longer does — history, projects, opinions, and the user's past answers all
   * live in memory now — so a tier-1 question like "which of these do you use?" needs
   * retrieval just as much as an essay does.
   *
   * Gathered once rather than per batch: the batches are three slices of the same form about
   * the same person, so three searches would return heavily overlapping passages and pay
   * three round trips for it.
   */
  const context =
    batches.length > 0
      ? await gatherFillContext({
          env: ctx.env,
          userId: ctx.userId,
          questions: tier0.unresolved
            .map((c) => labels.get(c.fieldId) ?? '')
            .filter((label) => label !== ''),
        })
      : { sourceChunks: [] }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const fields = batch.fieldIds
        .map((id) => byId.get(id))
        .filter((f): f is NonNullable<typeof f> => f !== undefined)

      return generateFills({
        tier: batch.tier,
        profileDoc: docRow.doc,
        env: ctx.env,
        userId: ctx.userId,
        fields,
        classifications,
        origin: request.form.origin,
        pageContext: request.form.pageContext,
        sourceChunks: context.sourceChunks,
      })
    }),
  )

  const fills: Fill[] = [...tier0.fills, ...results.flatMap((r) => r.fills)]
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
