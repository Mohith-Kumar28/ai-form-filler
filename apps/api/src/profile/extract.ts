import type { Identity } from '@aff/shared'
import { normalizeText } from './compile.js'

/**
 * Heuristic identity extraction from raw source text.
 *
 * Deliberately regex-based rather than an LLM call. Email, phone, and profile URLs are
 * *structurally* identifiable — a model adds latency, cost, and non-determinism to a problem
 * that regex solves correctly. Names and job history are not structural, so those are left
 * to the user (side-panel editor) and, later, to an enrichment pass.
 *
 * Everything here is a best-effort suggestion the user can override. Never treat it as
 * authoritative over what the user typed.
 */

const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi

/**
 * International-ish phone matcher. Requires 9+ digits so it doesn't swallow years, postal
 * codes, or the "2021 - 2025" spans that litter resumes.
 */
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?(?:\d[\s.-]?){9,14}\d/g

const LINK_PATTERNS: { platform: string; pattern: RegExp }[] = [
  { platform: 'linkedin', pattern: /\bhttps?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w-]+/gi },
  { platform: 'github', pattern: /\bhttps?:\/\/(?:www\.)?github\.com\/[\w-]+(?:\/[\w.-]+)?/gi },
  { platform: 'gitlab', pattern: /\bhttps?:\/\/(?:www\.)?gitlab\.com\/[\w-]+/gi },
  { platform: 'scholar', pattern: /\bhttps?:\/\/scholar\.google\.[a-z.]+\/citations\?[^\s]+/gi },
  { platform: 'twitter', pattern: /\bhttps?:\/\/(?:www\.)?(?:twitter|x)\.com\/[\w]+/gi },
]

const GENERIC_URL = /\bhttps?:\/\/[^\s<>"')]+/gi

/** Strips trailing punctuation that regexes drag in from prose ("see github.com/me."). */
function trimUrl(url: string): string {
  return url.replace(/[.,;:)\]}>"']+$/, '')
}

function digitCount(value: string): number {
  return (value.match(/\d/g) ?? []).length
}

export function extractIdentity(rawText: string): Partial<Identity> {
  const text = normalizeText(rawText)
  const identity: Partial<Identity> = {}
  const links: Record<string, string> = {}

  // First match wins: resumes put contact details at the top, and later mentions are
  // usually references to other people or example addresses.
  const email = text.match(EMAIL)?.[0]
  if (email) identity.email = email.toLowerCase()

  const phoneCandidates = text.match(PHONE) ?? []
  const phone = phoneCandidates
    .map((p) => p.trim())
    .find((p) => {
      const digits = digitCount(p)
      // 10–15 digits covers national and E.164 numbers without matching ID numbers.
      return digits >= 10 && digits <= 15
    })
  if (phone) identity.phone = phone

  for (const { platform, pattern } of LINK_PATTERNS) {
    const match = text.match(pattern)?.[0]
    if (match) links[platform] = trimUrl(match)
  }

  // A personal site: any URL that isn't one of the platforms we already captured.
  const claimed = new Set(Object.values(links))
  const website = (text.match(GENERIC_URL) ?? [])
    .map(trimUrl)
    .find(
      (url) =>
        !claimed.has(url) && !/linkedin|github|gitlab|scholar\.google|twitter|x\.com/i.test(url),
    )
  if (website) links.website = website

  if (Object.keys(links).length > 0) identity.links = links

  return identity
}

/**
 * Merges extracted suggestions under existing values.
 *
 * User-entered data always wins — a heuristic must never overwrite something a person
 * explicitly typed. Only genuinely absent fields are filled in.
 */
export function mergeIdentity(existing: Identity, extracted: Partial<Identity>): Identity {
  return {
    ...existing,
    fullName: existing.fullName ?? extracted.fullName,
    email: existing.email ?? extracted.email,
    phone: existing.phone ?? extracted.phone,
    location: existing.location ?? extracted.location,
    links: { ...extracted.links, ...existing.links },
  }
}
