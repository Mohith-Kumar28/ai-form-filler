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
 *
 * `.dev.vars.<env>` layers on top, and exists for exactly one reason: billing has two
 * unrelated modes. `.dev.vars` holds the test-mode Dodo key, and `wrangler dev` reads that
 * file, so putting live values in it would make a local checkout click charge a real card.
 * The override file holds the live values, is read only here, and never by the dev server.
 * Anything absent from it falls through to the base file, so the shared secrets stay in
 * one place.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const ENV = process.argv[2] ?? 'production'
const DEV_VARS = new URL('../.dev.vars', import.meta.url)
const OVERRIDES = new URL(`../.dev.vars.${ENV}`, import.meta.url)

/** Names that may be blank in `.dev.vars` without failing the push. Empty since Stripe went. */
const OPTIONAL = new Set([])

if (!existsSync(DEV_VARS)) {
  console.error('apps/api/.dev.vars not found. Copy .dev.vars.example and fill it in first.')
  process.exit(1)
}

/** Later files win, which is what makes the override file an override. */
function read(file) {
  const found = new Map()
  if (!existsSync(file)) return found

  for (const line of readFileSync(file, 'utf8').split('\n')) {
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
    found.set(name, value)
  }
  return found
}

const base = read(DEV_VARS)
const overrides = read(OVERRIDES)
const merged = new Map([...base, ...overrides])
const entries = [...merged]

if (overrides.size > 0) {
  console.log(`\nOverriding ${overrides.size} value(s) from .dev.vars.${ENV}:`)
  for (const name of overrides.keys()) {
    console.log(`  ${name}${base.has(name) ? '' : '  (not in .dev.vars)'}`)
  }
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
    console.log(`  ✓ ${name}${overrides.has(name) ? `  (from .dev.vars.${ENV})` : ''}`)
  } catch {
    console.error(`  ✗ ${name} — failed`)
    process.exitCode = 1
  }
}

console.log(`\nVerify with:  wrangler secret list --env ${ENV}\n`)
