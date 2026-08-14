import { useSyncExternalStore } from 'react'

/**
 * Review edits, held outside the React tree and keyed by tab.
 *
 * They used to live in `ReviewPanel`'s component state, and the consequences shaped the whole
 * old panel: the review had to be rendered *above* the account gates so a failed background
 * refetch of `/v1/me` could not unmount it, and `useFill` had to ignore every progress event
 * while `done` so pressing Fill again would not silently revert every correction the user had
 * made. Both of those were workarounds for state living in the wrong place.
 *
 * Keyed by tab so opening the panel on another page cannot show someone else's corrections,
 * for the same reason `aff:lastFill` is.
 */

export type Verdict = 'open' | 'accepted' | 'edited' | 'cleared'

export interface ReviewDraft {
  /** Only fields the user actually touched. Absent means "still the model's answer". */
  values: Record<string, string>
  verdicts: Record<string, Verdict>
  /** Set when the page refused a write, so the row can say so instead of silently reverting. */
  errors: Record<string, string>
}

const EMPTY: ReviewDraft = { values: {}, verdicts: {}, errors: {} }

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

export function setValue(tabId: number, fieldId: string, value: string): void {
  update(tabId, (draft) => ({ ...draft, values: { ...draft.values, [fieldId]: value } }))
}

export function setVerdict(tabId: number, fieldId: string, verdict: Verdict): void {
  update(tabId, (draft) => ({ ...draft, verdicts: { ...draft.verdicts, [fieldId]: verdict } }))
}

export function setError(tabId: number, fieldId: string, message: string | null): void {
  update(tabId, (draft) => {
    const errors = { ...draft.errors }
    if (message === null) delete errors[fieldId]
    else errors[fieldId] = message
    return { ...draft, errors }
  })
}

/** Drops a field's edit entirely — used when the page rejects a write and we roll back. */
export function revert(tabId: number, fieldId: string): void {
  update(tabId, (draft) => {
    const values = { ...draft.values }
    const verdicts = { ...draft.verdicts }
    delete values[fieldId]
    delete verdicts[fieldId]
    return { ...draft, values, verdicts }
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
