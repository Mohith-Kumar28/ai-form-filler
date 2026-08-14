#!/usr/bin/env node
/**
 * Reports real cost-per-form from `fill_log`.
 *
 * This is the number that decides whether the free tier is affordable. `PLAN_LIMITS.free`
 * is a placeholder until it has been set from this output rather than from an estimate.
 *
 * Also reports the prompt-cache hit rate, which is the load-bearing assumption behind every
 * cost figure: if `cache_read_tokens` is zero across the board, caching is silently broken
 * and the real bill is roughly 10x the modelled one.
 */
import { execFileSync } from 'node:child_process'

const REMOTE = process.argv.includes('--remote')
const scope = REMOTE ? ['--remote', '--env', 'production'] : ['--local']

const QUERY = `
SELECT
  COUNT(*)                                        AS fills,
  ROUND(AVG(field_count), 1)                      AS avg_fields,
  ROUND(AVG(tier0_count), 1)                      AS avg_tier0,
  ROUND(AVG(tier1_count + tier2_count), 1)        AS avg_cheap,
  ROUND(AVG(tier3_count), 1)                      AS avg_frontier,
  ROUND(AVG(cost_micro_usd) / 10000.0, 4)         AS avg_cents,
  ROUND(MAX(cost_micro_usd) / 10000.0, 4)         AS max_cents,
  ROUND(SUM(cost_micro_usd) / 1000000.0, 4)       AS total_usd,
  ROUND(AVG(latency_ms))                          AS avg_ms,
  SUM(cache_read_tokens)                          AS cache_reads,
  SUM(cache_write_tokens)                         AS cache_writes,
  SUM(input_tokens)                               AS input_tokens
FROM fill_log;`

/**
 * Runs a query, returning null rather than throwing.
 *
 * A missing table and an unmigrated database are ordinary states for a reporting script —
 * crashing with a Node stack trace tells the reader nothing about what to do next.
 */
function query(sql) {
  let out
  try {
    out = execFileSync(
      'pnpm',
      ['exec', 'wrangler', 'd1', 'execute', 'aff-db', ...scope, '--json', '--command', sql],
      { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] },
    )
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    if (/no such table/i.test(output)) return { missingTable: true }
    console.error(output.trim() || error.message)
    return null
  }

  try {
    // wrangler prefixes its own log lines before the JSON payload.
    const json = out.slice(out.indexOf('['))
    return { rows: JSON.parse(json)[0]?.results ?? [] }
  } catch {
    return null
  }
}

const result = query(QUERY)

if (result === null) {
  console.error('\nCould not read fill_log.\n')
  process.exit(1)
}

if (result.missingTable) {
  console.log(
    `\nfill_log does not exist yet — this database has not been migrated.\n  Run: pnpm db:migrate${REMOTE ? ':prod' : ''}\n`,
  )
  process.exit(0)
}

const [row] = result.rows

if (!row || row.fills === 0) {
  console.log('\nNo fills recorded yet. Fill some forms, then re-run this.\n')
  process.exit(0)
}

const centsPerForm = row.avg_cents ?? 0
const freeTierCost = (centsPerForm * 50) / 100

console.log(`\nCost report — ${REMOTE ? 'production' : 'local'}   (${row.fills} fills)\n`)
console.log(`  Fields per form        ${row.avg_fields}`)
console.log(`    tier 0 (free)        ${row.avg_tier0}`)
console.log(`    tier 1-2 (cheap)     ${row.avg_cheap}`)
console.log(`    tier 3 (frontier)    ${row.avg_frontier}`)
console.log()
console.log(`  Mean cost per form     ${centsPerForm}¢`)
console.log(`  Worst form            ${row.max_cents}¢`)
console.log(`  Total spent            $${row.total_usd}`)
console.log(`  Mean latency           ${row.avg_ms}ms`)
console.log()

const cacheable = (row.cache_reads ?? 0) + (row.cache_writes ?? 0)
if (cacheable === 0 && (row.input_tokens ?? 0) > 0) {
  console.log('  ⚠  PROMPT CACHE NEVER HIT')
  console.log('     Every request paid full price for the profile document.')
  console.log('     See HANDOFF.md §2.1 — a varying tool schema breaks caching silently.')
} else if (row.cache_reads > 0) {
  const ratio = row.cache_reads / (row.cache_reads + row.cache_writes)
  console.log(`  Cache read ratio       ${(ratio * 100).toFixed(1)}%`)
  console.log('     (writes cost 1.25x, reads 0.1x — break-even is 2 fills per hour)')
}

console.log()
console.log(`  A 50-form free tier costs ~$${freeTierCost.toFixed(2)} per user per month.`)
console.log('  Size PLAN_LIMITS.free from this, not from an estimate.\n')
