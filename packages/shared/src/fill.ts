import { z } from 'zod'
import { FieldKind, FormSchema } from './form.js'

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

// Defined in constants.ts (zod-free) so the content script can read it without pulling
// zod into a bundle that loads on every page. Re-exported here for callers that already
// import from this module.
export { REVIEW_CONFIDENCE_THRESHOLD } from './constants.js'

export const Fill = z.object({
  fieldId: z.string(),
  /**
   * The question this answers, carried on the fill itself.
   *
   * Without it a result is a list of opaque ids: the side panel reviews answers long after
   * the form schema is gone, and the page that owns the labels is a different context.
   */
  label: z.string().default(''),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  tier: FillTier,
  /** Short justification, shown on hover. Absent for tier 0 — a direct lookup needs none. */
  reasoning: z.string().optional(),
  /**
   * True when the answer comes from an inferred preference rather than a stated fact.
   *
   * Distinct from low confidence: the model can be quite sure about an inference. The UI
   * marks these so a judgement call made on the user's behalf is always visible before
   * they submit it.
   */
  inferred: z.boolean().default(false),
  /**
   * The choices the field offered, when it offered any.
   *
   * Carried so the review can show what was picked *out of what*. Without it a radio answer
   * and a free-text answer look identical in the panel, and there is no way to tell a wrong
   *choice from an unavailable one.
   */
  options: z.array(z.string()).default([]),
  /**
   * The widget this answers.
   *
   * Carried so a verdict from the review panel is routed the same way a submitted answer is:
   * a confirmed dropdown is a durable fact for the profile, a confirmed essay is voice for
   * memory. Without it the panel had to guess from whether options were present, and a
   * confirmation of a short paragraph was filed as a fact about the person.
   */
  kind: FieldKind.optional(),
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
  entries: z
    .array(
      z.object({
        label: z.string().max(400),
        /**
         * The widget this answer came from.
         *
         * Decides *where* the answer is stored, which is the difference between an answer that
         * comes back on the next form and one that does not. A constrained choice — a
         * dropdown, a radio, a multi-select — is a durable fact about this person and goes
         * into the profile, where it is read directly on every fill. Prose is voice and goes
         * to semantic memory, where it is retrieved against questions worded differently.
         *
         * Optional because the review panel reports single answers without a widget in hand;
         * length is the fallback signal there.
         */
        kind: FieldKind.optional(),
        /**
         * The surrounding section and any help text.
         *
         * Carried because the label alone is not enough to decide whether a field is about
         * *this* person: "Phone" under "Emergency contact", "Reference", or "Current employer"
         * is someone else's number, and learning it as the user's own would then autofill a
         * stranger's details onto every later form. The classifier needs the same haystack at
         * feedback time that it had at fill time.
         */
        section: z.string().max(200).optional(),
        hint: z.string().max(400).optional(),
        /** What we proposed. Absent if the user typed into a field we skipped. */
        proposed: z.string().max(4000).optional(),
        /** What the user actually kept. Capped: this can reach the cached prompt prefix. */
        accepted: z.string().max(4000),
        edited: z.boolean(),
        /**
         * The user affirmed an answer they were asked to check.
         *
         * Distinct from `edited`, and worth as much. An inference the model got right is
         * otherwise thrown away entirely — the next form re-derives it from scratch and may
         * land somewhere else — so confirming is what turns a judgement call into a fact.
         *
         * There is deliberately no "incorrect" counterpart. A rejection says an answer was
         * wrong without saying what is right, and storing that in the index the next answer
         * is retrieved from would degrade later answers rather than improve them.
         */
        confirmed: z.boolean().optional(),
      }),
    )
    // One form cannot teach more than this. Without a cap a single submit can write an
    // unbounded number of memories and identity values.
    .max(25),
})
export type FeedbackRequest = z.infer<typeof FeedbackRequest>
