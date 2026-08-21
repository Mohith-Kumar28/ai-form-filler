import {
  type FeedbackRequest,
  type FieldSchema,
  type Identity,
  NEVER_LEARN,
  type Plan,
  readIntent,
} from '@aff/shared'
import type { Env } from '../env.js'
import { learningBudget } from '../middleware/quota.js'
import { identitySlotFor, isAboutApplicant } from '../router/classify.js'
import type { Db } from './account.js'
import {
  addRejection,
  answerHashOf,
  questionHashFor,
  readPointers,
  writePointer,
} from './learned-store.js'
import { getStructured, updateStructured } from './profile.js'
import {
  addContent,
  deleteDocument,
  type LearnedShape,
  learnedDocument,
  patchDocument,
} from './supermemory.js'

/**
 * The learning loop: what the user actually submitted goes back into what answers the form.
 *
 * **Three destinations, and the split is narrow on purpose.**
 *
 *   1. **Identity → the profile's typed slots.** Phone, email, name, location, links are
 *      answered by tier 0: a direct lookup, no model call, no retrieval. Retrieval returns
 *      passages, and a passage is not a value you can type into an email field — so this is the
 *      one thing a memory layer structurally cannot do for us. It is also a *fixed* nine-slot
 *      schema the user edits by hand, so it does not grow with use.
 *
 *   2. **Everything else → Supermemory.** Answers, choices, essays, preferences. Written as
 *      one of three shapes, because the shape decides whether the answer is findable again:
 *      prose is self-describing, a choice needs the option set it was picked from, and a
 *      boolean has to spell itself out in words. An embedding of the bare token "No" matches
 *      everything and retrieves nothing, so a declined checkbox was re-asked and re-guessed on
 *      every later form.
 *
 *   3. **Rejections → nowhere retrievable.** Clearing an answer is the second-strongest signal
 *      the product gets, and it used to be discarded entirely. It is now kept as a short
 *      per-question "not this" list in `learned-store.ts`, stated to the model as an
 *      instruction rather than retrieved as material — which is the distinction that makes it
 *      safe to keep at all.
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
 *
 * ### What `learned_pointers` is, and is not
 *
 * There is a local table again, and it is deliberately not the one described above. It holds no
 * answer — only a Supermemory document id, a one-way digest of the answer, and the values the
 * user rejected. Its two jobs are the two things the story above could not do: *replace* a
 * superseded answer instead of appending a second document that contradicts it, and remember
 * that an answer was rejected without putting "this was wrong" into the index that answers the
 * next question. It is never read to answer anything, there is no column that could be, and a
 * test asserts the answering paths do not import it.
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

type Entry = FeedbackRequest['entries'][number]

/** Where one reported answer belongs. `drop` is a decision, not a failure. */
type Destination = 'identity' | LearnedShape | 'drop'

/**
 * Answers whose *shape* betrays a secret, whatever the label said.
 *
 * Detection already refuses to fill password, OTP and card fields, and `NEVER_LEARN` catches
 * the labels. This is the third layer, and it earns its place because the first two read the
 * page while this reads the answer: a field labelled "Employee reference" that the user filled
 * with a 16-digit number is not something we should be holding, whatever it was called.
 */
export function looksSecret(entry: Entry): boolean {
  const answer = entry.accepted.trim()
  // A run of 13-19 digits, ignoring the spaces and dashes people type into card fields.
  if (/^\d{13,19}$/.test(answer.replace(/[\s-]/g, ''))) return true
  // A short all-digit answer to a question about a code is a code.
  if (/^\d{4,8}$/.test(answer) && /\b(code|otp|pin|verification|token)\b/i.test(entry.label)) {
    return true
  }
  return false
}

/**
 * The destination for one entry, as a single decision.
 *
 * This used to be three `continue`s in a loop, and the bug that motivated collecting it here is
 * instructive: the identity path correctly refused to store an emergency contact's phone
 * number, and the entry then fell through to the *memory* write, so a stranger's number became
 * a retrievable passage in the index that answers every later question. The check worked and
 * made things worse. With one function returning one destination, "refused by the profile" can
 * no longer silently mean "accepted by memory".
 */
export function destinationFor(entry: Entry, slot: string | undefined): Destination {
  const haystack = `${entry.label} ${entry.section ?? ''} ${entry.hint ?? ''}`

  // Not this person's data. Dropped from *both* stores, which is the fix described above.
  if (!isAboutApplicant(haystack)) return 'drop'
  if (NEVER_LEARN.test(haystack)) return 'drop'
  if (looksSecret(entry)) return 'drop'

  if (slot) return 'identity'

  switch (entry.kind) {
    case 'checkbox':
      /**
       * A yes/no question, but only if the answer reads as yes or no.
       *
       * A checkbox whose answer is neither — free text in a checkbox-shaped widget, or an
       * answer the model invented — is stored as prose rather than asserted as a boolean. We
       * would otherwise have to pick a side, and picking wrong states the opposite of what the
       * user chose.
       */
      return readIntent(entry.accepted) === null ? 'prose' : 'boolean'
    case 'select':
    case 'radio':
    case 'multiselect':
      return 'choice'
    default:
      return 'prose'
  }
}

