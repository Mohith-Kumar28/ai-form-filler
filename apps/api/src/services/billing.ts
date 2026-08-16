import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { subscriptions, users } from '../db/schema.js'
import type { AppEnv } from '../env.js'

const ON_HOLD_GRACE_MS = 3 * 24 * 60 * 60 * 1000

interface DodoProductIds {
  pro: { usd: string; inr: string }
  ultra: { usd: string; inr: string }
}

function getProducts(env: AppEnv['Bindings']): DodoProductIds {
  return JSON.parse(env.DODO_PRODUCT_IDS) as DodoProductIds
}

function getCollectionId(env: AppEnv['Bindings'], country: string): string {
  const collections = JSON.parse(env.DODO_COLLECTION_IDS) as { usd: string; inr: string }
  return country === 'IN' ? collections.inr : collections.usd
}

function planFromProductId(env: AppEnv['Bindings'], productId: string): 'pro' | 'ultra' {
  const products = getProducts(env)
  for (const plan of ['pro', 'ultra'] as const) {
    for (const currency of ['usd', 'inr'] as const) {
      if (products[plan][currency] === productId) return plan
    }
  }
  return 'pro'
}

async function dodoFetch(
  env: AppEnv['Bindings'],
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base =
    env.DODO_ENVIRONMENT === 'test_mode'
      ? 'https://test.dodopayments.com'
      : 'https://live.dodopayments.com'

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`,
      ...init.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Dodo API error ${res.status}: ${body}`)
  }

  return res
}

/**
 * Creates a Collection Checkout session. Dodo renders all plans in the collection
 * side-by-side — the customer picks which one they want. No `product_cart` is
 * passed; the collection's own products are displayed instead.
 */
export async function createCheckout(
  env: AppEnv['Bindings'],
  params: { userId: string; email: string; country: string },
): Promise<string> {
  const collectionId = getCollectionId(env, params.country)

  const res = await dodoFetch(env, '/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      product_collection_id: collectionId,
      product_cart: [],
      customer: { email: params.email },
      metadata: { userId: params.userId },
      return_url: 'https://aff-api.mohithkumar808.workers.dev/v1/billing/return',
    }),
  })

  const session = (await res.json()) as { checkout_url: string }
  return session.checkout_url
}

export async function createPortal(
  env: AppEnv['Bindings'],
  dodoCustomerId: string,
): Promise<string> {
  const res = await dodoFetch(env, `/customers/${dodoCustomerId}/customer-portal/session`, {
    method: 'POST',
    body: JSON.stringify({
      return_url: 'https://aff-api.mohithkumar808.workers.dev/v1/billing/return',
    }),
  })

  const portal = (await res.json()) as { link: string }
  return portal.link
}

