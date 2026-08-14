import type { FeedbackRequest, FieldSchema, Identity, LearnedAnswer } from '@aff/shared'
import type { Env } from '../env.js'
import { identitySlotFor } from '../router/classify.js'
// The same normaliser the read path uses. Two copies that drift by one character are two
// stores that never agree, and nothing about the failure is visible.
import { normalizeQuestion } from '../router/recall.js'
import type { Db } from './account.js'
import { getStructured, updateStructured } from './profile.js'
import { rememberUserWriting } from './supermemory.js'

/**
 * The learning loop: what the user actually submitted goes back into what answers the form.
 *
 * **One answer, one destination.** Every entry is routed to exactly one of three stores, and
 * which one it is decides whether the answer ever comes back. Getting this wrong does not
 * fail — it stores the answer somewhere nothing reads, and the next form asks again.
 *
 *   1. **Identity → the profile's typed slots.** Phone, email, name, location, links are
 *      answered by tier 0: a direct lookup, no model call, no retrieval. A value that only
 *      reached memory could not be found by that path no matter how often it was learned,
 *      because tier 0 never searches. It reads `identity.phone`.
 *
 *   2. **Short, constrained answers → `profile.learned`.** A dropdown, a radio, a
 *      multi-select, a one-line text answer. These are durable facts about a person — the
 *      device they use, the city they live in, their notice period — and they are the class
 *      the product was losing entirely: too specific for an identity slot, too short to win a
 *      semantic search. They now sit in the cached prompt prefix, present on every fill.
 *
 *   3. **Prose → memory.** Essays and paragraphs, where the value is substance *and* voice,
 *      and where semantic retrieval against a differently-worded question is exactly right.
 *
 * An edit is the strongest signal the product receives — it is the user's own writing on a
 * question they cared enough to fix — so it is worth routing to the place it will be read.
 */

/** Treats undefined and whitespace-only as absent, matching the profile merge rule. */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}

/** Nothing longer than this belongs in an identity field, and it reaches every prompt. */
const MAX_IDENTITY_CHARS = 200

/**
 * Above this a *typed* answer is prose, and prose belongs in memory.
 *
 * Generous on purpose: "Bengaluru, India (open to relocating)" is still a fact about a person,
 * and losing it to the essay path means losing it altogether. The cost of being wrong in this
 * direction is a slightly longer profile; being wrong the other way is a forgotten answer.
 */
const MAX_TYPED_FACT_CHARS = 160

/**
 * The ceiling for a **choice**, which is a different question entirely.
 *
 * A multi-select answer is as long as the labels the form chose to write, and real forms write
 * long ones: three of "AI-powered search (e.g., 'What was that red shoe I saved?')" and its
 * siblings is over 160 characters without being remotely prose. Judging those by a prose
 * length limit sent them to semantic memory, where a selection list is the one thing retrieval
 * cannot use — the answer was learned and then unreachable, which is the whole bug this store
 * exists to fix. Options are bounded by the page, so this only has to bound the prompt.
 */
const MAX_CHOICE_FACT_CHARS = 400

/** The question text is a key *and* prompt content, so it is bounded on both counts. */
const MAX_LEARNED_QUESTION_CHARS = 200

/**
 * How many past answers ride in the prompt prefix.
 *
 * Each is roughly 20 tokens, so this is a bounded few thousand — affordable behind the cache
 * breakpoint, and far cheaper than the model re-deriving the same choice on every form. The
 * oldest are dropped first: the tail of a long history is where stale answers live.
 */
const MAX_LEARNED_ANSWERS = 80

/** Choice widgets. Whatever their length, the answer is a constrained fact, never prose. */
const CHOICE_KINDS = new Set(['select', 'radio', 'multiselect', 'checkbox'])

/**
 * Whether a learned value is plausibly the thing it claims to be.
 *
 * Learned values skip the `Identity` schema entirely — `updateStructured` merges and
 * `JSON.stringify`s without re-validating — so anything accepted here is stored permanently.
 * Two consequences make that worse than it sounds: a malformed email or link makes every
 * later profile save fail validation, which the user cannot clear from the UI, and the value
 * is copied into the cached prompt prefix of every future fill.
 *
 * So each slot is checked for the shape it is supposed to have, and anything that fails is
 * dropped rather than stored. Dropping costs one missed autofill; storing costs a profile
 * the user cannot repair.
 */
