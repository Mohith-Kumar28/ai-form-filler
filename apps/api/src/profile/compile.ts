import type { Identity, LearnedAnswer, Profile } from '@aff/shared'

/**
 * Compiles a Profile into the cached prompt prefix.
 *
 * **This function must be a pure, deterministic function of its input.** It produces the
 * ~10k-token block that sits behind the prompt-cache breakpoint, so any instability — an
 * unsorted key, a `Date.now()`, a `Set` iteration — silently converts every request from a
 * 0.1x cache read into a 1.25x cache write. There is no error when that happens; the only
 * symptom is the bill.
 *
 * Rules enforced below:
 *   - object keys emitted in a fixed, hand-written order (never `Object.keys`)
 *   - arrays sorted by an explicit total ordering with a tiebreak, never left in input order
 *   - whitespace normalised so a re-parse of the same PDF can't shift bytes
 *   - no timestamps, no IDs, no randomness
 */

const SECTION_BREAK = '\n\n'

/** Collapses runs of whitespace and strips zero-width characters PDFs love to emit. */
export function normalizeText(input: string): string {
  return input
    .replace(/[​-‍﻿]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderIdentity(identity: Identity): string {
  const lines: string[] = []
  // Fixed field order. Do not replace with a loop over Object.entries.
  if (identity.fullName) lines.push(`Full name: ${identity.fullName}`)
  if (identity.preferredName) lines.push(`Preferred name: ${identity.preferredName}`)
  if (identity.pronouns) lines.push(`Pronouns: ${identity.pronouns}`)
  if (identity.email) lines.push(`Email: ${identity.email}`)
  if (identity.phone) lines.push(`Phone: ${identity.phone}`)
  if (identity.location) lines.push(`Location: ${identity.location}`)
  if (identity.workAuthorization) lines.push(`Work authorization: ${identity.workAuthorization}`)

  for (const platform of Object.keys(identity.links).sort()) {
    lines.push(`${platform}: ${identity.links[platform]}`)
  }

  return lines.length > 0 ? `## Identity\n${lines.join('\n')}` : ''
}

function renderCustom(custom: Record<string, string>): string {
  const keys = Object.keys(custom).sort()
  if (keys.length === 0) return ''
  return `## Other facts\n${keys.map((k) => `${k}: ${custom[k]}`).join('\n')}`
}

/**
 * Past answers, always present rather than retrieved.
 *
 * These are short, constrained answers — a device, a city, a years-of-experience number, a
 * multi-select. Routing them through semantic search was why the product kept forgetting
 * them: a six-character answer never outranks a résumé passage, and one search serves a whole
 * form. Here they are simply in the prompt, every time, for the price of a few hundred tokens
 * behind the cache breakpoint.
 *
 * The instruction travels with the section instead of living in `SYSTEM_INSTRUCTIONS`, whose
 * every byte is shared by all users — editing that invalidates everyone's cached prefix at
 * once, while this only ever changes for the one user who just learned something.
 *
 * **Sorted by question**, not left in the array's recency order: the array is append-ordered,
 * so rendering it as-is would move bytes on every new answer and re-write the cache prefix.
 */
function renderLearned(learned: LearnedAnswer[]): string {
  if (learned.length === 0) return ''

  const lines = [...learned]
    .sort((a, b) => a.question.localeCompare(b.question) || a.answer.localeCompare(b.answer))
    .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)

  return `## Answers this person gave on earlier forms\nWhen a question below is asked again — in these words or others — answer it the same way unless the form makes that impossible. These are their own choices, not guesses.\n${lines.join('\n')}`
}

export interface CompiledProfile {
  doc: string
  hash: string
  estimatedTokens: number
}

/**
 * Rough token count. Deliberately not a real tokenizer — this only sizes the cache
 * breakpoint and gates the profile-ready flag, and shipping a tokenizer to a Worker for
 * that is not worth the bundle. ~3.6 chars/token is close enough for English prose.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6)
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Three sections, and that is the whole document.
 *
 * It used to carry education, experience, skills, inferred preferences, a writing voice, and
 * the full text of every source — tens of thousands of characters shipped on every request
 * regardless of what the form asked. Memory retrieval now supplies all of that, selected
 * against the actual questions, so what remains is only what must be present before any
 * retrieval happens: the typed identity fields tier 0 answers for free, the facts the user
 * typed themselves, and the short answers they have already given on other forms — all three
 * are things retrieval demonstrably loses, being too small to rank.
 *
 * The determinism rules still apply and still matter — this is the cached prefix.
 */
export async function compileProfileDoc(profile: Profile): Promise<CompiledProfile> {
  const sections = [
    renderIdentity(profile.identity),
    renderCustom(profile.custom),
    renderLearned(profile.learned),
  ].filter((section) => section.length > 0)

  const doc = sections.join(SECTION_BREAK)

  return {
    doc,
    hash: await sha256Hex(doc),
    estimatedTokens: estimateTokens(doc),
  }
}
