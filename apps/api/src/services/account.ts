import { type Account, PLAN_LIMITS, type Plan, type QuotaState } from '@aff/shared'
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
    .select({ used: quotaUsage.used })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.userId, userId), eq(quotaUsage.period, period)))
    .limit(1)

  return {
    plan,
    used: rows[0]?.used ?? 0,
    limit: PLAN_LIMITS[plan],
    resetsAt: periodResetsAt(),
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

  const [quota, docRows, sourceRows, subRows] = await Promise.all([
    loadQuota(db, userId, user.plan),
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
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
  ])

  const doc = docRows[0]
  const readySources = sourceRows[0]?.count ?? 0
  const sub = subRows[0]

  const subscription =
    sub && (sub.status === 'active' || sub.status === 'trial' || sub.status === 'on_hold')
      ? {
          plan: sub.plan,
          status: sub.status,
          ...(sub.currentPeriodEnd ? { currentPeriodEnd: sub.currentPeriodEnd } : {}),
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
