import { ApiErrorResponse, PLAN_LEARNING_BUDGETS, type Plan } from '@aff/shared'
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
 * Monthly allowance, enforced **before** any provider call.
 *
 * This is the load-bearing spend control: every request costs us real money, so the decision to
 * allow one is never delegated to the client.
 *
 * It is also the paywall. An account with no subscription has a limit of 0 and fails here on its
 * very first attempt, which is exactly the moment the panel offers the trial — after the person has
 * already added their résumé and their facts, and not before.
 *
 * Note what this does *not* do: it does not refuse a request merely because the allowance is too
 * small for the whole form. `runFill` fills what it can afford and reports the rest as skipped, so
 * running low degrades a fill instead of blocking it.
 */
export const enforceQuota = createMiddleware<AppEnv>(async (c, next) => {
  const { quota } = c.get('account')

  if (quota.used >= quota.limit) {
    throw new ApiErrorResponse(
      'QUOTA_EXCEEDED',
      quota.limit === 0
        ? // Deliberately not "to fill this form": this middleware also guards `/fill/improve`,
          // where the user is rewriting one answer rather than filling anything.
          'Start your free trial to let it answer this.'
        : `You've used all ${quota.limit} AI actions this month.`,
      {
        quota: { used: quota.used, limit: quota.limit, resetsAt: quota.resetsAt },
      },
    )
  }

  await next()
})

/**
 * The long-answer sub-meter, for requests that can *only* produce a long answer.
 *
 * A form fill does not use this — it degrades instead, batching or skipping essays it cannot
 * afford. A rewrite has nothing to degrade to: it is one frontier call on one field, so if the
 * long-answer allowance is gone the honest answer is no.
 */
export const enforceLongformQuota = createMiddleware<AppEnv>(async (c, next) => {
  const { quota } = c.get('account')

  if (quota.longUsed >= quota.longLimit) {
    throw new ApiErrorResponse(
      'QUOTA_EXCEEDED',
      quota.longLimit === 0
        ? 'Start your free trial to rewrite answers.'
        : `You've used all ${quota.longLimit} long answers and rewrites this month.`,
      {
        quota: { used: quota.used, limit: quota.limit, resetsAt: quota.resetsAt },
      },
    )
  }

  await next()
})

/**
 * Spends `actions` from the current period, of which `longActions` were long answers.
 *
 * Called *after* successful work rather than before, so a failed model call does not consume a
 * user's allowance. The trade is a small window where concurrent requests could each pass the
 * pre-check — bounded by the rate limiter above.
 *
 * It used to take no amount at all and always add one, because the unit was a whole form. Charging
 * per action is the entire point of the change: a thirty-field application and a three-field
 * signup no longer cost the same, and a rewrite is no longer free.
 */
export async function consumeQuota(
  env: AppEnv['Bindings'],
  userId: string,
  actions: number,
  longActions = 0,
): Promise<number> {
  if (actions <= 0) {
    const rows = await readUsage(env, userId)
    return rows?.used ?? 0
  }

  const db = drizzle(env.DB)
  const period = currentPeriod()

  await db
    .insert(quotaUsage)
    .values({ userId, period, used: actions, longUsed: longActions })
    .onConflictDoUpdate({
      target: [quotaUsage.userId, quotaUsage.period],
      // Incremented in SQL so two concurrent requests cannot read the same value and both
      // write back the same total.
      set: {
        used: sql`${quotaUsage.used} + ${actions}`,
        longUsed: sql`${quotaUsage.longUsed} + ${longActions}`,
      },
    })

  const row = await readUsage(env, userId)
  return row?.used ?? actions
}

async function readUsage(env: AppEnv['Bindings'], userId: string) {
  const db = drizzle(env.DB)
  const period = currentPeriod()
  const rows = await db
    .select({ used: quotaUsage.used, longUsed: quotaUsage.longUsed })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.userId, userId), eq(quotaUsage.period, period)))
    .limit(1)
  return rows[0]
}

export { periodResetsAt }

/**
 * How many *new* documents this user may still write today.
 *
 * Per plan, because how fast the product learns to write like you is the thing that compounds, and
 * therefore a real difference between tiers rather than an invented one. It was a single number for
 * everyone. A plan with no subscription gets nothing, which costs the onboarding user nothing:
 * learning only happens while filling, and filling is what the trial buys.
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
export async function learningBudget(
  env: AppEnv['Bindings'],
  userId: string,
  plan: Plan,
  wanted: number,
): Promise<number> {
  if (wanted <= 0) return 0

  const perDay = PLAN_LEARNING_BUDGETS[plan]
  if (perDay <= 0) return 0

  const day = new Date().toISOString().slice(0, 10)
  const key = `lb:${userId}:${day}`
  const used = Number((await env.RATE_LIMIT.get(key)) ?? '0')
  const allowed = Math.max(0, Math.min(wanted, perDay - used))

  if (allowed > 0) {
    await env.RATE_LIMIT.put(key, String(used + allowed), { expirationTtl: 48 * 60 * 60 })
  }
  if (allowed < wanted) {
    console.debug('[aff] learning budget reached', { userId, wanted, allowed, used })
  }
  return allowed
}
