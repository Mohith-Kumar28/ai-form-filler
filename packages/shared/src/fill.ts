import { z } from 'zod'
import { LEARN_MAX_OPTIONS } from './constants.js'
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
  /**
   * What the caller is asking for, which decides whether this spends quota.
   *
   * This is about *what to detect*, not what to charge. It used to carry a billing meaning too:
   * the allowance was denominated in whole forms, so a field-scoped fill had to be exempted
   * entirely — spending one of fifty forms on a single input would have taught people not to use
   * the feature. The allowance is now denominated in answers, so a field costs a field and the
   * exemption is gone.
   *
   * Defaulted rather than required so an older extension build keeps working against a newer
   * Worker.
   */
  scope: z.enum(['form', 'field']).default('form'),
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
        /**
         * The choices this answer was picked out of.
         *
         * A choice recorded without its option set is close to unusable later: "10" means
         * nothing on its own, while "10, chosen from 1-10" is a fact about the person. The
         * question alone does not recover it either — plenty of forms ask "How would you rate
         * it?" without saying out of what.
         *
         * **Labels, not values.** An option's `value` is a page-local token (`opt_3`,
         * Google's generated data-values) and carries no meaning on the next site; the label
         * is the words the user actually saw and chose.
         *
         * Omitted entirely above `LEARN_MAX_OPTIONS`. A 200-country dropdown's option set is
         * payload rather than information, and it would reach a prompt.
         */
        options: z.array(z.string().max(120)).max(LEARN_MAX_OPTIONS).optional(),
        /** What we proposed. Absent if the user typed into a field we skipped. */
        proposed: z.string().max(4000).optional(),
        /**
         * What the user actually kept. Capped: this can reach the cached prompt prefix.
         *
         * Empty **only** when `rejected` is true. The server used to drop every blank
         * `accepted` on arrival, which is what made a cleared answer teach nothing.
         */
        accepted: z.string().max(4000),
        edited: z.boolean(),
        /**
         * The user affirmed an answer they were asked to check.
         *
         * Distinct from `edited`, and worth as much. An inference the model got right is
         * otherwise thrown away entirely — the next form re-derives it from scratch and may
         * land somewhere else — so confirming is what turns a judgement call into a fact.
         *
         * Distinct from `rejected`, which is the other half of the same idea.
         */
        confirmed: z.boolean().optional(),
        /**
         * The user rejected what we proposed and put nothing in its place.
         *
         * There was deliberately no counterpart to `confirmed` for a long time, and the
         * reasoning was sound as far as it went: a rejection says an answer was wrong without
         * saying what is right, and storing that in the index the next answer is *retrieved*
         * from degrades later answers rather than improving them.
         *
         * The mistake was concluding that the signal itself was worthless. Clearing an answer
         * is the second-strongest thing the user ever tells us, and throwing it away means the
         * next form confidently offers the same wrong answer again. So it is carried — and it
         * is stored somewhere retrieval cannot reach, as a short per-question "not this" list
         * rather than as a passage. No document is ever written for it.
         *
         * When true, `accepted` is empty and `proposed` is what was rejected.
         */
        rejected: z.boolean().optional(),
        /**
         * Which capture produced this.
         *
         * Recorded so the volume of per-edit learning can be told apart from submit-time
         * learning in the logs. It never affects where or whether an answer is stored — if it
         * ever starts to, the two paths have diverged and that is the bug.
         */
        trigger: z.enum(['settle', 'submit', 'review']).optional(),
      }),
    )
    // One form cannot teach more than this. Without a cap a single submit can write an
    // unbounded number of memories and identity values.
    .max(25),
})
export type FeedbackRequest = z.infer<typeof FeedbackRequest>
