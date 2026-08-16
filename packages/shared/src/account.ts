import { z } from 'zod'

export const Plan = z.enum(['free', 'pro', 'ultra'])
export type Plan = z.infer<typeof Plan>

// Defined in constants.ts (zod-free). Sized from real `fill_log` data after phase 3.
export { PLAN_LIMITS } from './constants.js'

export const QuotaState = z.object({
  plan: Plan,
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
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
  /** Active subscription status, null for free-tier users. */
  subscription: z
    .object({
      plan: z.enum(['pro', 'ultra']),
      status: z.enum(['trial', 'active', 'on_hold', 'cancelled', 'expired']),
      currentPeriodEnd: z.number().int().nonnegative().optional(),
    })
    .nullish(),
})
export type Account = z.infer<typeof Account>
