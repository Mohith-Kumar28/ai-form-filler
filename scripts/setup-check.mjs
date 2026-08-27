#!/usr/bin/env node
/**
 * Reports what still needs doing before the project can actually run.
 *
 * Deliberately checks state rather than printing instructions: the failure modes here
 * (a placeholder database id, a mismatched OAuth client id) surface much later as
 * confusing runtime errors, so it is worth naming them up front.
 */
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = (path) => {
  const url = new URL(path, root)
  return existsSync(url) ? readFileSync(url, 'utf8') : null
}

const checks = []

const toml = read('apps/api/wrangler.toml')
checks.push({
  name: 'Cloudflare resources created',
  ok: toml !== null && !toml.includes('PLACEHOLDER_RUN_PNPM'),
  fix: 'pnpm cf:create',
})

const devVars = read('apps/api/.dev.vars')
checks.push({
  name: 'apps/api/.dev.vars exists',
  ok: devVars !== null,
  fix: 'cp apps/api/.dev.vars.example apps/api/.dev.vars',
})

checks.push({
  name: 'JWT_SECRET set',
  ok: devVars !== null && !/JWT_SECRET=(replace-me)?\s*$/m.test(devVars),
  fix: 'openssl rand -base64 48   → JWT_SECRET in apps/api/.dev.vars',
})

/**
 * The "do these two client ids match" check is gone, and its absence is the point: the
 * manifest and the Worker now import the same constant, so there is no second copy left to
 * disagree with. All that remains to check is that the constant holds a real value.
 */
const deployment = read('packages/shared/src/deployment.ts')
const clientId = deployment?.match(/GOOGLE_CLIENT_ID =\s*\n?\s*'([^']+)'/)?.[1] ?? ''

checks.push({
  name: 'Google OAuth client id set',
  ok: clientId.endsWith('.apps.googleusercontent.com') && !clientId.startsWith('000000'),
  fix: 'README §2 — create a Chrome Extension OAuth client, put the id in packages/shared/src/deployment.ts',
})

// The gateway is the only inference route. Both halves must be real values — a URL still
// carrying REPLACE_ placeholders looks configured but fails on the first model call.
const gatewayUrlLine = devVars?.match(/^AI_GATEWAY_URL=(.+)$/m)?.[1]?.trim() ?? ''
const gatewayToken = devVars?.match(/^AI_GATEWAY_TOKEN=(.+)$/m)?.[1]?.trim() ?? ''

checks.push({
  name: 'AI Gateway configured',
  ok:
    gatewayUrlLine.startsWith('https://') &&
    !gatewayUrlLine.includes('REPLACE_') &&
    gatewayToken !== '' &&
    gatewayToken !== 'replace-me',
  fix: 'AI_GATEWAY_URL + AI_GATEWAY_TOKEN — Cloudflare dashboard → AI → AI Gateway',
})

checks.push({
  name: 'API client generated',
  ok: existsSync(new URL('apps/extension/src/generated/model/index.ts', root)),
  fix: 'pnpm api:generate',
})

console.log('\nSetup status\n')
let blocked = 0
for (const check of checks) {
  console.log(`  ${check.ok ? '✓' : '✗'}  ${check.name}`)
  if (!check.ok) {
    console.log(`       ${check.fix}`)
    blocked += 1
  }
}

console.log(
  blocked === 0
    ? '\nEverything is configured. Run: pnpm dev\n'
    : `\n${blocked} item(s) outstanding. Details: pnpm secrets:list\n`,
)
