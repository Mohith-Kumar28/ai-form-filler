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

/**
 * What an account deletion actually removed.
 *
 * Lives here rather than beside the route because three surfaces need the same shape: the
 * Worker returns it, the service worker relays it over `chrome.runtime.sendMessage`, and the
 * panel renders it. It is reported at all because "your account has been deleted" is a claim the
 * user has no way to verify — naming the counts is the difference between a promise and a
 * receipt, and it is the only receipt they will ever get, since the account that could show
 * them anything else is gone.
 */
export const DeletionReport = z.object({
  /** Memory documents removed: profile sources, plus every answer the product was taught. */
  documents: z.number().int().nonnegative(),
  /** Original uploaded files removed from storage. */
  files: z.number().int().nonnegative(),
  /**
   * Whether anything can still be charged. Three states, and only three, because that is the whole
   * of what a departing user needs:
   *
   *   - `none` — there was never a subscription. The panel says nothing about billing at all.
   *   - `cancelled` — nothing more will be charged. Covers both a subscription we cancelled just
   *     now and one that was already over; the difference is ours, not theirs.
   *   - `pending` — we could not reach Dodo, so finishing the cancellation is on us. The deletion
   *     went ahead regardless: a billing failure is not a reason to keep somebody's data.
   *
   * Note what is absent: any version of "cancel it yourself first". An earlier cut made a failed
   * cancellation into a blocking error with instructions to go and use the billing portal, which
   * is the product making its own integration problem into the user's errand.
   */
  subscription: z.enum(['none', 'cancelled', 'pending']),
})
export type DeletionReport = z.infer<typeof DeletionReport>
