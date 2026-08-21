import { z } from 'zod'

export const Plan = z.enum(['free', 'pro', 'ultra'])
export type Plan = z.infer<typeof Plan>

// Defined in constants.ts (zod-free). Sized from real `fill_log` cost data — see the comments there.
export { PLAN_LIMITS, PLAN_LONGFORM_LIMITS } from './constants.js'

export const QuotaState = z.object({
  plan: Plan,
  /**
   * AI actions spent this period: one answered field, one rewrite, or one source ingested.
   * Tier 0 — a lookup with no model call — is never counted. Shown to the user as form fields.
   */
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  /**
   * The long-answer sub-meter.
   *
   * Carried separately rather than folded into `used` because the two are not interchangeable: a
   * long answer costs us about a hundred times a short one, and a user can have plenty of actions
   * left while having run out of essays. Required rather than optional so no surface has to branch
   * on whether the server bothered to send it.
   */
  longUsed: z.number().int().nonnegative(),
  longLimit: z.number().int().nonnegative(),
  /** ISO timestamp of the next monthly reset. */
  resetsAt: z.string().datetime(),
})
export type QuotaState = z.infer<typeof QuotaState>

export const Account = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  quota: QuotaState,
  /** False until at least one source has parsed — gates the fill button in the UI. */
  profileReady: z.boolean(),
  profileVersion: z.number().int().nonnegative(),
  /**
   * The subscription, or null for an account that has never had one.
   *
   * `pending` and `failed` are Dodo's own states and were missing here: a mandate that never
   * completed left the account looking subscribed. That mattered little when there was a free tier
   * underneath and matters a great deal now that there is not.
   */
  subscription: z
    .object({
      plan: z.enum(['pro', 'ultra']),
      status: z.enum(['pending', 'trial', 'active', 'on_hold', 'cancelled', 'failed', 'expired']),
      currentPeriodEnd: z.number().int().nonnegative().optional(),
      /**
       * When the trial converts to a charge.
       *
       * Ours, not Dodo's. Dodo reports a trialing subscription as plain `active` and documents no
       * field that distinguishes one — the suggested workaround is listing payments and looking for
       * a single zero-amount row. So the date is recorded when the trial checkout is created and
       * trusted from there.
       */
      trialEndsAt: z.number().int().nonnegative().optional(),
    })
    .nullish(),
})
export type Account = z.infer<typeof Account>
