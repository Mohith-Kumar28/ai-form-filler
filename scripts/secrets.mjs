#!/usr/bin/env node
/**
 * Lists every secret the Worker needs, what it is for, and how to obtain it.
 *
 * Secrets are the single most common reason a fresh clone or a first deploy fails, and the
 * failure mode is usually a confusing runtime error rather than a missing-config message.
 * This makes the full set inspectable in one command.
 */
import { existsSync, readFileSync } from 'node:fs'

const DEV_VARS = new URL('../apps/api/.dev.vars', import.meta.url)

const SECRETS = [
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    what: 'OAuth client ID, type "Chrome Extension", bound to your extension id.',
    where: 'Google Cloud Console → APIs & Services → Credentials',
    note: 'Must match manifest.oauth2.client_id in apps/extension/wxt.config.ts exactly, or sign-in returns INVALID_TOKEN.',
  },
  {
    name: 'JWT_SECRET',
    required: true,
    what: 'HMAC key for our own 30-day session tokens.',
    where: 'openssl rand -base64 48',
  },
  {
    name: 'EXTENSION_ORIGIN',
    required: true,
    what: 'chrome-extension://<id> — the only origin CORS admits in production.',
    where: 'chrome://extensions with Developer mode on',
  },
  {
    name: 'AI_GATEWAY_URL',
    required: true,
    what: 'Cloudflare AI Gateway endpoint. All inference goes through it.',
    where: 'Cloudflare dashboard → AI → AI Gateway → create gateway → copy API endpoint',
    note: 'With Unified Billing there are NO provider accounts and NO provider keys.',
  },
  {
    name: 'AI_GATEWAY_TOKEN',
    required: true,
    what: 'Cloudflare API token with AI Gateway Run permission — the credential under Unified Billing.',
    where: 'Cloudflare dashboard → My Profile → API Tokens',
  },
  {
    name: 'SUPERMEMORY_API_KEY',
    required: false,
    what: 'Ingestion of every format, plus semantic retrieval and the learning loop.',
    where: 'https://console.supermemory.ai',
    note: 'Without it, scans and voice notes cannot be read and retrieval falls back to BM25 over past answers.',
  },
  {
    name: 'DODO_PAYMENTS_API_KEY',
    required: false,
    what: 'Dodo Payments API key for creating checkout sessions and managing subscriptions.',
    where: 'Dodo dashboard → Developer → API',
  },
  {
    name: 'DODO_WEBHOOK_SECRET',
    required: false,
    what: 'Verifies Dodo webhook signatures (Standard Webhooks HMAC-SHA256).',
    where: 'Dodo dashboard → Developer → Webhooks → your endpoint',
  },
  {
    name: 'DODO_ENVIRONMENT',
    required: false,
    what: "'test_mode' for local dev; 'live_mode' for production.",
    where: 'Set in .dev.vars or via wrangler secret put',
  },
  {
    name: 'DODO_PRODUCT_IDS',
    required: false,
    what: 'JSON map of plan → currency → Dodo product id.',
    where: 'Create products in Dodo dashboard, then copy their ids here.',
  },
]

/** Which secrets already have a non-placeholder value locally. */
function localValues() {
  if (!existsSync(DEV_VARS)) return null
  const set = new Set()
  for (const line of readFileSync(DEV_VARS, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    const value = rest.join('=').trim()
    if (!key || key.startsWith('#') || value === '') continue
    if (/replace-me|PLACEHOLDER|^0{4}/i.test(value)) continue
    set.add(key.trim())
  }
  return set
}

const local = localValues()

console.log('\nSecrets required by the Worker\n')

for (const secret of SECRETS) {
  const status = local === null ? '?' : local.has(secret.name) ? '✓' : secret.required ? '✗' : '–'
  const tag = secret.required ? '' : '  (optional)'
  console.log(`  ${status}  ${secret.name}${tag}`)
  console.log(`       ${secret.what}`)
  console.log(`       ${secret.where}`)
  if (secret.note) console.log(`       ! ${secret.note}`)
  console.log()
}

if (local === null) {
  console.log('apps/api/.dev.vars does not exist yet:')
  console.log('  cp apps/api/.dev.vars.example apps/api/.dev.vars\n')
} else {
  const missing = SECRETS.filter((s) => s.required && !local.has(s.name))
  console.log(
    missing.length === 0
      ? 'All required secrets are set locally.\n'
      : `Missing locally: ${missing.map((s) => s.name).join(', ')}\n`,
  )
}

console.log('Local development reads apps/api/.dev.vars (gitignored).')
console.log('Deployed environments need each secret pushed:')
console.log('  pnpm secrets:push                 # interactive, for production')
console.log('  wrangler secret put NAME --env staging\n')
