import { ApiErrorResponse } from '@aff/shared'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { createMiddleware } from 'hono/factory'
import { quotaUsage } from '../db/schema.js'
import type { AppEnv } from '../env.js'
import { currentPeriod, periodResetsAt } from '../services/account.js'

/**
 * Sliding-window rate limit in KV.
 *
 * Separate from the monthly quota and checked first: quota is about how much a user may
 * spend in a month, this is about how fast. A bug or a script that hammers the endpoint
 * would otherwise burn a month's allowance — and our provider spend — in seconds.
 *
 * KV's native TTL does the expiry, so there is nothing to sweep.
 */
const WINDOW_SECONDS = 60
const MAX_REQUESTS_PER_WINDOW = 12

/**
 * A limiter over its own KV bucket.
 *
 * Separate buckets matter more than the numbers do. Learning now reports many times per form
 * where it used to report once at submit, and if those shared the fill bucket a person
 * correcting their own answers would lock themselves out of filling the rest of the page —
 * the product punishing exactly the behaviour it depends on.
 */
export function createRateLimit(opts: {
  bucket: string
  max: number
  windowSeconds?: number
  message?: string
}) {
  const windowSeconds = opts.windowSeconds ?? WINDOW_SECONDS

  return createMiddleware<AppEnv>(async (c, next) => {
    const userId = c.get('userId')
    const window = Math.floor(Date.now() / 1000 / windowSeconds)
    const key = `${opts.bucket}:${userId}:${window}`

    const current = Number((await c.env.RATE_LIMIT.get(key)) ?? '0')

    if (current >= opts.max) {
      throw new ApiErrorResponse(
        'RATE_LIMITED',
        opts.message ?? 'Too many requests. Try again shortly.',
        { retryAfter: windowSeconds },
      )
    }

    // Read-then-write is not atomic in KV, so a burst of concurrent requests can slip a
    // couple past the limit. Acceptable here: this bounds runaway loops, and the monthly
    // quota — which is transactional in D1 — is the real spend ceiling.
    await c.env.RATE_LIMIT.put(key, String(current + 1), {
      expirationTtl: windowSeconds * 2,
    })

    await next()
  })
}

/** Fills and rewrites. Key format unchanged, so no in-flight window is reset by this. */
export const rateLimit = createRateLimit({
  bucket: 'rl',
  max: MAX_REQUESTS_PER_WINDOW,
  message: 'Too many fill requests. Try again shortly.',
})

/**
 * Feedback. More generous than a fill, and its own bucket.
 *
 * This endpoint was the only unmetered write into Supermemory in the whole API — no rate
 * limit, no quota — which was survivable while it fired once per submitted form and is not now
 * that it fires whenever a field settles.
 */
export const feedbackRateLimit = createRateLimit({
  bucket: 'fb',
  max: 30,
  message: 'Too many updates at once. Your answers are safe, so try again shortly.',
})

/**
 * Monthly quota, enforced **before** any provider call.
 *
 * This is the load-bearing spend control: every free-tier request costs us real money, so
 * the decision to allow one is never delegated to the client.
 */
export const enforceQuota = createMiddleware<AppEnv>(async (c, next) => {
  const account = c.get('account')

  if (account.quota.used >= account.quota.limit) {
    throw new ApiErrorResponse(
      'QUOTA_EXCEEDED',
      `You've used all ${account.quota.limit} forms this month.`,
      {
        quota: {
          used: account.quota.used,
          limit: account.quota.limit,
          resetsAt: account.quota.resetsAt,
        },
      },
    )
  }

  await next()
})

/**
 * Increments the counter for the current period.
 *
 * Called *after* a successful fill rather than before, so a failed model call does not
 * consume a user's allowance. The trade is a small window where concurrent requests could
 * each pass the pre-check — bounded by the rate limiter above.
 */
export async function consumeQuota(env: AppEnv['Bindings'], userId: string): Promise<number> {
  const db = drizzle(env.DB)
  const period = currentPeriod()

  await db
    .insert(quotaUsage)
    .values({ userId, period, used: 1 })
    .onConflictDoUpdate({
      target: [quotaUsage.userId, quotaUsage.period],
      // Incremented in SQL so two concurrent requests cannot read the same value and both
      // write back the same +1.
      set: { used: sql`${quotaUsage.used} + 1` },
    })

  const rows = await db
    .select({ used: quotaUsage.used })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.userId, userId), eq(quotaUsage.period, period)))
    .limit(1)

  return rows[0]?.used ?? 1
}

export { periodResetsAt }

/**
 * How many *new* documents this user may still write today.
 *
 * The rate limit bounds requests; this bounds work, which is the thing that actually costs
 * money and dilutes an index. Counted after the same-answer check in `recordFeedback`, so
 * re-teaching an answer we already hold is free and only genuinely new knowledge counts
 * against the day.
 *
 * Being over budget is never surfaced as an error. Somebody who has just corrected an answer
 * has done nothing wrong and can do nothing about a ceiling, so the entry is dropped and
 * logged instead.
 */
const LEARNING_BUDGET_PER_DAY = 300

export async function learningBudget(
  env: AppEnv['Bindings'],
  userId: string,
  wanted: number,
): Promise<number> {
  if (wanted <= 0) return 0

  const day = new Date().toISOString().slice(0, 10)
  const key = `lb:${userId}:${day}`
  const used = Number((await env.RATE_LIMIT.get(key)) ?? '0')
  const allowed = Math.max(0, Math.min(wanted, LEARNING_BUDGET_PER_DAY - used))

  if (allowed > 0) {
    await env.RATE_LIMIT.put(key, String(used + allowed), { expirationTtl: 48 * 60 * 60 })
  }
  if (allowed < wanted) {
    console.debug('[aff] learning budget reached', { userId, wanted, allowed, used })
  }
  return allowed
}
