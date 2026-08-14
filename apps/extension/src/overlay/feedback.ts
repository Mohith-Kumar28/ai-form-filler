import type { FeedbackRequest, FieldKind, FieldSchema } from '@aff/shared'

/**
 * Captures what the user actually submitted, after any edits.
 *
 * This is what makes the product compound: an edited answer is the highest-signal data the
 * system ever gets, because the user cared enough to correct us. Those corrections go back
 * into the profile and into memory, and answer the same question on the next form.
 *
 * Read on submit rather than on every keystroke — mid-typing text is not an answer, and an
 * input listener on someone else's form is both noisy and invasive. Submit is also the only
 * moment the user has declared the values final.
 *
 * **Only differences are reported.** An answer kept exactly as proposed teaches nothing that
 * the profile does not already contain, and sending one per field per form would fill a user's
 * memory with restatements of itself and make retrieval worse over time.
 *
 * Reading the page is **not** this module's job — see `FormAdapter.readValue`. It used to be,
 * via a helper that understood native controls only, and every ARIA widget on Google Forms
 * read as unanswered.
 */

/**
 * Ceiling on what one submission may teach.
 *
 * A long form with many corrections is still one event in the user's life, and letting a
 * single submit write dozens of memories would let one unusual form dominate everything
 * retrieved afterwards. Longest answers win the cap: a corrected essay carries far more
 * reusable voice than a corrected postcode.
 */
const MAX_LEARNED_PER_SUBMIT = 12

export interface ProposedValue {
  fieldId: string
  label: string
  /** What we wrote. Empty for a field we left blank but are still watching. */
  proposed: string
  /**
   * The widget kind, forwarded so the server can tell a constrained choice from prose.
   *
   * A dropdown answer is a durable fact about this person ("iOS", "Bengaluru") and belongs in
   * the profile, where it is read deterministically. An essay is voice and belongs in
   * semantic memory. Without the kind the server has only the answer's length to guess with.
   */
  kind?: FieldKind
  /**
   * Carried so the server can tell whose details these are.
   *
   * "Phone" under "Emergency contact" is not the user's phone, and the classifier can only
   * see that if the section travels with the answer.
   */
  section?: string
  hint?: string
}

/**
 * How this module reaches the page. Both halves are the caller's, because both need the
 * adapter and the live element map, and neither belongs in a submit listener.
 */
export interface PageReader {
  /** The field's current answer, via the adapter that wrote it. */
  read: (fieldId: string) => string | null
  /**
   * Whether the field is still in the document.
   *
   * Separates the two reasons a field reads as empty, which mean opposite things. A field the
   * user *cleared* is a rejection and must be dropped. A field the page *replaced* — every
   * question on page one of a multi-page Google Form, once "Next" is clicked — was answered
   * and then taken away, and dropping those loses most of a long form's answers.
   */
  isAlive: (fieldId: string) => boolean
}

export interface FeedbackCapture {
  /** Call when the fill completes, to record what we proposed and where. */
  arm: (proposals: ProposedValue[], page: PageReader) => void
  disarm: () => void
}

/**
 * What we proposed, in the words the page displays.
 *
 * The model answers a choice field with an option's `value`, while a widget reads back the
 * `label` a human sees — so on any form where the two differ ("US" vs "United States", or
 * Google's generated data-values), an untouched answer looked like an edit. That reported a
 * correction the user never made, and taught the answer to itself on every submit.
 */
export function displayValueOf(field: Pick<FieldSchema, 'options'>, value: string): string {
  if (!field.options || field.options.length === 0 || value === '') return value

  const labelFor = (token: string): string => {
    const wanted = token.trim().toLowerCase()
    const match = field.options?.find(
      (option) =>
        option.value.trim().toLowerCase() === wanted ||
        option.label.trim().toLowerCase() === wanted,
    )
    return match ? match.label : token.trim()
  }

  // The whole answer first: option labels contain commas ("Yes, I agree"), and splitting
  // before trying it turns one option into fragments that match nothing.
  const whole = labelFor(value)
  if (whole !== value.trim()) return whole

  return value.split(',').map(labelFor).filter(Boolean).join(', ')
}

/** Comparable form of an answer: case, spacing, and selection order all carry no meaning. */
function canonical(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .sort()
    .join(',')
}

/**
 * Watches for the form being submitted, then reports the final values.
 *
 * Listens in the **capture** phase so the values are read before any handler can reset the
 * form, and passively so submission is never delayed or blocked by this.
 */
