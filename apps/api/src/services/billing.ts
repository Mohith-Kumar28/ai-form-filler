import { TRIAL_DAYS } from '@aff/shared'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { subscriptions, users } from '../db/schema.js'
import type { AppEnv } from '../env.js'

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

/**
 * Which Dodo to talk to — chosen, never defaulted.
 *
 * Test and live are two unrelated deployments: separate keys, products, collections, webhooks
 * and customers, and no id from one resolves in the other. This used to read
 * `=== 'test_mode' ? test : live`, so an unset or misspelt `DODO_ENVIRONMENT` silently
 * selected live — the mode that moves real money — and said nothing about why. Naming both
 * values turns that typo into a message identifying the bad value.
 *
 * A deployed Worker left on `test_mode` is the quieter failure and the more expensive one: it
 * accepts checkouts all day, bills nobody, and looks entirely healthy from the outside. It is
 * a warning rather than a throw because staging deliberately runs test-mode billing under
 * `ENVIRONMENT=production`.
 */
function dodoBase(env: AppEnv['Bindings']): string {
  if (env.ENVIRONMENT === 'production' && env.DODO_ENVIRONMENT === 'test_mode') {
    console.warn('[billing] deployed Worker is on Dodo TEST mode — no payment will be collected')
  }

  switch (env.DODO_ENVIRONMENT) {
    case 'live_mode':
      return 'https://live.dodopayments.com'
    case 'test_mode':
      return 'https://test.dodopayments.com'
    default:
      throw new Error(
        `DODO_ENVIRONMENT must be 'test_mode' or 'live_mode', got '${env.DODO_ENVIRONMENT}'`,
      )
  }
}

async function dodoFetch(
  env: AppEnv['Bindings'],
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = dodoBase(env)

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

const RETURN_URL = 'https://api.fillaform.in/v1/billing/return'

/**
 * Creates a checkout session, in one of two shapes.
 *
 * **Trial** — a single-product cart holding Pro, plus `subscription_data.trial_period_days`. It is
 * a cart rather than the collection because Dodo documents `subscription_data` alongside
 * `product_cart` and says nothing about combining it with `product_collection_id`; a trial that
 * silently failed to apply would charge somebody on day one. Pro specifically, because a trial of
 * the cheaper plan is the offer, and anyone who wants Ultra can change plan afterwards.
 *
 * **Direct** — Collection Checkout, unchanged: Dodo renders every plan in the collection
 * side-by-side and the customer picks. No `product_cart` is passed; the collection supplies it.
 *
 * The trial's end date travels in `metadata`, which Dodo echoes back on the webhook. That is the
 * only reason we can tell a trialing subscription from a paid one: Dodo reports both as `active`
 * and documents no field that distinguishes them — its own suggested workaround is to list the
 * subscription's payments and look for a single zero-amount row. Metadata is exact, arrives with
 * the event, and costs no extra request.
 */
export async function createCheckout(
  env: AppEnv['Bindings'],
  params: { userId: string; email: string; country: string; trial?: boolean },
): Promise<string> {
  const metadata: Record<string, string> = { userId: params.userId }

  const body: Record<string, unknown> = {
    customer: { email: params.email },
    return_url: RETURN_URL,
  }

  if (params.trial) {
    const currency = params.country === 'IN' ? 'inr' : 'usd'
    const productId = getProducts(env).pro[currency]

    metadata.trialEndsAt = String(Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86_400)

    body.product_cart = [{ product_id: productId, quantity: 1 }]
    body.subscription_data = { trial_period_days: TRIAL_DAYS }
  } else {
    body.product_collection_id = getCollectionId(env, params.country)
    body.product_cart = []
  }

  body.metadata = metadata

  const res = await dodoFetch(env, '/checkouts', {
    method: 'POST',
    body: JSON.stringify(body),
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
      return_url: 'https://api.fillaform.in/v1/billing/return',
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

      /**
       * Trialing or paid, decided by what we asked for rather than by what we can guess.
       *
       * This line used to read `resolvedPlan === 'ultra' ? 'active' : 'trial'` — so every Pro
       * subscriber was recorded as being on a trial forever, whether or not one had been offered,
       * and every Ultra subscriber as never having had one. It was harmless while a free tier sat
       * underneath and nothing read the distinction; it is load-bearing now.
       *
       * `metadata.trialEndsAt` is set by `createCheckout` when it asks Dodo for a trial, and Dodo
       * echoes metadata back on the event. A stale date — a webhook replayed long afterwards — is
       * treated as no trial, which fails towards charging rather than towards free access.
       */
      const trialEndsAt = Number(metadata.trialEndsAt) || 0
      const trialing = trialEndsAt > Math.floor(Date.now() / 1000)
      const status = trialing ? 'trial' : 'active'

      const row = {
        dodoCustomerId: customerId,
        dodoSubscriptionId: event.data.subscription_id,
        plan: resolvedPlan,
        status,
        currentPeriodEnd: periodEnd,
        trialEndsAt: trialing ? trialEndsAt : null,
      } as const

      await db
        .insert(subscriptions)
        .values({ userId, ...row })
        .onConflictDoUpdate({ target: subscriptions.userId, set: { ...row } })

      await db.update(users).set({ plan: resolvedPlan }).where(eq(users.id, userId))

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

      /**
       * A renewal is also how a trial ends.
       *
       * Dodo charges automatically on the trial's last day and sends this event, so clearing
       * `trialEndsAt` here is what converts the row from trialing to paying. Leaving it set would
       * mean `effectivePlan` kept measuring a live subscription against a date in the past.
       */
      await db
        .update(subscriptions)
        .set({
          status: 'active',
          plan,
          currentPeriodEnd: periodEnd,
          onHoldAt: null,
          trialEndsAt: null,
        })
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
          // `failed` is its own state now rather than being folded into `cancelled`. A mandate that
          // never completed and a subscription somebody chose to end are different facts, and with
          // no free tier underneath the difference is worth being able to explain to the user.
          status: eventType === 'subscription.expired' ? 'expired' : 'failed',
          onHoldAt: null,
          trialEndsAt: null,
        })
        .where(eq(subscriptions.dodoCustomerId, customerId))

      await db.update(users).set({ plan: 'free' }).where(eq(users.id, userId))

      break
    }
  }

  return true
}

/**
 * `getUserSubscription` lived here and had no callers.
 *
 * It was the only place that reconciled a lapsed subscription against the clock, and because
 * nothing invoked it that reconciliation never ran. It is now `effectivePlan` in
 * `services/account.ts`, on the read path that every authed request already goes through.
 */

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
