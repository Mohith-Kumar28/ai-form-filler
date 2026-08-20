import {
  type ApiError,
  type ApplyReport,
  FILL_PORT,
  type FillPlan,
  type FillPortEvent,
  type FillPortRequest,
} from '@aff/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getGetAccountQueryKey } from '../generated/endpoints/account/account.js'
import { applyVerdict, clearDraft, hydrate, type Verdict } from './review-store.js'

/**
 * Extracted with `Extract` rather than a bare conditional: `FillPortEvent extends {...}` tests
 * the whole union at once and resolves to `never`, so `stage` would silently become
 * `undefined`. `Extract` distributes over the union and picks the progress arm.
 */
type FillStage = Extract<FillPortEvent, { type: 'progress' }>['stage']

export interface FillState {
  status: 'idle' | 'running' | 'done' | 'error'
  stage?: FillStage
  /** Per-stage counters, so "Filling the form" can show 7/12 rather than a bare label. */
  stageDone?: number
  stageTotal?: number
  plan?: FillPlan
  report?: ApplyReport
  error?: ApiError
  /** Which tab this result belongs to. Keys the review draft and guards cross-tab bleed. */
  tabId?: number
}

/**
 * Drives a fill over the port protocol.
 *
 * Not a TanStack mutation: this is a long-lived streaming exchange with progress events, which
 * `useMutation` has no way to express. The generated `fillForm` client is still used — inside
 * the service worker, where the port handler lives.
 */
export function useFill() {
  const [state, setState] = useState<FillState>({ status: 'idle' })
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const queryClient = useQueryClient()

  // A port left open after unmount keeps the service worker alive and leaks the listener.
  useEffect(() => {
    return () => portRef.current?.disconnect()
  }, [])

  /**
   * Adopt a fill this panel did not start.
   *
   * The page chip runs fills through the background directly, so without this the panel's
   * state stays `idle` and a review opened from the page leads nowhere.
   *
   * Progress events are no longer filtered while `done`. They used to be, because the review's
   * edits lived in `ReviewPanel`'s component state and any unmount silently reverted them;
   * they now live in `review-store`, keyed by tab, and survive the screen going away.
   */
  useEffect(() => {
    const onRuntimeMessage = (message: {
      type?: string
      event?: FillPortEvent
      fieldId?: string
      verdict?: string
      value?: string
    }) => {
      /**
       * A verdict reached on the page, while the panel happens to be open.
       *
       * The page is the authority for answers now, and this is the only thing keeping the
       * receipt honest while the user works in the form beside it.
       */
      if (message?.type === 'review/verdict' && message.fieldId && message.verdict) {
        void (async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id !== undefined) {
            applyVerdict(
              tab.id,
              message.fieldId as string,
              message.verdict as Verdict,
              message.value ?? '',
            )
          }
        })()
        return
      }

      if (message?.type !== 'fill/event' || !message.event) return
      const event = message.event

      if (event.type === 'progress') {
        setState((prev) => ({
          ...prev,
          status: 'running',
          stage: event.stage,
          stageDone: event.done,
          stageTotal: event.total,
        }))
      } else if (event.type === 'complete') {
        setState((prev) => ({
          status: 'done',
          plan: event.plan,
          report: event.report,
          tabId: prev.tabId,
        }))
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
      } else if (event.type === 'error') {
        setState((prev) => ({ status: 'error', error: event.error, tabId: prev.tabId }))
      }
    }

    chrome.runtime.onMessage.addListener(onRuntimeMessage)
    return () => chrome.runtime.onMessage.removeListener(onRuntimeMessage)
  }, [queryClient])

  /**
   * Pick up a fill that finished before the panel opened.
   *
   * The listener above only hears live broadcasts, and the common case is the opposite: the
   * user fills from the page and then opens the panel to check the judgement calls.
   *
   * Scoped to the active tab so opening the panel elsewhere cannot resurrect someone else's
   * answers into a review of this page.
   */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const stored = await chrome.storage.session.get('aff:lastFill')
      const last = stored['aff:lastFill'] as
        | {
            tabId: number
            plan: FillPlan
            report: ApplyReport
            verdicts?: Record<string, { verdict: string; value: string }>
          }
        | undefined

      if (cancelled || !last || tab?.id !== last.tabId) return

      /**
       * Verdicts first, so the receipt never counts a settled answer as outstanding.
       *
       * The panel's own store dies with the panel, and the page is where answers are actually
       * dealt with — so without this, closing and reopening the panel showed every judgement
       * call as still needing attention, including the ones just handled on the form.
       */
      if (last.verdicts) hydrate(last.tabId, last.verdicts)

      setState((prev) =>
        prev.status === 'idle'
          ? { status: 'done', plan: last.plan, report: last.report, tabId: last.tabId }
          : prev,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(
    async (options: { overwriteExisting: boolean }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        setState({ status: 'error', error: { code: 'INVALID_REQUEST', message: 'No active tab' } })
        return
      }

      // A new fill replaces the last one wholesale, so corrections against the old plan would
      // otherwise be applied to answers that no longer exist.
      clearDraft(tab.id)

      portRef.current?.disconnect()
      const port = chrome.runtime.connect({ name: FILL_PORT })
      portRef.current = port

      setState({ status: 'running', stage: 'detecting', tabId: tab.id })

      port.onMessage.addListener((event: FillPortEvent) => {
        switch (event.type) {
          case 'progress':
            setState((prev) => ({
              ...prev,
              status: 'running',
              stage: event.stage,
              stageDone: event.done,
              stageTotal: event.total,
            }))
            break
          case 'complete':
            setState((prev) => ({
              status: 'done',
              plan: event.plan,
              report: event.report,
              tabId: prev.tabId,
            }))
            // A successful fill consumed quota; Profile and Home must reflect it.
            void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
            break
          case 'error':
            setState((prev) => ({ status: 'error', error: event.error, tabId: prev.tabId }))
            break
        }
      })

      port.onDisconnect.addListener(() => {
        portRef.current = null
        // A disconnect *before* a terminal event means the worker died mid-fill. Say so, rather
        // than leaving a progress list frozen forever.
        setState((prev) =>
          prev.status === 'running'
            ? {
                ...prev,
                status: 'error',
                error: { code: 'INTERNAL', message: 'The fill was interrupted. Try again.' },
              }
            : prev,
        )
      })

      const message: FillPortRequest = {
        type: 'start',
        tabId: tab.id,
        overwriteExisting: options.overwriteExisting,
      }
      port.postMessage(message)
    },
    [queryClient],
  )

  const reset = useCallback(() => {
    portRef.current?.disconnect()
    setState((prev) => {
      clearDraft(prev.tabId ?? null)
      return { status: 'idle' }
    })
    // Drop the parked result too. Without this, finishing a review and reopening the panel
    // brings the same review straight back, which reads as the panel being stuck.
    void chrome.storage.session.remove('aff:lastFill').catch(() => undefined)
  }, [])

  return { state, start, reset }
}
