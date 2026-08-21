#!/usr/bin/env node
/**
 * Provisions the live-mode Dodo catalogue and webhook, then writes the Worker's live secrets.
 *
 * Test and live mode are two unrelated datasets: separate API keys, products, collections,
 * webhooks, customers and transactions. Nothing migrates between them and a test product id
 * does not resolve in live mode — it 404s at checkout, for a customer holding a card. Going
 * live therefore means recreating the whole catalogue and re-registering the webhook, and the
 * five ids that come back are what the Worker has to be given.
 *
 * By hand that is six dashboard forms and five copied ids. This does it from the catalogue
 * declared below, and idempotently: anything already present in live mode is matched by name
 * and currency and reused, so a second run after a half-finished first run does not create a
 * duplicate Pro that customers can still reach.
 *
 *     node scripts/dodo-live.mjs --dry-run    # print the plan, create nothing
 *     node scripts/dodo-live.mjs              # create, then write .dev.vars.production
 *
 * The live key comes from $DODO_LIVE_API_KEY, `--key=...`, or an interactive prompt. It is
 * never passed as an argv to another process — argv is visible in the process list — and it
 * is written only to the gitignored override file.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const LIVE = 'https://live.dodopayments.com'
const OVERRIDES = new URL('../apps/api/.dev.vars.production', import.meta.url)
const WEBHOOK_URL = 'https://api.fillaform.in/v1/billing/webhook'

/**
 * The catalogue, copied field-for-field from the test-mode products — same names, same
 * descriptions, same amounts in minor units, same `saas` tax category, same 1-month billing
 * frequency over a 20-year subscription period.
 *
 * One deliberate difference: no `trial_period_days`. The test-mode Pro products carry a
 * product-level 14-day trial, which means the plan picker hands a free fortnight to anyone
 * who opens it — including a customer whose trial already lapsed, which is precisely the
 * case `createCheckout` refuses by checking `account.subscription == null`. A trial the
 * product grants cannot be gated by the server. So the trial lives only where the server
 * asks for it, in `subscription_data.trial_period_days`, and the product charges on day one.
 */
const CATALOGUE = [
  {
    plan: 'pro',
    currency: 'usd',
    name: 'Pro',
    amount: 500,
    code: 'USD',
    description:
      '600 AI actions a month, including 150 long written answers and rewrites. One action is one field the AI answered, or one rewrite — fields it already knows from your saved information cost nothing. 30 sources, 100 saved facts, files up to 30 MB. Cancel any time.',
  },
  {
    plan: 'pro',
    currency: 'inr',
    name: 'Pro',
    amount: 19900,
    code: 'INR',
    description:
      '600 AI actions a month, including 150 long written answers and rewrites. One action is one field the AI answered, or one rewrite — fields it already knows from your saved information cost nothing. 30 sources, 100 saved facts, files up to 30 MB. Cancel any time.',
  },
  {
    plan: 'ultra',
    currency: 'usd',
    name: 'Ultra',
    amount: 1500,
    code: 'USD',
    description:
      '2,500 AI actions a month, including 500 long written answers and rewrites. One action is one field the AI answered, or one rewrite — fields it already knows from your saved information cost nothing. More essays get the frontier model to themselves, and it learns your writing voice roughly three times faster. 100 sources, 400 saved facts, files up to 50 MB.',
  },
  {
    plan: 'ultra',
    currency: 'inr',
    name: 'Ultra',
    amount: 49900,
    code: 'INR',
    description:
      '2,500 AI actions a month, including 500 long written answers and rewrites. One action is one field the AI answered, or one rewrite — fields it already knows from your saved information cost nothing. More essays get the frontier model to themselves, and it learns your writing voice roughly three times faster. 100 sources, 400 saved facts, files up to 50 MB.',
  },
]

/** One collection per currency — Collection Checkout is how a customer picks Pro or Ultra. */
const COLLECTIONS = [
  {
    currency: 'usd',
    name: 'AI Form Filler (USD)',
    description: 'Pro and Ultra plans billed in USD',
  },
  {
    currency: 'inr',
    name: 'AI Form Filler (INR)',
    description: 'Pro and Ultra plans billed in INR',
  },
]

/**
 * Exactly the events `applyWebhook` implements a case for, and no others.
 *
 * The test-mode endpoint also subscribes to `subscription.updated`, which the handler ignores.
 * A delivery nothing acts on still costs a round trip and still burns an idempotency key in KV,
 * and it makes the webhook log harder to read when something is actually wrong.
 */
