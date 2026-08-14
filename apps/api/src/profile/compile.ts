import type { EducationEntry, ExperienceEntry, Identity, Preference, Profile } from '@aff/shared'

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

/**
 * Sorts most-recent-first, with entries lacking an end date treated as current.
 * The label tiebreak is what makes this a *total* order — without it, two entries with
 * equal dates could come out in either order depending on the input array.
 */
function byRecencyThen<T>(
  items: T[],
  endDate: (t: T) => string | undefined,
  label: (t: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const aEnd = endDate(a) ?? '9999'
    const bEnd = endDate(b) ?? '9999'
    if (aEnd !== bEnd) return bEnd.localeCompare(aEnd)
    return label(a).localeCompare(label(b))
  })
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

function renderEducation(entries: EducationEntry[]): string {
  if (entries.length === 0) return ''
  const sorted = byRecencyThen(
    entries,
    (e) => e.endDate,
    (e) => e.institution,
  )
  const lines = sorted.map((e) => {
    const parts = [e.degree, e.field].filter(Boolean).join(', ')
    const span = [e.startDate, e.endDate ?? 'present'].filter(Boolean).join(' – ')
    const bits = [e.institution, parts, span, e.grade && `Grade: ${e.grade}`].filter(Boolean)
    return `- ${bits.join(' | ')}`
  })
  return `## Education\n${lines.join('\n')}`
}

function renderExperience(entries: ExperienceEntry[]): string {
  if (entries.length === 0) return ''
  const sorted = byRecencyThen(
    entries,
    (e) => e.endDate,
    (e) => `${e.company} ${e.title}`,
  )
  const blocks = sorted.map((e) => {
    const span = [e.startDate, e.endDate ?? 'present'].filter(Boolean).join(' – ')
    const head = `- ${[e.title, e.company, span].filter(Boolean).join(' | ')}`
    const summary = e.summary ? `\n  ${normalizeText(e.summary).replace(/\n/g, '\n  ')}` : ''
    // Highlights are user-ordered and meaningful as written — preserve, don't sort.
    const highlights = e.highlights.map((h) => `\n  • ${normalizeText(h)}`).join('')
    return `${head}${summary}${highlights}`
  })
  return `## Experience\n${blocks.join('\n')}`
}

function renderSkills(skills: string[]): string {
  if (skills.length === 0) return ''

  // Sort BEFORE deduplicating. Deduplicating first would retain whichever casing appeared
  // first in the input, so ['TypeScript','typescript'] and ['typescript','TypeScript'] would
  // render differently — an order dependence, and therefore a cache invalidation.
  const sorted = skills
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b))

  const seen = new Map<string, string>()
  for (const skill of sorted) {
    const key = skill.toLowerCase()
    if (!seen.has(key)) seen.set(key, skill)
  }

  return `## Skills\n${[...seen.values()].join(', ')}`
}

/**
 * Inferred positions, rendered so the model can answer questions the sources never state.
 *
 * Confidence travels with each one: the model is told to mark an answer built on a low
 * confidence preference as inferred, which is what surfaces it for review rather than
 * letting a guess pass as a fact.
 */
function renderPreferences(preferences: Preference[]): string {
  if (preferences.length === 0) return ''
  const sorted = [...preferences].sort((a, b) => a.topic.localeCompare(b.topic))
  const lines = sorted.map(
    (p) => `- ${p.topic}: ${p.stance} (confidence ${p.confidence.toFixed(1)}; ${p.evidence})`,
  )
  return `## Likely preferences\nInferred, not stated. Use for judgement calls; mark answers built on these as inferred.\n${lines.join('\n')}`
}

function renderCustom(custom: Record<string, string>): string {
  const keys = Object.keys(custom).sort()
  if (keys.length === 0) return ''
  return `## Other facts\n${keys.map((k) => `${k}: ${custom[k]}`).join('\n')}`
}

function renderStyle(profile: Profile): string {
  const { style } = profile
  const lines: string[] = []
  if (style.tone) lines.push(`Preferred tone: ${style.tone}`)
  if (style.avoid.length > 0) {
    lines.push(`Avoid: ${[...style.avoid].sort((a, b) => a.localeCompare(b)).join('; ')}`)
  }
  if (style.exemplars.length > 0) {
    // Exemplars are few-shot examples; order affects the model, so preserve authored order.
    lines.push('Examples of how this person writes:')
    for (const exemplar of style.exemplars) {
      lines.push(`"""\n${normalizeText(exemplar)}\n"""`)
    }
  }
  return lines.length > 0 ? `## Writing voice\n${lines.join('\n')}` : ''
}

/** Raw extracted source text, included so the model can answer from detail the schema drops. */
function renderSources(sources: { label: string; kind: string; text: string }[]): string {
  if (sources.length === 0) return ''
  const sorted = [...sources].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
  )
  const blocks = sorted.map((s) => `### ${s.kind}: ${s.label}\n${normalizeText(s.text)}`)
  return `## Source documents\n${blocks.join(SECTION_BREAK)}`
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

export async function compileProfileDoc(
  profile: Profile,
  sources: { label: string; kind: string; text: string }[] = [],
): Promise<CompiledProfile> {
  const sections = [
    profile.summary ? `## Who this is\n${normalizeText(profile.summary)}` : '',
    renderIdentity(profile.identity),
    renderEducation(profile.education),
    renderExperience(profile.experience),
    renderSkills(profile.skills),
    renderCustom(profile.custom),
    renderPreferences(profile.preferences),
    renderStyle(profile),
    renderSources(sources),
  ].filter((section) => section.length > 0)

  const doc = sections.join(SECTION_BREAK)

  return {
    doc,
    hash: await sha256Hex(doc),
    estimatedTokens: estimateTokens(doc),
  }
}