function isPlausible(slot: string, value: string): boolean {
  if (value.length === 0 || value.length > MAX_IDENTITY_CHARS) return false
  // A newline means we captured a textarea or a list, not a contact detail.
  if (/[\r\n]/.test(value)) return false

  switch (slot) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
    case 'phone':
      // Digits, spaces, and the usual punctuation — and enough digits to be a number.
      return /^[+()\d\s.-]{7,}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7
    case 'linkedin':
    case 'github':
    case 'website':
      try {
        const url = new URL(value)
        return url.protocol === 'https:' || url.protocol === 'http:'
      } catch {
        return false
      }
    case 'fullName':
    case 'preferredName':
      // A name is short and has no digits. "Yes" and "N/A" are not names either, but a
      // length floor is the most that can be said without guessing at naming conventions.
      return value.length <= 80 && !/\d/.test(value)
    default:
      return true
  }
}

/**
 * Folds a learned value into the identity, without overwriting.
 *
 * Same rule as ingest: what is already there was typed by the user or read from a document
 * they chose, and a value scraped off one form should not replace it. Filling blanks is the
 * whole benefit; overwriting would make every form the user fills a chance to corrupt their
 * profile with someone else's autofill.
 */
function applyToIdentity(
  identity: Identity,
  slot: string,
  value: string,
): Partial<Identity> | null {
  const trimmed = value.trim()
  if (trimmed === '') return null

  switch (slot) {
    case 'phone':
      return isBlank(identity.phone) ? { phone: trimmed } : null
    case 'email':
      return isBlank(identity.email) ? { email: trimmed } : null
    case 'location':
      return isBlank(identity.location) ? { location: trimmed } : null
    case 'pronouns':
      return isBlank(identity.pronouns) ? { pronouns: trimmed } : null
    case 'workAuthorization':
      return isBlank(identity.workAuthorization) ? { workAuthorization: trimmed } : null
    case 'fullName':
      return isBlank(identity.fullName) ? { fullName: trimmed } : null
    case 'preferredName':
      return isBlank(identity.preferredName) ? { preferredName: trimmed } : null
    case 'linkedin':
    case 'github':
    case 'website':
      return isBlank(identity.links[slot])
        ? { links: { ...identity.links, [slot]: trimmed } }
        : null
    default:
      // firstName and lastName are derived from fullName, never stored on their own — a
      // surname alone is not a value tier 0 can answer any field with.
      return null
  }
}

/** Whether this answer is a durable fact rather than prose — see the store list above. */
export function isDurableFact(entry: { kind?: string | undefined; accepted: string }): boolean {
  const value = entry.accepted.trim()
  if (value === '') return false

  const isChoice = entry.kind !== undefined && CHOICE_KINDS.has(entry.kind)

  if (value.length > (isChoice ? MAX_CHOICE_FACT_CHARS : MAX_TYPED_FACT_CHARS)) return false

  /**
   * A newline is the signature of a paragraph — but only in something the user typed.
   *
   * A multi-select of long options can legitimately arrive with line breaks in it, and there is
   * no paragraph anywhere in a list of checkboxes.
   */
  if (!isChoice && /[\r\n]/.test(value)) return false

  if (isChoice) return true

  // A text widget, or no widget at all — the review panel reports single answers without one.
  // Length has already done the work above; only a textarea is prose by declaration.
  return entry.kind !== 'longtext'
}

/**
 * Folds one answer into the learned list.
 *
 * **The newest answer wins**, which is the opposite of the identity rule, and deliberately so.
 * An identity value is a fact that does not change and a form is an untrusted source of it. A
 * preference is the user's current answer to a question they have now answered twice, and the
 * second time is the more recent truth — a stale "Android" that could never be corrected
 * would be worse than never having learned it.
 *
 * Re-answering also moves the row to the end, so the recency cap drops questions the user has
 * stopped seeing rather than ones they keep confirming.
 */
