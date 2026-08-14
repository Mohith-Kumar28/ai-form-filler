#!/usr/bin/env node
/**
 * One-shot: move `profile.learned` answers into Supermemory, then drop the field.
 *
 * The `learned` store is gone (see `answer-bank.ts` for why). Answers written before the
 * Supermemory mirror existed live *only* in D1, so deleting the field without this would lose
 * them. Written in the same `Question: … / Their answer: …` shape `rememberUserWriting` uses, so
 * a migrated answer is indistinguishable from one learned today.
 *
 * Idempotent: it strips `learned` from the stored profile as it goes, so a second run finds
 * nothing. Supermemory also deduplicates identical content at the byte level.
 *
 *   node scripts/migrate-learned-to-memory.mjs            # local D1
 *   node scripts/migrate-learned-to-memory.mjs --remote   # deployed D1
 *
 * Reads SUPERMEMORY_API_KEY from .dev.vars (local) or the environment.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const remote = process.argv.includes('--remote')
const scope = remote ? '--remote' : '--local'

function d1(sql) {
  const out = execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'aff-db', scope, '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return JSON.parse(out.slice(out.indexOf('[')))[0].results
}

function apiKey() {
  if (process.env.SUPERMEMORY_API_KEY) return process.env.SUPERMEMORY_API_KEY
  try {
    const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    const line = vars.split('\n').find((l) => l.trim().startsWith('SUPERMEMORY_API_KEY'))
    return line
      ?.split('=')
      .slice(1)
      .join('=')
      .trim()
      .replace(/^["']|["']$/g, '')
  } catch {
    return undefined
  }
}

const key = apiKey()
if (!key) {
  console.error('No SUPERMEMORY_API_KEY in the environment or apps/api/.dev.vars')
  process.exit(1)
}

const rows = d1('select user_id, structured_json from profile_docs')
let moved = 0
let cleaned = 0

for (const row of rows) {
  let structured
  try {
    structured = JSON.parse(row.structured_json)
  } catch {
    console.warn(`skipping ${row.user_id}: unparseable structured_json`)
    continue
  }

  const learned = Array.isArray(structured.learned) ? structured.learned : []
  if (learned.length === 0) continue

  for (const entry of learned) {
    if (!entry?.question || !entry?.answer) continue

    const response = await fetch('https://api.supermemory.ai/v3/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `Question: ${entry.question}\n\nTheir answer: ${entry.answer}`,
        containerTags: [`user_${row.user_id}`],
        metadata: {
          kind: 'user_answer',
          edited: 'true',
          origin: entry.origin ?? '',
          question: entry.question,
          migrated: 'true',
        },
      }),
    })

    if (!response.ok) {
      console.error(`  failed: ${entry.question} — ${response.status} ${await response.text()}`)
      continue
    }
    moved += 1
    console.log(`  moved: ${entry.question} → ${entry.answer}`)
  }

  // Only after every answer for this user is safely in memory.
  delete structured.learned
  const json = JSON.stringify(structured).replace(/'/g, "''")
  d1(`update profile_docs set structured_json = '${json}' where user_id = '${row.user_id}'`)
  cleaned += 1
}

console.log(`\n${moved} answers moved to Supermemory, ${cleaned} profiles cleaned.`)
if (moved === 0) console.log('Nothing to migrate — already done, or no learned answers stored.')
