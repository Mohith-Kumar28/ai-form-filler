import { useSyncExternalStore } from 'react'

/**
 * What the panel knows about verdicts already reached, held outside the React tree.
 *
 * It used to live in `ReviewPanel`'s component state, and the consequences shaped the whole old
 * panel: the review had to be rendered *above* the account gates so a failed background refetch
 * of `/v1/me` could not unmount it, and `useFill` had to ignore every progress event while
 * `done` so pressing Fill again would not silently revert every correction the user had made.
 * Both were workarounds for state living in the wrong place.
 *
 * ### It is a projection now, not a source
 *
 * The editing happens on the page, beside the question, in the answer card. So this no longer
 * holds edits in progress or write failures — it cannot fail to write anything, because it
 * writes nothing. It holds the verdicts the page has reported, purely so the receipt can show
 * what is left. The durable copy lives in `chrome.storage.session` beside the plan it belongs
 * to, which is why this dying with the panel stopped mattering.
 *
 * Keyed by tab so opening the panel on another page cannot show someone else's answers, for the
 * same reason `aff:lastFill` is.
 */

export type Verdict = 'open' | 'accepted' | 'edited' | 'cleared'

export interface ReviewDraft {
  /** The value the page settled on, for the receipt's one-line preview. */
  values: Record<string, string>
  verdicts: Record<string, Verdict>
}

const EMPTY: ReviewDraft = { values: {}, verdicts: {} }

const drafts = new Map<number, ReviewDraft>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDraft(tabId: number | null): ReviewDraft {
  if (tabId === null) return EMPTY
  return drafts.get(tabId) ?? EMPTY
}

function update(tabId: number, change: (draft: ReviewDraft) => ReviewDraft): void {
  drafts.set(tabId, change(drafts.get(tabId) ?? EMPTY))
  emit()
}

/**
 * Folds in a verdict the page reported.
 *
 * The only writer. `setValue`, `setError` and `revert` used to sit here for the panel's own
 * editor: one to hold the text mid-edit, one for when the page refused it, one to roll back.
 * All three went with the editor.
 */
export function applyVerdict(
  tabId: number,
  fieldId: string,
  verdict: Verdict,
  value: string,
): void {
  update(tabId, (draft) => ({
    values: { ...draft.values, [fieldId]: value },
    verdicts: { ...draft.verdicts, [fieldId]: verdict },
  }))
}

/** Seeds from session storage, so a reopened panel does not show settled answers as pending. */
export function hydrate(
  tabId: number,
  verdicts: Record<string, { verdict: string; value: string }>,
): void {
  update(tabId, (draft) => {
    const next: ReviewDraft = { values: { ...draft.values }, verdicts: { ...draft.verdicts } }
    for (const [fieldId, stored] of Object.entries(verdicts)) {
      next.verdicts[fieldId] = stored.verdict as Verdict
      next.values[fieldId] = stored.value
    }
    return next
  })
}

export function clearDraft(tabId: number | null): void {
  if (tabId === null) return
  drafts.delete(tabId)
  emit()
}

export function useReviewDraft(tabId: number | null): ReviewDraft {
  return useSyncExternalStore(
    subscribe,
    () => getDraft(tabId),
    () => EMPTY,
  )
}

/** Test seam. */
export function resetAll(): void {
  drafts.clear()
  emit()
}