export function foldLearned(existing: LearnedAnswer[], incoming: LearnedAnswer[]): LearnedAnswer[] {
  const merged = [...existing]

  for (const entry of incoming) {
    const key = entry.question.toLowerCase()
    const at = merged.findIndex((row) => row.question.toLowerCase() === key)
    if (at !== -1) merged.splice(at, 1)
    merged.push(entry)
  }

  // Oldest first in the array, so the overflow to drop is at the front.
  return merged.slice(Math.max(0, merged.length - MAX_LEARNED_ANSWERS))
}

export async function recordFeedback(
  db: Db,
  env: Env,
  userId: string,
  payload: FeedbackRequest,
): Promise<number> {
  const entries = payload.entries.filter((entry) => entry.accepted.trim() !== '')
  if (entries.length === 0) return 0

  const stored = await getStructured(db, userId)
  const identity = stored.identity
  let patch: Partial<Identity> = {}
  const forLearned: LearnedAnswer[] = []
  const forMemory: typeof entries = []

  for (const entry of entries) {
    /**
     * Classified with the same context the fill had.
     *
     * Passing only the label defeats `NOT_ABOUT_APPLICANT`, which reads the section and hint
     * — so "Phone" under "Emergency contact" or "Reference" was being learned as the user's
     * own number and then autofilled onto every later form as theirs.
     */
    const slot = identitySlotFor({
      id: '',
      label: entry.label,
      kind: 'text',
      required: false,
      ...(entry.section ? { section: entry.section } : {}),
      ...(entry.hint ? { hint: entry.hint } : {}),
    } as FieldSchema)

    const update =
      slot && isPlausible(slot, entry.accepted.trim())
        ? applyToIdentity({ ...identity, ...patch }, slot, entry.accepted)
        : null

    /**
     * Anything that resolved to an identity slot stops here, applied or not.
     *
     * A contact detail is a fact, not prose. Sending it to memory as well would put a bare
     * phone number into the index that answers essay questions — and the `continue` used to
     * be inside the `if`, so exactly the values that were *rejected* for the profile were
     * the ones that leaked into memory instead.
     */
    if (slot) {
      if (update) patch = { ...patch, ...update }
      continue
    }

    const question = normalizeQuestion(entry.label, MAX_LEARNED_QUESTION_CHARS)

    /**
     * Short and constrained goes to the profile; prose goes to memory.
     *
     * This is the branch the product was missing. Everything non-identity used to go to
     * memory, where a dropdown answer — "iOS", "Social Media", "9" — was a chunk far too
     * small to be retrieved against a whole form's worth of labels. It was stored, reported
     * as learned, and never read again.
     */
    if (question !== '' && isDurableFact(entry)) {
      forLearned.push({
        question,
        answer: entry.accepted.trim(),
        ...(payload.origin ? { origin: payload.origin } : {}),
      })
      continue
    }

    /**
     * Confirmations are kept whatever their length.
     *
     * The length floor exists to stop unremarkable accepted answers diluting retrieval. A
     * confirmation is not that: the user was asked to check this one and said it was right,
     * which is exactly as deliberate as a correction.
     */
    if (entry.edited || entry.confirmed || entry.accepted.trim().length > 20) {
      forMemory.push(entry)
    }
  }

  const identityCount = Object.keys(patch).length

  /**
   * One profile write for both stores.
   *
   * `updateStructured` recompiles the prompt document and bumps the version, so issuing two
   * of them for one submission would compile twice, invalidate the extension's cached profile
   * twice, and race — the second read starting before the first write landed, silently
   * dropping whichever half lost.
   */
  const profileWrite =
    identityCount > 0 || forLearned.length > 0
      ? updateStructured(db, userId, {
          ...(identityCount > 0 ? { identity: patch as Identity } : {}),
          ...(forLearned.length > 0 ? { learned: foldLearned(stored.learned, forLearned) } : {}),
        })
      : null

  await Promise.all([
    profileWrite,
    ...forMemory.map((entry) =>
      rememberUserWriting(
        env,
        userId,
        entry.label,
        entry.accepted,
        payload.origin,
        // Both count as the user having decided; the metadata records which it was.
        entry.edited || entry.confirmed === true,
      ),
    ),
  ])

  return identityCount + forLearned.length + forMemory.length
}