/**
 * Whether this entry is allowed to *replace* an answer we already hold for the question.
 *
 * Only the user's own words are. This is the fix for a real and quiet data loss, visible in the
 * Supermemory console as a memory tagged `replaced`:
 *
 *   1. The user extends our answer with something they care about — "aiming to onboard 1,000
 *      users in the next three months". `edited: true`. The document is written; the memory is
 *      extracted. Correct so far.
 *   2. They clear the form and fill it again. The model, not yet having that answer back from
 *      the index, writes a generic paragraph.
 *   3. They press **Keep** on the card. That reports `confirmed: true, edited: false` — and it
 *      took the same write path as an edit, so it PATCHed the document, replacing their
 *      sentence with our generation. The answer they typed was gone, and the next fill could
 *      never retrieve it, because it no longer existed.
 *
 * A confirmation carries real signal — an inference the model got right is otherwise thrown
 * away entirely — but it says only "what you wrote is acceptable". It is *our* text. It cannot
 * outrank theirs, and it must never overwrite it. So a confirmation may create the first
 * document for a question and may refresh one whose answer it matches, and nothing else.
 */
export function mayReplaceStored(entry: Entry, hasStored: boolean): boolean {
  return entry.edited === true || !hasStored
}

/**
 * Records what the user actually submitted.
 *
 * Three destinations now, where there were two:
 *
 *   1. **Identity → the profile's typed slots.** Unchanged, and still the one thing a memory
 *      layer structurally cannot do for us — see the note at the top of this file.
 *   2. **Answers → Supermemory, upserted.** A superseded answer is *replaced* rather than
 *      appended beside the answer it contradicts, which is what the pointer table exists for.
 *      An identical re-teach costs nothing at all: no PATCH, no POST, no tokens.
 *   3. **Rejections → the pointer table only.** Never a document. See `addRejection`.
 */
