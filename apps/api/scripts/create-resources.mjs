#!/usr/bin/env node
/**
 * Creates the Cloudflare resources this Worker binds to, and writes the returned IDs
 * straight into wrangler.toml.
 *
 * The IDs are the whole reason this exists: `wrangler d1 create` prints them to stdout and
 * expects you to paste them into the right block by hand, which is easy to get wrong and
 * fails at deploy time rather than here.
 *
 * Safe to re-run — existing resources are detected and left alone.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const ENV = process.argv[2] ?? 'development'
const SUFFIX = ENV === 'production' ? '' : `-${ENV}`

const TOML = new URL('../wrangler.toml', import.meta.url)

const PLACEHOLDER = {
  development: { d1: 'PLACEHOLDER_RUN_PNPM_DB_CREATE', kv: 'PLACEHOLDER_RUN_PNPM_KV_CREATE' },
  staging: { d1: 'PLACEHOLDER_STAGING_D1_ID', kv: 'PLACEHOLDER_STAGING_KV_ID' },
  production: { d1: 'PLACEHOLDER_PRODUCTION_D1_ID', kv: 'PLACEHOLDER_PRODUCTION_KV_ID' },
}

if (!PLACEHOLDER[ENV]) {
  console.error(`Unknown environment "${ENV}". Use: development | staging | production`)
  process.exit(1)
}

function wrangler(args) {
  try {
    return execFileSync('pnpm', ['exec', 'wrangler', ...args], {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  } catch (error) {
    // A resource that already exists is a success for our purposes, not a failure.
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    if (/already exists/i.test(output)) return output
    console.error(output || error.message)
    throw error
  }
}

/** Pulls a uuid out of wrangler's human-readable output. */
function extractId(output) {
  return output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null
}

/** KV namespace ids are 32 hex characters, not uuids. */
function extractKvId(output) {
  return output.match(/\b[0-9a-f]{32}\b/i)?.[0] ?? null
}

console.log(`Creating Cloudflare resources for "${ENV}"…\n`)

const dbName = `aff-db${SUFFIX}`
const bucketName = `aff-uploads${SUFFIX}`
const kvBinding = ENV === 'production' ? 'RATE_LIMIT' : `RATE_LIMIT${SUFFIX.toUpperCase()}`

const d1Out = wrangler(['d1', 'create', dbName])
const kvOut = wrangler(['kv', 'namespace', 'create', kvBinding])
wrangler(['r2', 'bucket', 'create', bucketName])

const d1Id = extractId(d1Out)
const kvId = extractKvId(kvOut) ?? extractId(kvOut)

let toml = readFileSync(TOML, 'utf8')
const { d1: d1Placeholder, kv: kvPlaceholder } = PLACEHOLDER[ENV]
let wrote = 0

if (d1Id && toml.includes(d1Placeholder)) {
  toml = toml.replace(d1Placeholder, d1Id)
  wrote += 1
  console.log(`  D1  ${dbName} → ${d1Id}`)
} else if (!d1Id) {
  console.log(`  D1  ${dbName} already exists — run "wrangler d1 list" and paste its id`)
}

if (kvId && toml.includes(kvPlaceholder)) {
  toml = toml.replace(kvPlaceholder, kvId)
  wrote += 1
  console.log(`  KV  ${kvBinding} → ${kvId}`)
} else if (!kvId) {
  console.log(`  KV  ${kvBinding} already exists — run "wrangler kv namespace list"`)
}

console.log(`  R2  ${bucketName}`)

if (wrote > 0) {
  writeFileSync(TOML, toml)
  console.log(`\nWrote ${wrote} id(s) into wrangler.toml.`)
}

console.log('\nNext:')
console.log('  pnpm secrets:list          see which secrets this environment needs')
console.log(
  ENV === 'development'
    ? '  pnpm db:migrate            apply migrations locally'
    : `  pnpm db:migrate:${ENV === 'production' ? 'prod' : 'staging'}       apply migrations remotely`,
)
