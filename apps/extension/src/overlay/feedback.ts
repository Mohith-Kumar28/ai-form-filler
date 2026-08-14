import type { FeedbackRequest } from '@aff/shared'

/**
 * Captures what the user actually submitted, after any edits.
 *
 * This is what makes the product compound: an edited answer is the highest-signal data the
 * system ever gets, because the user cared enough to correct us. Those corrections go into
 * memory and are retrieved the next time a similar question is asked.
 *
 * Read on submit rather than on every keystroke — mid-typing text is not an answer, and an
 * input listener on someone else's form is both noisy and invasive. Submit is also the only
 * moment the user has declared the values final.
 *
 * **Only differences are reported.** An answer kept exactly as proposed teaches nothing that
 * memory does not already contain, and sending one per field per form would fill a user's
 * memory with restatements of itself and make retrieval worse over time.
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
   * Carried so the server can tell whose details these are.
   *
   * "Phone" under "Emergency contact" is not the user's phone, and the classifier can only
   * see that if the section travels with the answer.
   */
  section?: string
  hint?: string
}

export interface FeedbackCapture {
  /** Call when the fill completes, to record what we proposed and where. */
  arm: (proposals: ProposedValue[], readValue: (fieldId: string) => string | null) => void
  disarm: () => void
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
  let read: ((fieldId: string) => string | null) | null = null
  let armed = false

  const collect = () => {
    if (!armed || !read) return

    const entries: FeedbackRequest['entries'] = []

    for (const proposal of proposals) {
      const accepted = read(proposal.fieldId)
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
      if (accepted.trim() === proposal.proposed.trim()) continue

      entries.push({
        label: proposal.label,
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

  return {
    arm: (nextProposals, readValue) => {
      proposals = nextProposals
      read = readValue
      armed = true
      document.addEventListener('submit', onSubmit, { capture: true, passive: true })
      window.addEventListener('pagehide', onPageHide)
    },
    disarm: () => {
      armed = false
      document.removeEventListener('submit', onSubmit, { capture: true })
      window.removeEventListener('pagehide', onPageHide)
    },
  }
}

/** Reads the current value of a field, whatever kind of control it is. */
export function readFieldValue(element: HTMLElement): string | null {
  if (element instanceof HTMLSelectElement) {
    // The visible label, not the opaque option value — "United States" is what carries
    // meaning back into the answer bank, "opt_1" is not.
    return element.selectedOptions[0]?.text.trim() ?? null
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      return element.checked ? element.value || 'yes' : null
    }
    return element.value
  }
  if (element instanceof HTMLTextAreaElement) return element.value
  if (element.isContentEditable) return element.textContent
  return null
}