const EVENTS = [
  'subscription.active',
  'subscription.renewed',
  'subscription.plan_changed',
  'subscription.on_hold',
  'subscription.cancelled',
  'subscription.expired',
  'subscription.failed',
]

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const FORCE = args.includes('--force')
const PUSH = args.includes('--push')

async function resolveKey() {
  const flag = args.find((a) => a.startsWith('--key='))
  if (flag) return flag.slice('--key='.length).trim()
  if (process.env.DODO_LIVE_API_KEY) return process.env.DODO_LIVE_API_KEY.trim()

  const rl = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return (await rl.question('Dodo LIVE-mode API key: ')).trim()
  } finally {
    rl.close()
  }
}

let KEY = ''

async function dodo(path, init = {}) {
  const res = await fetch(`${LIVE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      ...init.headers,
    },
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status}: ${text.slice(0, 400)}`)
  }
  return text === '' ? {} : JSON.parse(text)
}

/** Business verification is what gates taking a real card. Refuse to pretend otherwise. */
async function checkBrand() {
  const { items = [] } = await dodo('/brands')
  const brands = items.filter((b) => b.enabled && !b.archived_at)

  if (brands.length === 0) {
    throw new Error('No enabled brand in live mode. Complete business setup in the Dodo dashboard.')
  }

  for (const b of brands) {
    const ok = b.verification_status === 'Success'
    console.log(`  ${ok ? '✓' : '✗'} brand "${b.name}" — verification: ${b.verification_status}`)
    if (!ok && !FORCE) {
      throw new Error(
        `Brand "${b.name}" is not verified (${b.verification_status}). Live checkouts will fail until ` +
          'KYC and business verification are approved. Re-run with --force to provision anyway.',
      )
    }
  }
}

async function ensureProducts() {
  const { items = [] } = await dodo('/products?page_size=100')
  const ids = { pro: {}, ultra: {} }

  for (const entry of CATALOGUE) {
    const existing = items.find(
      (p) => p.name === entry.name && p.currency === entry.code && p.is_recurring,
    )

    if (existing) {
      console.log(`  = ${entry.name} ${entry.code} — reusing ${existing.product_id}`)
      ids[entry.plan][entry.currency] = existing.product_id
      continue
    }

    if (DRY) {
      console.log(`  + ${entry.name} ${entry.code} ${entry.amount} — would create`)
      ids[entry.plan][entry.currency] = `pdt_DRYRUN_${entry.plan}_${entry.currency}`
      continue
    }

    const created = await dodo('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: entry.name,
        description: entry.description,
        tax_category: 'saas',
        price: {
          type: 'recurring_price',
          currency: entry.code,
          price: entry.amount,
          discount: 0,
          tax_inclusive: false,
          purchasing_power_parity: false,
          payment_frequency_count: 1,
          payment_frequency_interval: 'Month',
          subscription_period_count: 20,
          subscription_period_interval: 'Year',
        },
      }),
    })

    console.log(`  + ${entry.name} ${entry.code} ${entry.amount} — created ${created.product_id}`)
    ids[entry.plan][entry.currency] = created.product_id
  }

  return ids
}

async function ensureCollections(products) {
  const { items = [] } = await dodo('/product-collections')
  const ids = {}

  for (const collection of COLLECTIONS) {
    const existing = items.find((c) => c.name === collection.name)

    if (existing) {
      console.log(`  = ${collection.name} — reusing ${existing.id}`)
      ids[collection.currency] = existing.id
      continue
    }

    if (DRY) {
      console.log(`  + ${collection.name} — would create`)
      ids[collection.currency] = `pdc_DRYRUN_${collection.currency}`
      continue
    }

    const created = await dodo('/product-collections', {
      method: 'POST',
      body: JSON.stringify({
        name: collection.name,
        description: collection.description,
        groups: [
          {
            group_name: 'Plans',
            products: [
              { product_id: products.pro[collection.currency] },
              { product_id: products.ultra[collection.currency] },
            ],
          },
        ],
      }),
    })

    console.log(`  + ${collection.name} — created ${created.id}`)
    ids[collection.currency] = created.id
  }

  return ids
}

/**
 * Returns the signing secret, or null when an endpoint is already registered.
 *
 * Dodo hands the secret back once, at creation. There is no read-it-again endpoint, so an
 * endpoint that already exists leaves whatever secret is already configured as the only copy
 * — which is correct, and is why this reuses rather than recreates. `--rotate` deletes and
 * recreates when the secret has genuinely been lost.
 */
