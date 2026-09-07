/**
 * One editor over the saved details, shared by every screen that changes them.
 *
 * Three screens edit the profile — the details list, first-run setup, and the inline "Add" on
 * the page ledger — and they must save the same way: a draft that settles after a pause, flushes
 * on blur, and never queues more than one PATCH behind the one in flight. Each PATCH recompiles
 * the prompt document server-side, so a fast typist sending one per keystroke is a real cost.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getGetAccountQueryKey } from '../generated/endpoints/account/account.js'
import { getGetProfileQueryKey, usePatchProfile } from '../generated/endpoints/profile/profile.js'
import type { Profile } from '../generated/model/index.js'
import { type ReconciledProfile, reconcile, toPatch } from './fact-catalog.js'

const SETTLE_MS = 1500
const SAVED_MS = 1600

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export const EMPTY_DRAFT: ReconciledProfile = {
  values: {},
  extras: {},
  extraLinks: {},
  droppedLinks: [],
  merged: [],
}

export interface ProfileEditor {
  draft: ReconciledProfile
  status: SaveStatus
  error: string | undefined
  /** A catalogue field, by its canonical key. */
  setValue: (key: string, value: string) => void
  /** The user's own field. */
  setExtra: (key: string, value: string) => void
  /** Refile the user's own field under a different name, keeping its value and its place. */
  renameExtra: (from: string, to: string) => void
  removeExtra: (key: string) => void
  /** A link platform the catalogue does not know. Cleared rather than deleted — see `toPatch`. */
  setExtraLink: (key: string, value: string) => void
  /** Save now, if anything changed. Called on blur and Enter. */
  commit: () => void
  retry: () => void
}

export function useProfileEditor(profile: Profile | undefined): ProfileEditor {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ReconciledProfile>(EMPTY_DRAFT)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | undefined>()

  const inFlight = useRef(false)
  const pending = useRef<ReconciledProfile | null>(null)
  const dirty = useRef(false)
  const hydrated = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(draft)
  latest.current = draft

  const patch = usePatchProfile()
  // `mutateAsync` off a ref: the hook returns a new object on every state transition, and a
  // callback that closed over it would change identity mid-save.
  const mutateRef = useRef(patch.mutateAsync)
  mutateRef.current = patch.mutateAsync

  const flush = useCallback(
    (next: ReconciledProfile) => {
      if (inFlight.current) {
        pending.current = next
        return
      }
      inFlight.current = true
      setStatus('saving')
      setError(undefined)
      mutateRef
        .current({ data: toPatch(next) })
        .then((updated) => {
          queryClient.setQueryData(getGetProfileQueryKey(), updated)
          void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
          dirty.current = false
          setStatus('saved')
        })
        .catch((cause: Error) => {
          setStatus('error')
          setError(cause.message)
        })
        .finally(() => {
          inFlight.current = false
          const queued = pending.current
          pending.current = null
          if (queued) flush(queued)
        })
    },
    [queryClient],
  )

  useEffect(() => {
    if (status !== 'saved') return
    const timer = setTimeout(() => setStatus('idle'), SAVED_MS)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => () => clearTimeout(settleTimer.current), [])

  /*
    Take the server's copy once, then only when a save has landed and nothing is being typed.
    A profile with duplicate spellings is repaired here too: `reconcile` folds them and the fold
    is written straight back, so the duplicates stop reaching the model.
  */
  useEffect(() => {
    if (!profile) return
    if (hydrated.current && (dirty.current || inFlight.current)) return
    hydrated.current = true
    const next = reconcile(profile)
    setDraft(next)
    if (next.merged.length > 0) {
      dirty.current = true
      flush(next)
    }
  }, [profile, flush])

  /*
    Edits go through the functional updater so they land on top of whatever React has queued —
    including the hydration above, when a screen seeds a value in the same tick the profile
    arrives. The timer reads `latest` when it fires rather than a value captured now, for the
    same reason.
  */
  const edit = useCallback(
    (change: (current: ReconciledProfile) => ReconciledProfile) => {
      setDraft((current) => {
        const next = change(current)
        latest.current = next
        return next
      })
      dirty.current = true
      clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(() => flush(latest.current), SETTLE_MS)
    },
    [flush],
  )

  return {
    draft,
    status,
    error,
    setValue: useCallback(
      (key, value) => edit((c) => ({ ...c, values: { ...c.values, [key]: value } })),
      [edit],
    ),
    setExtra: useCallback(
      (key, value) => edit((c) => ({ ...c, extras: { ...c.extras, [key]: value } })),
      [edit],
    ),
    renameExtra: useCallback(
      (from, to) =>
        edit((c) => {
          if (from === to || !(from in c.extras)) return c
          // Rebuilt in order rather than deleted and re-added, so a renamed detail does not
          // jump to the bottom of the list while the person is looking at it.
          const extras: Record<string, string> = {}
          for (const [key, value] of Object.entries(c.extras)) {
            if (key === from) extras[to] = value
            else extras[key] = value
          }
          return { ...c, extras }
        }),
      [edit],
    ),
    removeExtra: useCallback(
      (key) =>
        edit((c) => {
          const extras = { ...c.extras }
          delete extras[key]
          return { ...c, extras }
        }),
      [edit],
    ),
    setExtraLink: useCallback(
      (key, value) => edit((c) => ({ ...c, extraLinks: { ...c.extraLinks, [key]: value } })),
      [edit],
    ),
    commit: useCallback(() => {
      if (!dirty.current) return
      clearTimeout(settleTimer.current)
      flush(latest.current)
    }, [flush]),
    retry: useCallback(() => flush(latest.current), [flush]),
  }
}
