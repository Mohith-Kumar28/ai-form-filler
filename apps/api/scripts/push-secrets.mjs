#!/usr/bin/env node
/**
 * Pushes the secrets in `.dev.vars` to a deployed environment.
 *
 * Reads from the local file rather than prompting for each one, because doing this by hand
 * across six secrets and two environments is where a wrong value silently lands in the
 * wrong place.
 *
 * Values are piped to wrangler's stdin, never passed as arguments — an argument would be
 * visible in the process list and recorded in shell history.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const ENV = process.argv[2] ?? 'production'
const DEV_VARS = new URL('../.dev.vars', import.meta.url)

/** Stripe secrets are phase 6; skip them silently while they are still blank. */
const OPTIONAL = new Set(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'])

if (!existsSync(DEV_VARS)) {
  console.error('apps/api/.dev.vars not found. Copy .dev.vars.example and fill it in first.')
  process.exit(1)
}

const entries = []
for (const line of readFileSync(DEV_VARS, 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) continue

  const index = trimmed.indexOf('=')
  if (index === -1) continue

  const name = trimmed.slice(0, index).trim()
  const value = trimmed.slice(index + 1).trim()

  if (value === '' || /replace-me|PLACEHOLDER/i.test(value)) {
    if (!OPTIONAL.has(name)) console.warn(`  skipping ${name} — still a placeholder`)
    continue
  }
  entries.push([name, value])
}

if (entries.length === 0) {
  console.error('Nothing to push — every value in .dev.vars is still a placeholder.')
  process.exit(1)
}

console.log(`\nPushing ${entries.length} secret(s) to "${ENV}":\n`)

for (const [name, value] of entries) {
  try {
    execFileSync('pnpm', ['exec', 'wrangler', 'secret', 'put', name, '--env', ENV], {
      input: value,
      stdio: ['pipe', 'ignore', 'inherit'],
    })
    console.log(`  ✓ ${name}`)
  } catch {
    console.error(`  ✗ ${name} — failed`)
    process.exitCode = 1
  }
}

console.log(`\nVerify with:  wrangler secret list --env ${ENV}\n`)