export function createFeedbackCapture(
  origin: string,
  send: (payload: FeedbackRequest) => void,
): FeedbackCapture {
  let proposals: ProposedValue[] = []
  let page: PageReader | null = null
  let armed = false

  /**
   * The last committed answer seen for each field, kept against the page destroying it.
   *
   * A multi-page form is one submission from the user's point of view and several DOMs from
   * ours: clicking "Next" on a Google Form replaces every question, so by the time anything
   * submits, page one reads as empty and would teach nothing. Snapshotting on commit keeps
   * those answers, and they are used *only* when the field is gone — a field still on the page
   * and now empty was deliberately cleared, which is a rejection.
   */
  const snapshot = new Map<string, string>()

  const takeSnapshot = () => {
    if (!armed || !page) return
    for (const proposal of proposals) {
      const value = page.read(proposal.fieldId)
      if (value !== null && value.trim() !== '') snapshot.set(proposal.fieldId, value)
    }
  }

  const collect = () => {
    if (!armed || !page) return

    const entries: FeedbackRequest['entries'] = []

    for (const proposal of proposals) {
      const live = page.read(proposal.fieldId)
      const accepted =
        live === null && !page.isAlive(proposal.fieldId)
          ? (snapshot.get(proposal.fieldId) ?? null)
          : live

      // A field the user cleared is a rejection, not an answer worth learning from.
      if (accepted === null || accepted.trim() === '') continue

      /**
       * Only what the user changed.
       *
       * Two cases count, and they are the same event from memory's point of view — the user
       * supplied this, not us. Either they corrected an answer we wrote, or they filled a
       * field we left blank, which is the phone-number case: we had no value, they typed
       * one, and next time we should know it.
       */
      if (canonical(accepted) === canonical(proposal.proposed)) continue

      entries.push({
        label: proposal.label,
        ...(proposal.kind ? { kind: proposal.kind } : {}),
        ...(proposal.section ? { section: proposal.section } : {}),
        ...(proposal.hint ? { hint: proposal.hint } : {}),
        proposed: proposal.proposed,
        accepted,
        edited: true,
      })
    }

    // Longest first, then capped — see MAX_LEARNED_PER_SUBMIT.
    const learned = entries
      .sort((a, b) => b.accepted.length - a.accepted.length)
      .slice(0, MAX_LEARNED_PER_SUBMIT)

    if (learned.length > 0) send({ origin, entries: learned })

    // One report per fill. Re-submitting the same form should not double-count answers.
    armed = false
  }

  const onSubmit = () => collect()

  /**
   * Many real forms submit via a click handler and `fetch` rather than a native submit
   * event, so a submit listener alone misses them. `pagehide` covers navigation away,
   * including the case where submission succeeded and redirected.
   */
  const onPageHide = () => collect()

  /**
   * The last reliable moment on a navigating page.
   *
   * Google Forms submits with a `role="button"` div, so no native `submit` event fires at
   * all, and `pagehide` on a page already tearing down is a poor place to start a
   * `sendMessage`. `visibilitychange → hidden` is the one callback the platform guarantees to
   * run before that, which is why beacons are sent from it. Whichever fires first wins;
   * `collect` disarms itself, so the others become no-ops.
   */
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') collect()
  }

  return {
    arm: (nextProposals, pageReader) => {
      proposals = nextProposals
      page = pageReader
      armed = true
      snapshot.clear()

      document.addEventListener('submit', onSubmit, { capture: true, passive: true })
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('pagehide', onPageHide)

      /**
       * Two commit signals, because one widget layer per event.
       *
       * `change` is what native controls fire when a value settles — on blur for text, on
       * selection for checkboxes and selects. Google's ARIA widgets are divs and fire it
       * *never*, so a click is the only evidence they were touched. Both listen in the capture
       * phase, which is what makes the "Next" case work: the snapshot runs before the page's
       * own handler tears the questions down.
       */
      document.addEventListener('change', takeSnapshot, { capture: true, passive: true })
      document.addEventListener('click', takeSnapshot, { capture: true, passive: true })
    },
    disarm: () => {
      armed = false
      snapshot.clear()
      document.removeEventListener('submit', onSubmit, { capture: true })
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('change', takeSnapshot, { capture: true })
      document.removeEventListener('click', takeSnapshot, { capture: true })
    },
  }
}
