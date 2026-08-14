import type { FeedbackRequest, FieldSchema, Identity } from '@aff/shared'
import type { Env } from '../env.js'
import { identitySlotFor } from '../router/classify.js'
import type { Db } from './account.js'
import { getStructured, updateStructured } from './profile.js'
import { rememberUserWriting } from './supermemory.js'

/**
 * The learning loop: what the user actually submitted goes back into what answers the form.
 *
 * Which store that is depends on the field, and getting this wrong is why a phone number the
 * user typed on one form was still missing on the next.
 *
 *   - **Identity fields go into the profile.** Phone, email, name, location, links are
 *     answered by tier 0 — a direct lookup with no model call and no retrieval at all. A
 *     value that only ever reached memory could not be found by that path no matter how
 *     often it was learned, because tier 0 never searches. It reads `identity.phone`.
 *   - **Everything else goes into memory**, where semantic retrieval can find it against a
 *     question worded differently on the next form.
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

export async function recordFeedback(
  db: Db,
  env: Env,
  userId: string,
  payload: FeedbackRequest,
): Promise<number> {
  const entries = payload.entries.filter((entry) => entry.accepted.trim() !== '')
  if (entries.length === 0) return 0

  const identity = (await getStructured(db, userId)).identity
  let patch: Partial<Identity> = {}
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

    // Short answers that are not identity carry no reusable voice; long ones do.
    /**
     * Confirmations are kept whatever their length.
     *
     * The length floor exists to stop unremarkable accepted answers diluting retrieval. A
     * confirmation is not that: the user was asked to check this one and said it was right,
     * which is exactly as deliberate as a correction — and the answers most often flagged
     * for checking are short ones ("9", "Social Media"), which the floor would discard.
     */
    if (entry.edited || entry.confirmed || entry.accepted.trim().length > 20) {
      forMemory.push(entry)
    }
  }

  const learnedIdentity = Object.keys(patch).length

  await Promise.all([
    learnedIdentity > 0 ? updateStructured(db, userId, { identity: patch as Identity }) : null,
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

  return learnedIdentity + forMemory.length
}
