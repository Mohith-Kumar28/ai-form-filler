import type { FeedbackRequest } from '@aff/shared'

/**
 * Captures what the user actually submitted, after any edits.
 *
 * This is what makes the product compound: an edited answer is the highest-signal data the
 * system ever gets, because the user cared enough to correct us. Those corrections become
 * BM25 retrieval context and, later, the writing-voice exemplars.
 *
 * Read on submit rather than on every keystroke — mid-typing text is not an answer, and
 * an input listener on someone else's form is both noisy and invasive.
 */

export interface ProposedValue {
  fieldId: string
  label: string
  proposed: string
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

      entries.push({
        label: proposal.label,
        proposed: proposal.proposed,
        accepted,
        edited: accepted.trim() !== proposal.proposed.trim(),
      })
    }

    if (entries.length > 0) send({ origin, entries })

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
