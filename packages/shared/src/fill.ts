import { z } from 'zod'
import { FormSchema } from './form.js'

/**
 * Which handler produced a value. Set server-side by the router; surfaced in the UI so
 * the user can see what a fill cost them, and logged for cost analysis.
 *
 *   0 — deterministic lookup, no model call
 *   1 — cheap model, constrained choice
 *   2 — cheap model, short free text
 *   3 — frontier model, long-form with retrieved answer-bank context
 */
export const FillTier = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
export type FillTier = z.infer<typeof FillTier>

/** Below this, the UI marks a fill amber and asks the user to review before submitting. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7

export const Fill = z.object({
  fieldId: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  tier: FillTier,
  /** Short justification, shown on hover. Absent for tier 0 — a direct lookup needs none. */
  reasoning: z.string().optional(),
})
export type Fill = z.infer<typeof Fill>

/** A field we deliberately left alone, and why. Rendered in the review panel. */
export const Skip = z.object({
  fieldId: z.string(),
  reason: z.enum([
    'no_matching_knowledge',
    'already_filled',
    'unsupported_kind',
    'quota_exhausted',
    'model_error',
  ]),
  detail: z.string().optional(),
})
export type Skip = z.infer<typeof Skip>

/** Per-request accounting. `cacheReadTokens` is the canary — see the caching test. */
export const FillUsage = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  /** Micro-dollars (1e-6 USD) so this stays an integer all the way into D1. */
  costMicroUsd: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  modelsUsed: z.array(z.string()),
})
export type FillUsage = z.infer<typeof FillUsage>

export const FillPlan = z.object({
  fills: z.array(Fill),
  skipped: z.array(Skip),
  usage: FillUsage,
  quotaRemaining: z.number().int().nonnegative(),
})
export type FillPlan = z.infer<typeof FillPlan>

export const FillRequest = z.object({
  form: FormSchema,
  /**
   * User-facing quality slider. `auto` runs the tier router; `high` force-escalates every
   * generative field to tier 3. Deterministic fields stay tier 0 either way — there is no
   * quality gain from asking a model what your own email address is.
   */
  quality: z.enum(['auto', 'high']).default('auto'),
  /** Refill fields that already have a value. */
  overwriteExisting: z.boolean().default(false),
})
export type FillRequest = z.infer<typeof FillRequest>

/**
 * What the user actually submitted, after any edits. Accepted values feed the answer bank,
 * so edits are the highest-signal training data we get — an edited value means the model
 * was wrong in a way the user cared enough to fix.
 */
export const FeedbackRequest = z.object({
  origin: z.string().url(),
  entries: z.array(
    z.object({
      label: z.string(),
      /** What we proposed. Absent if the user typed into a field we skipped. */
      proposed: z.string().optional(),
      /** What the user actually kept. */
      accepted: z.string(),
      edited: z.boolean(),
    }),
  ),
})
export type FeedbackRequest = z.infer<typeof FeedbackRequest>