async function ensureWebhook() {
  const { data = [] } = await dodo('/webhooks')
  let existing = data.find((w) => w.url === WEBHOOK_URL)

  if (existing && args.includes('--rotate')) {
    if (DRY) {
      console.log(`  ~ ${WEBHOOK_URL} — would delete ${existing.id} and recreate`)
      return null
    }
    await dodo(`/webhooks/${existing.id}`, { method: 'DELETE' })
    console.log(`  - deleted ${existing.id} to rotate its secret`)
    existing = undefined
  }

  if (existing) {
    console.log(`  = ${WEBHOOK_URL} — already registered as ${existing.id}`)
    console.log('    Its signing secret is only readable at creation; keeping the configured one.')
    if (existing.disabled) console.log('    ! this endpoint is DISABLED in the dashboard')
    return null
  }

  if (DRY) {
    console.log(`  + ${WEBHOOK_URL} — would create, subscribed to ${EVENTS.length} events`)
    return null
  }

  const created = await dodo('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url: WEBHOOK_URL,
      description: 'Fillaform live subscription events',
      filter_types: EVENTS,
    }),
  })

  console.log(`  + ${WEBHOOK_URL} — created ${created.id}`)

  const secret = created.secret ?? created.signing_secret ?? null
  if (!secret) {
    console.log(
      '    ! no secret in the response — copy it from Dashboard → Webhooks → this endpoint',
    )
  }
  return secret
}

/** Merges into the override file rather than overwriting it, so a lost secret stays lost-proof. */
function writeOverrides(values) {
  const existing = new Map()
  if (existsSync(OVERRIDES)) {
    for (const line of readFileSync(OVERRIDES, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index !== -1)
        existing.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim())
    }
  }

  for (const [name, value] of Object.entries(values)) {
    if (value != null) existing.set(name, value)
  }

  const missing = ['DODO_WEBHOOK_SECRET'].filter((name) => !existing.get(name))

  const body = [
    '# Live-mode Dodo values, layered over .dev.vars when pushing to a deployed environment.',
    '#',
    '# Generated by `pnpm dodo:live`. Gitignored, and never read by `wrangler dev` — local',
    '# development keeps the test-mode values in .dev.vars so a click cannot charge a real card.',
    '#',
    '#   pnpm secrets:push production    # .dev.vars, with everything below overriding it',
    '',
    ...[...existing].map(([name, value]) => `${name}=${value}`),
    '',
  ].join('\n')

  writeFileSync(OVERRIDES, body)
  console.log(`\n  wrote apps/api/.dev.vars.production (${existing.size} values)`)
  if (missing.length > 0) {
    console.log(`  ! still needs a real value: ${missing.join(', ')}`)
  }
  return missing
}

console.log(`\nDodo live-mode provisioning${DRY ? ' (dry run — nothing will be created)' : ''}\n`)

KEY = await resolveKey()
if (!KEY) {
  console.error('No live API key supplied.')
  process.exit(1)
}

console.log('\nBusiness')
await checkBrand()

console.log('\nProducts')
const products = await ensureProducts()

console.log('\nCollections')
const collections = await ensureCollections(products)

console.log('\nWebhook')
const webhookSecret = await ensureWebhook()

const productIds = JSON.stringify(products)
const collectionIds = JSON.stringify(collections)

console.log('\nResolved')
console.log(`  DODO_PRODUCT_IDS=${productIds}`)
console.log(`  DODO_COLLECTION_IDS=${collectionIds}`)

if (DRY) {
  console.log('\nDry run — no products, collections, webhooks or files were touched.\n')
  process.exit(0)
}

const missing = writeOverrides({
  DODO_ENVIRONMENT: 'live_mode',
  DODO_PAYMENTS_API_KEY: KEY,
  DODO_WEBHOOK_SECRET: webhookSecret,
  DODO_PRODUCT_IDS: productIds,
  DODO_COLLECTION_IDS: collectionIds,
})

if (PUSH && missing.length === 0) {
  console.log('\nPushing to production\n')
  execFileSync(
    'pnpm',
    ['--filter', '@aff/api', 'exec', 'node', 'scripts/push-secrets.mjs', 'production'],
    { stdio: 'inherit' },
  )
} else {
  console.log('\nNext:')
  if (missing.length > 0) {
    console.log(`  1. put the real ${missing.join(' and ')} into apps/api/.dev.vars.production`)
    console.log('  2. pnpm secrets:push production')
  } else {
    console.log('  1. pnpm secrets:push production')
  }
  console.log('  2. pnpm ship')
  console.log('  3. buy Ultra with a real card, then refund it from the dashboard\n')
}
