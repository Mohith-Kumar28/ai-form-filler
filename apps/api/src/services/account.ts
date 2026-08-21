import {
  type Account,
  PLAN_LIMITS,
  PLAN_LONGFORM_LIMITS,
  type Plan,
  type QuotaState,
} from '@aff/shared'
import { and, eq, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { GoogleIdentity } from '../auth/google.js'
import { profileDocs, profileSources, quotaUsage, subscriptions, users } from '../db/schema.js'

export type Db = DrizzleD1Database<Record<string, never>>

/** Quota period key, e.g. `2026-08`. UTC so the reset is unambiguous across time zones. */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Midnight UTC on the first of next month. */
export function periodResetsAt(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

export async function getOrCreateUser(db: Db, identity: GoogleIdentity): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleSub, identity.sub))
    .limit(1)

  const found = existing[0]
  if (found) {
    // Name and avatar drift as people update their Google account; keep them fresh.
    await db
      .update(users)
      .set({
        email: identity.email,
        name: identity.name ?? null,
        avatarUrl: identity.avatarUrl ?? null,
      })
      .where(eq(users.id, found.id))
    return found.id
  }

  const id = `u_${crypto.randomUUID()}`
  await db.insert(users).values({
    id,
    googleSub: identity.sub,
    email: identity.email,
    name: identity.name ?? null,
    avatarUrl: identity.avatarUrl ?? null,
    plan: 'free',
    createdAt: Date.now(),
  })
  return id
}

export async function loadQuota(db: Db, userId: string, plan: Plan): Promise<QuotaState> {
  const period = currentPeriod()
  const rows = await db
    .select({ used: quotaUsage.used, longUsed: quotaUsage.longUsed })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.userId, userId), eq(quotaUsage.period, period)))
    .limit(1)

  const row = rows[0]
  return {
    plan,
    used: row?.used ?? 0,
    limit: PLAN_LIMITS[plan],
    longUsed: row?.longUsed ?? 0,
    longLimit: PLAN_LONGFORM_LIMITS[plan],
    resetsAt: periodResetsAt(),
  }
}

/** How long after a failed renewal an account keeps working, in seconds. Mirrors Dodo's retries. */
const ON_HOLD_GRACE_S = 3 * 24 * 60 * 60

/**
 * How long past a trial's end we keep trusting it.
 *
 * Dodo charges automatically when a trial ends and sends `subscription.renewed`, which flips the
 * row to `active`. If that never arrives the mandate failed, and without a window here the account
 * would keep its allowance indefinitely on a subscription nobody is paying for. Two days is enough
 * to absorb webhook retries and clock skew without being a free fortnight.
 */
const TRIAL_LAPSE_GRACE_S = 2 * 24 * 60 * 60

type SubscriptionRow = {
  plan: Plan & ('pro' | 'ultra')
  status: 'pending' | 'trial' | 'active' | 'on_hold' | 'cancelled' | 'failed' | 'expired'
  onHoldAt: number | null
  currentPeriodEnd: number | null
  trialEndsAt: number | null
}

/**
 * What the account is actually entitled to right now.
 *
 * `users.plan` is a cache written by whichever webhook last arrived, so on its own it is a claim
 * about the past. The reconciliation used to live in `getUserSubscription`, which `loadAccount`
 * never called — so a lapsed subscription kept full access until a webhook happened to show up.
 * That was survivable when a free tier sat underneath it. Now that filling *is* the subscription,
 * it is the difference between a paid product and a free one, so the check runs on the read path
 * where it can be relied on.
 *
 * Pure and separately testable on purpose; every branch here is a way somebody stops paying.
 */
export function effectivePlan(
  cachedPlan: Plan,
  sub: SubscriptionRow | undefined,
  now = Date.now(),
): Plan {
  if (!sub) return 'free'

  /**
   * Every timestamp on this table is in **seconds**, because that is what `applyWebhook` writes
   * (`Math.floor(Date.now() / 1000)`). The function this replaced compared them against a
   * millisecond `Date.now()` after multiplying by 1000 in some branches — the conversion is done
   * once, here, so no branch can forget it.
   */
  const nowSeconds = Math.floor(now / 1000)

  switch (sub.status) {
    case 'active':
      return sub.plan
    case 'trial':
      // No end date means we failed to record one; treat it as live rather than punish the user.
      if (sub.trialEndsAt === null) return sub.plan
      return nowSeconds <= sub.trialEndsAt + TRIAL_LAPSE_GRACE_S ? sub.plan : 'free'
    case 'on_hold':
      // A card that failed is usually a card that gets replaced. Keep working for the window.
      if (sub.onHoldAt === null) return sub.plan
      return nowSeconds <= sub.onHoldAt + ON_HOLD_GRACE_S ? sub.plan : 'free'
    case 'cancelled':
      // Cancelled but paid for: the period already bought is still theirs.
      if (sub.currentPeriodEnd === null) return 'free'
      return nowSeconds <= sub.currentPeriodEnd ? sub.plan : 'free'
    case 'pending':
    case 'failed':
    case 'expired':
      // Never started, or finished. `pending` and `failed` were previously absent from the enum,
      // which made an incomplete mandate indistinguishable from a working subscription.
      return 'free'
    default:
      return cachedPlan === 'free' ? 'free' : cachedPlan
  }
}

export async function loadAccount(db: Db, userId: string): Promise<Account | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      plan: users.plan,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = rows[0]
  if (!user) return null

  const [docRows, sourceRows, subRows] = await Promise.all([
    db
      .select({ version: profileDocs.version })
      .from(profileDocs)
      .where(eq(profileDocs.userId, userId))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)` })
      .from(profileSources)
      .where(and(eq(profileSources.userId, userId), eq(profileSources.status, 'ready'))),
    db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        onHoldAt: subscriptions.onHoldAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
  ])

  const doc = docRows[0]
  const readySources = sourceRows[0]?.count ?? 0
  const sub = subRows[0]

  /**
   * The subscription is resolved *before* the quota, not alongside it.
   *
   * These four queries used to run in one `Promise.all`, which meant `loadQuota` was handed
   * `users.plan` — a cache written by whichever webhook arrived last. A lapsed trial therefore kept
   * a full allowance until something happened to correct the row. The subscription decides the
   * plan, so it has to be read first; the other two are independent and still parallel.
   */
  const plan = effectivePlan(user.plan, sub)
  const quota = await loadQuota(db, userId, plan)

  /**
   * Reported whenever a row exists, in whatever state.
   *
   * It used to be nulled unless the status was `active`, `trial` or `on_hold`, which hid exactly
   * the states the user needs to see: a cancelled subscription still running out its paid period,
   * and a mandate that failed. The panel cannot explain what it is not told.
   */
  const subscription = sub
    ? {
        plan: sub.plan,
        status: sub.status,
        ...(sub.currentPeriodEnd ? { currentPeriodEnd: sub.currentPeriodEnd } : {}),
        ...(sub.trialEndsAt ? { trialEndsAt: sub.trialEndsAt } : {}),
      }
    : null

  return {
    id: user.id,
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    quota,
    // Matches `runFill`'s gate: a source exists, whether or not it yielded identity text.
    // Gating on token count told users with only images or audio to add a source forever.
    profileReady: readySources > 0,
    profileVersion: doc?.version ?? 0,
    subscription,
  }
}
