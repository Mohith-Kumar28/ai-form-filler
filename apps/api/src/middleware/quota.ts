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

export const rateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.get('userId')
  const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS)
  const key = `rl:${userId}:${window}`

  const current = Number((await c.env.RATE_LIMIT.get(key)) ?? '0')

  if (current >= MAX_REQUESTS_PER_WINDOW) {
    throw new ApiErrorResponse('RATE_LIMITED', 'Too many fill requests. Try again shortly.', {
      retryAfter: WINDOW_SECONDS,
    })
  }

  // Read-then-write is not atomic in KV, so a burst of concurrent requests can slip a
  // couple past the limit. Acceptable here: this bounds runaway loops, and the monthly
  // quota — which is transactional in D1 — is the real spend ceiling.
  await c.env.RATE_LIMIT.put(key, String(current + 1), {
    expirationTtl: WINDOW_SECONDS * 2,
  })

  await next()
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