export async function applyWebhook(
  env: AppEnv['Bindings'],
  event: {
    type: string
    data: {
      subscription_id: string
      customer: { customer_id: string }
      product_id?: string
      metadata?: Record<string, string>
      cancel_at_next_billing_date?: boolean
      next_billing_date?: string
      current_period_end?: string
    }
  },
  webhookId: string,
): Promise<boolean> {
  const db = drizzle(env.DB)
  const eventType = event.type as string

  const idempotencyKey = `wh:${webhookId}`
  const seen = await env.RATE_LIMIT.get(idempotencyKey)
  if (seen) return false
  await env.RATE_LIMIT.put(idempotencyKey, '1', { expirationTtl: 86400 * 7 })

  const customerId = event.data.customer.customer_id
  const metadata = event.data.metadata ?? {}
  const userId = metadata.userId

  if (!userId) {
    console.error('[billing] webhook missing metadata.userId', eventType, customerId)
    return true
  }

  switch (eventType) {
    case 'subscription.active': {
      const existing = await db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.dodoCustomerId, customerId))
        .limit(1)

      const resolvedPlan = event.data.product_id
        ? planFromProductId(env, event.data.product_id)
        : 'pro'

      if (existing[0]?.status === 'on_hold') {
        await db
          .update(subscriptions)
          .set({ status: 'active', onHoldAt: null })
          .where(eq(subscriptions.dodoCustomerId, customerId))

        await db.update(users).set({ plan: resolvedPlan }).where(eq(users.id, userId))
        break
      }

      const periodEnd = event.data.current_period_end
        ? Math.floor(new Date(event.data.current_period_end).getTime() / 1000)
        : undefined

      const status = resolvedPlan === 'ultra' ? 'active' : 'trial'

      await db
        .insert(subscriptions)
        .values({
          userId,
          dodoCustomerId: customerId,
          dodoSubscriptionId: event.data.subscription_id,
          plan: resolvedPlan,
          status,
          currentPeriodEnd: periodEnd,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            dodoCustomerId: customerId,
            dodoSubscriptionId: event.data.subscription_id,
            plan: resolvedPlan,
            status,
            currentPeriodEnd: periodEnd,
          },
        })

      if (resolvedPlan === 'ultra') {
        await db.update(users).set({ plan: 'ultra' }).where(eq(users.id, userId))
      } else {
        await db.update(users).set({ plan: 'pro' }).where(eq(users.id, userId))
      }

      break
    }

    case 'subscription.renewed': {
      const periodEnd = event.data.next_billing_date
        ? Math.floor(new Date(event.data.next_billing_date).getTime() / 1000)
        : undefined

      const stored = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.dodoCustomerId, customerId))
        .limit(1)

      const plan = event.data.product_id
        ? planFromProductId(env, event.data.product_id)
        : stored[0]?.plan || 'pro'

      await db
        .update(subscriptions)
        .set({ status: 'active', plan, currentPeriodEnd: periodEnd, onHoldAt: null })
        .where(eq(subscriptions.dodoCustomerId, customerId))

      await db.update(users).set({ plan }).where(eq(users.id, userId))

      break
    }

    case 'subscription.plan_changed': {
      const newPlan = event.data.product_id ? planFromProductId(env, event.data.product_id) : 'pro'

      await db
        .update(subscriptions)
        .set({ plan: newPlan })
        .where(eq(subscriptions.dodoCustomerId, customerId))

      await db.update(users).set({ plan: newPlan }).where(eq(users.id, userId))

      break
    }

    case 'subscription.on_hold': {
      await db
        .update(subscriptions)
        .set({ status: 'on_hold', onHoldAt: Math.floor(Date.now() / 1000) })
        .where(eq(subscriptions.dodoCustomerId, customerId))

      break
    }

    case 'subscription.cancelled': {
      await db
        .update(subscriptions)
        .set({
          status: 'cancelled',
          onHoldAt: null,
          ...(event.data.cancel_at_next_billing_date ? {} : { currentPeriodEnd: undefined }),
        })
        .where(eq(subscriptions.dodoCustomerId, customerId))

      if (!event.data.cancel_at_next_billing_date) {
        await db.update(users).set({ plan: 'free' }).where(eq(users.id, userId))
      }

      break
    }

    case 'subscription.expired':
    case 'subscription.failed': {
      await db
        .update(subscriptions)
        .set({
          status: eventType === 'subscription.expired' ? 'expired' : 'cancelled',
          onHoldAt: null,
        })
        .where(eq(subscriptions.dodoCustomerId, customerId))

      await db.update(users).set({ plan: 'free' }).where(eq(users.id, userId))

      break
    }
  }

  return true
}

export async function getUserSubscription(
  env: AppEnv['Bindings'],
  userId: string,
): Promise<{
  plan: 'pro' | 'ultra'
  status: 'trial' | 'active' | 'on_hold' | 'cancelled' | 'expired'
  currentPeriodEnd?: number
} | null> {
  const db = drizzle(env.DB)

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  if (row.status === 'on_hold' && row.onHoldAt) {
    const elapsed = Date.now() - row.onHoldAt * 1000
    if (elapsed > ON_HOLD_GRACE_MS) {
      await db.update(users).set({ plan: 'free' }).where(eq(users.id, userId))
      return null
    }
  }

  if (row.status === 'cancelled' && row.currentPeriodEnd) {
    if (Date.now() > row.currentPeriodEnd * 1000) {
      await db.update(users).set({ plan: 'free' }).where(eq(users.id, userId))
      return null
    }
  }

  return {
    plan: row.plan,
    status: row.status,
    ...(row.currentPeriodEnd ? { currentPeriodEnd: row.currentPeriodEnd } : {}),
  }
}

export async function getDodoCustomerId(
  env: AppEnv['Bindings'],
  userId: string,
): Promise<string | null> {
  const db = drizzle(env.DB)

  const rows = await db
    .select({ dodoCustomerId: subscriptions.dodoCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  return rows[0]?.dodoCustomerId ?? null
}