export async function recordFeedback(
  db: Db,
  env: Env,
  userId: string,
  /** Decides the day's learning budget — see `learningBudget`. */
  plan: Plan,
  payload: FeedbackRequest,
): Promise<number> {
  const now = Math.floor(Date.now() / 1000)

  // A blank `accepted` is only meaningful as a rejection. Dropping every blank on arrival is
  // what used to make clearing an answer teach nothing at all.
  const entries = payload.entries.filter(
    (entry) => entry.rejected === true || entry.accepted.trim() !== '',
  )
  if (entries.length === 0) return 0

  const identity = (await getStructured(db, userId)).identity
  let patch: Partial<Identity> = {}

  const rejections: { entry: Entry; shape: LearnedShape }[] = []
  const learnable: { entry: Entry; shape: LearnedShape }[] = []

  for (const entry of entries) {
    /**
     * Classified with the same context the fill had, and now with the same *kind*.
     *
     * `kind` was hardcoded to `'text'` here, which silently disabled `identitySlotFor`'s typed
     * fallbacks — an `email` input whose label said something unusual, or a `tel` input, was
     * classified as if it were free text and its value went to memory instead of the profile,
     * where tier 0 could never reach it. The schema has documented `kind` as deciding storage
     * since it was added; it just was not being read.
     */
    const slot = identitySlotFor({
      id: '',
      label: entry.label,
      kind: entry.kind ?? 'text',
      required: false,
      ...(entry.section ? { section: entry.section } : {}),
      ...(entry.hint ? { hint: entry.hint } : {}),
    } as FieldSchema)

    const destination = destinationFor(entry, slot)
    if (destination === 'drop') continue

    /**
     * A rejection is recorded whatever the destination would have been.
     *
     * Including for identity fields. It costs one row and it is never consulted for a field
     * tier 0 can answer, so the user's own typed profile value always wins over something they
     * cleared on somebody else's form.
     */
    if (entry.rejected === true) {
      rejections.push({ entry, shape: destination === 'identity' ? 'prose' : destination })
      continue
    }

    if (destination === 'identity') {
      const update =
        slot && isPlausible(slot, entry.accepted.trim())
          ? applyToIdentity({ ...identity, ...patch }, slot, entry.accepted)
          : null
      if (update) patch = { ...patch, ...update }
      continue
    }

    learnable.push({ entry, shape: destination })
  }

  const identityCount = Object.keys(patch).length

  /**
   * Keys for the whole batch, then one lookup for all of them.
   *
   * `origin` is part of the key for prose and not for choices; `questionHashFor` explains why
   * that asymmetry is the point rather than an inconsistency.
   */
  const keyed = await Promise.all(
    learnable.map(async ({ entry, shape }) => ({
      entry,
      shape,
      questionHash: await questionHashFor(entry.label, {
        section: entry.section,
        ...(shape === 'prose' ? { origin: payload.origin } : {}),
      }),
      answerHash: await answerHashOf(entry.accepted),
    })),
  )

  // One form can ask the same question twice. The later answer wins; writing both would race
  // for the same row and leave whichever finished last, at random.
  const byKey = new Map(keyed.map((item) => [item.questionHash, item]))
  const pointers = await readPointers(db, userId, [...byKey.keys()])

  /**
   * Entries we already hold cost nothing, so they are not counted against the day's budget.
   *
   * Ordering matters here: asking for budget before checking the pointers would spend the
   * allowance on answers we were about to skip, and a user who fills the same form twice would
   * exhaust their own learning on the second pass without teaching anything new.
   */
  const fresh = [...byKey.values()].filter((item) => {
    const pointer = pointers.get(item.questionHash)
    if (pointer?.answerHash === item.answerHash && pointer.memoryId) return false
    // Charging the budget for a write that `mayReplaceStored` is about to refuse would spend a
    // user's learning on nothing at all.
    return mayReplaceStored(item.entry, pointer?.memoryId != null)
  })

  const allowed = await learningBudget(env, userId, plan, fresh.length)
  const budgeted = new Set(fresh.slice(0, allowed).map((item) => item.questionHash))

  const written = await Promise.all(
    [...byKey.values()].map(async (item) => {
      if (!budgeted.has(item.questionHash)) return false
      const pointer = pointers.get(item.questionHash)

      /**
       * The same answer again — the durable dedup, and the reason it lives on the server rather
       * than in the client's memory: it survives a page reload, a new session, and a second
       * device, none of which the extension's own "already taught" map does.
       *
       * Checked twice on purpose. The filter above needs it to decide what to charge the
       * budget for, and repeating it here means a future edit to that filter cannot turn into a
       * duplicate write.
       */
      if (pointer?.answerHash === item.answerHash && pointer.memoryId) return false

      /**
       * A confirmation never overwrites a stored answer. See `mayReplaceStored` — this is the
       * check that stops our own generated paragraph replacing the sentence the user typed.
       *
       * Checked here as well as in the budget filter above, for the same reason the duplicate
       * check is: a future edit to that filter must not be able to turn into a lost answer.
       */
      if (!mayReplaceStored(item.entry, pointer?.memoryId != null)) return false

      const boolean = item.shape === 'boolean' ? readIntent(item.entry.accepted) : null
      const answer = item.shape === 'boolean' ? (boolean ? 'Yes' : 'No') : item.entry.accepted

      const { content, metadata } = learnedDocument({
        shape: item.shape,
        question: item.entry.label,
        answer,
        ...(item.entry.options ? { options: item.entry.options } : {}),
        origin: payload.origin,
        // Both count as the user having decided; the metadata records which it was.
        edited: item.entry.edited || item.entry.confirmed === true,
        ...(boolean !== null ? { boolean } : {}),
      })

      let memoryId = pointer?.memoryId ?? null

      if (memoryId) {
        // Replace in place. Appending a second document is not a milder version of this — it
        // is the stale-contradiction bug.
        const replaced = await patchDocument(env, memoryId, { content, metadata })
        if (!replaced) {
          await deleteDocument(env, memoryId)
          memoryId = await addContent(env, userId, content, metadata, {
            customId: `q_${item.questionHash}`,
          })
        }
      } else {
        memoryId = await addContent(env, userId, content, metadata, {
          customId: `q_${item.questionHash}`,
        })
      }

      /**
       * Pointer last, always.
       *
       * A row naming a document that was never created is worse than no row: the next edit
       * would try to PATCH something absent. And because a null `memoryId` also stores a null
       * `answerHash`, a memory outage leaves the question looking untaught, so the next edit
       * retries it as a create rather than skipping it as a duplicate.
       */
      await writePointer(db, userId, {
        questionHash: item.questionHash,
        question: item.entry.label,
        memoryId,
        answerHash: memoryId ? item.answerHash : null,
        answer,
        now,
      })

      return memoryId !== null
    }),
  )

  await Promise.all([
    identityCount > 0 ? updateStructured(db, userId, { identity: patch as Identity }) : null,
    ...rejections.map(async ({ entry, shape }) =>
      addRejection(db, userId, {
        questionHash: await questionHashFor(entry.label, {
          section: entry.section,
          ...(shape === 'prose' ? { origin: payload.origin } : {}),
        }),
        question: entry.label,
        value: entry.proposed ?? '',
        now,
      }),
    ),
  ])

  return identityCount + written.filter(Boolean).length + rejections.length
}
