import { z } from 'zod'

export const Plan = z.enum(['free', 'pro'])
export type Plan = z.infer<typeof Plan>

/** Forms per calendar month. Sized from real `fill_log` data after phase 3, not from guesses. */
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 50,
  pro: 2000,
}

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
})
export type Account = z.infer<typeof Account>
