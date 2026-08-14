import type { FeedbackRequest, FieldSchema, Identity } from '@aff/shared'
import type { Env } from '../env.js'
import { identitySlotFor } from '../router/classify.js'
import type { Db } from './account.js'
import { getStructured, updateStructured } from './profile.js'
import { rememberUserWriting } from './supermemory.js'

/**
 * The learning loop: what the user actually submitted goes back into what answers the form.
 *
 * **Two destinations, and the split is narrow on purpose.**
 *
 *   1. **Identity → the profile's typed slots.** Phone, email, name, location, links are
 *      answered by tier 0: a direct lookup, no model call, no retrieval. Retrieval returns
 *      passages, and a passage is not a value you can type into an email field — so this is the
 *      one thing a memory layer structurally cannot do for us. It is also a *fixed* nine-slot
 *      schema the user edits by hand, so it does not grow with use.
 *
 *   2. **Everything else → Supermemory.** Answers, choices, essays, preferences.
 *
 * There was briefly a third store: a `learned` table of question→answer pairs in the profile,
 * with its own exact-match lookup. It existed because short answers were not being retrieved —
 * a dropdown answer like "iOS" never came back, however often it was learned. That diagnosis
 * was wrong. The cause was the retrieval *query*: one search per form, built by concatenating
 * every field label, which is meaningless to an embedding index and returned passages near the
 * average of the form and specific to nothing. One search per question fixed it, and with that
 * fixed the third store was solving a problem that no longer existed — while costing a second
 * write path to keep in sync, a prompt block that grew with every submission, and a lookup that
 * only fired when a later form asked a question in byte-identical words.
 *
 * The rule that remains: an edit is the strongest signal the product receives, and it goes to
 * the one place that can find it again by meaning rather than by string equality.
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
 * is copied into the prompt of every future fill.
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

    /**
     * Everything else is remembered, whatever its length.
     *
     * There used to be a 20-character floor, to stop unremarkable answers diluting retrieval.
     * It was wrong twice over. These entries are *only* the values the user changed — the
     * capture reports nothing else — so an unremarkable one does not exist; and the answers it
     * discarded were exactly the short ones the product kept forgetting: "iOS", "10",
     * "Friend/Referral". Retrieval now runs one query per question, which is what makes a short
     * answer findable, so there is nothing left for a length rule to protect.
     */
    forMemory.push(entry)
  }

  const identityCount = Object.keys(patch).length

  await Promise.all([
    identityCount > 0 ? updateStructured(db, userId, { identity: patch as Identity }) : null,
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

  return identityCount + forMemory.length
}
