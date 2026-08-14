#!/usr/bin/env node
/**
 * Mints a real session token against the LOCAL `JWT_SECRET`, for testing.
 *
 * This is deliberately **not** an auth bypass. The Worker has no test mode, no magic header,
 * and no way to skip verification — a bypass shipped for testing outlives the reason it was
 * added and becomes the way in. Instead this signs exactly the token `/v1/auth/google` would
 * issue, so every request afterwards goes through the same `verifySessionToken` path as a
 * real user's. If the secret is wrong, the token is rejected, which is the correct outcome.
 *
 * It only ever works against a local `wrangler dev`, because production's secret lives in
 * Cloudflare and is not in `.dev.vars`.
 *
 *   node scripts/dev-token.mjs            # seeds a local user and prints a token
 *   node scripts/dev-token.mjs <userId>   # token for an existing user
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { SignJWT } from 'jose'

const DEV_VARS = new URL('../.dev.vars', import.meta.url)

if (!existsSync(DEV_VARS)) {
  console.error('No .dev.vars found. Copy .dev.vars.example and fill it in.')
  process.exit(1)
}

const secret = readFileSync(DEV_VARS, 'utf8')
  .split('\n')
  .find((line) => line.startsWith('JWT_SECRET='))
  ?.slice('JWT_SECRET='.length)
  .trim()

if (!secret || secret === 'replace-me') {
  console.error('JWT_SECRET is not set in .dev.vars.')
  process.exit(1)
}

const userId = process.argv[2] ?? 'usr_dev_local'

/** Seeds the row locally so `/v1/me` has something to return. Ignored if it already exists. */
if (!process.argv[2]) {
  const now = Date.now()
  const sql = `INSERT OR IGNORE INTO users (id, google_sub, email, name, plan, created_at, updated_at)
               VALUES ('${userId}', 'dev-local', 'dev@localhost', 'Dev User', 'free', ${now}, ${now});`
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'aff-db', '--local', '--command', sql], {
      stdio: 'pipe',
    })
    console.error(`seeded local user ${userId}`)
  } catch (cause) {
    console.error('could not seed the local user:', cause.message.split('\n')[0])
  }
}

const token = await new SignJWT({})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(userId)
  .setIssuer('aff-api')
  .setAudience('aff-extension')
  .setIssuedAt()
  .setExpirationTime('30d')
  .sign(new TextEncoder().encode(secret))

// Token to stdout, everything else to stderr, so `TOKEN=$(node scripts/dev-token.mjs)` works.
console.log(token)
