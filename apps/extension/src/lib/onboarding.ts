import { useCallback, useEffect, useState } from 'react'
import { readLocal, writeLocal } from './storage.js'

export const ONBOARDING_KEY = 'aff:onboarding'

/**
 * How far through the first run this browser profile got.
 *
 * `step` is persisted, not just `done`, because the panel closes constantly — it closes when the
 * user clicks back into their form, which is the *middle* of the step that asks them to type their
 * name. Coming back to step one, twice, is how a setup flow gets abandoned.
 */
export interface OnboardingRecord {
  done: boolean
  step: number
}

export type OnboardingStatus = 'loading' | 'running' | 'done'

export interface Resolved {
  status: OnboardingStatus
  step: number
  /** A record to persist, present only on the one render that decides a fresh install. */
  write?: OnboardingRecord
}

/**
 * Whether to run the first-run flow — as a function, so it can be tested without a renderer.
 *
 * @param record `undefined` while storage is still being read, `null` once read and empty.
 * @param hasContent Whether the account already holds facts or sources; `undefined` until the
 * profile has loaded.
 *
 * The `record === null` branch is the whole point. This flow shipped after the extension did, so
 * every existing user has no record and has already onboarded — and a tour that ends in "add your
 * first source", shown to somebody whose twelve sources sit behind it, is the product forgetting
 * them. So a fresh record is decided from the account's contents and then **written down**, which
 * is what keeps a user who skipped the flow from meeting it again on their next open.
 */
export function resolveOnboarding(
  record: OnboardingRecord | null | undefined,
  hasContent: boolean | undefined,
): Resolved {
  if (record === undefined) return { status: 'loading', step: 0 }

  if (record === null) {
    if (hasContent === undefined) return { status: 'loading', step: 0 }
    return {
      status: hasContent ? 'done' : 'running',
      step: 0,
      write: { done: hasContent, step: 0 },
    }
  }

  return { status: record.done ? 'done' : 'running', step: Math.max(0, record.step) }
}

export interface Onboarding {
  status: OnboardingStatus
  step: number
  go: (step: number) => void
  finish: () => void
  /** Puts the tour back at the start. Reachable from Account, for anyone who skipped it. */
  restart: () => void
}

/** The first-run flow's own memory. See `resolveOnboarding` for the decision it makes. */
export function useOnboarding(hasContent: boolean | undefined): Onboarding {
  const [record, setRecord] = useState<OnboardingRecord | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    void readLocal<OnboardingRecord>(ONBOARDING_KEY).then((stored) => {
      if (live) setRecord(stored)
    })
    return () => {
      live = false
    }
  }, [])

  const write = useCallback((next: OnboardingRecord) => {
    setRecord(next)
    void writeLocal(ONBOARDING_KEY, next)
  }, [])

  const resolved = resolveOnboarding(record, hasContent)

  // The one write this hook makes on its own: settling a fresh install into a stored record.
  useEffect(() => {
    if (resolved.write) write(resolved.write)
  }, [resolved.write, write])

  return {
    status: resolved.status,
    step: resolved.step,
    go: useCallback((step: number) => write({ done: false, step: Math.max(0, step) }), [write]),
    finish: useCallback(() => write({ done: true, step: 0 }), [write]),
    restart: useCallback(() => write({ done: false, step: 0 }), [write]),
  }
}
