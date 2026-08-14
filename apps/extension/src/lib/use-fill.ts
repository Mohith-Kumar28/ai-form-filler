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

/**
 * Extracted with `Extract` rather than a bare conditional: `FillPortEvent extends {...}`
 * tests the whole union at once and resolves to `never`, so `stage` would silently become
 * `undefined`. `Extract` distributes over the union and picks the progress arm.
 */
type FillStage = Extract<FillPortEvent, { type: 'progress' }>['stage']

export interface FillState {
  status: 'idle' | 'running' | 'done' | 'error'
  stage?: FillStage
  plan?: FillPlan
  report?: ApplyReport
  error?: ApiError
}

/**
 * Drives a fill over the port protocol.
 *
 * Not a TanStack mutation: this is a long-lived streaming exchange with progress events,
 * which `useMutation` has no way to express. The generated `fillForm` client is still used —
 * inside the service worker, where the port handler lives.
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
   * Adopt a fill the panel did not start.
   *
   * The page dock runs fills through the background directly, so without this the panel's
   * state stays `idle` and its Review button leads to nothing — which is exactly what it
   * did. The background broadcasts every event on the runtime channel; listening here is
   * what makes the panel a real destination rather than a promise.
   */
  useEffect(() => {
    const onRuntimeMessage = (message: { type?: string; event?: FillPortEvent }) => {
      if (message?.type !== 'fill/event' || !message.event) return
      const event = message.event

      if (event.type === 'progress') {
        /**
         * A progress event must never tear down a finished review.
         *
         * Pressing Fill again while the review is open used to flip `status` back to
         * `running`, which unmounts `ReviewPanel` — and its edits live in component state,
         * so every correction the user had made silently reverted to the model's original
         * answers when the next `complete` mounted a fresh one.
         *
         * A new fill that reaches `complete` will replace the review wholesale, which is
         * correct; it is only the intermediate churn that has to be ignored.
         */
        setState((prev) =>
          prev.status === 'done' ? prev : { ...prev, status: 'running', stage: event.stage },
        )
      } else if (event.type === 'complete') {
        setState({ status: 'done', plan: event.plan, report: event.report })
        void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
      } else if (event.type === 'error') {
        setState({ status: 'error', error: event.error })
      }
    }

    chrome.runtime.onMessage.addListener(onRuntimeMessage)
    return () => chrome.runtime.onMessage.removeListener(onRuntimeMessage)
  }, [queryClient])

  /**
   * Pick up a fill that finished before the panel opened.
   *
   * The listener above only hears live broadcasts, and the common case is the opposite: the
   * user fills from the page dock with the panel closed, then presses Review. The panel then
   * mounted with no result and showed the sources list — a button that promised a
   * destination and delivered the starting point.
   *
   * Scoped to the active tab so opening the panel on a different page cannot resurrect
   * someone else's answers into a review of this one.
   */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const stored = await chrome.storage.session.get('aff:lastFill')
      const last = stored['aff:lastFill'] as
        | { tabId: number; plan: FillPlan; report: ApplyReport }
        | undefined

      if (cancelled || !last || tab?.id !== last.tabId) return

      // Never clobber a fill already in flight or already shown.
      setState((prev) =>
        prev.status === 'idle' ? { status: 'done', plan: last.plan, report: last.report } : prev,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(
    async (options: { quality: 'auto' | 'high'; overwriteExisting: boolean }) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        setState({
          status: 'error',
          error: { code: 'INVALID_REQUEST', message: 'No active tab' },
        })
        return
      }

      portRef.current?.disconnect()
      const port = chrome.runtime.connect({ name: FILL_PORT })
      portRef.current = port

      setState({ status: 'running', stage: 'detecting' })

      port.onMessage.addListener((event: FillPortEvent) => {
        switch (event.type) {
          case 'progress':
            setState((prev) => ({ ...prev, status: 'running', stage: event.stage }))
            break
          case 'complete':
            setState({ status: 'done', plan: event.plan, report: event.report })
            // A successful fill consumed quota; the header bar must reflect it.
            void queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
            break
          case 'error':
            setState({ status: 'error', error: event.error })
            break
        }
      })

      port.onDisconnect.addListener(() => {
        portRef.current = null
        // A disconnect *before* a terminal event means the worker died mid-fill. Say so,
        // rather than leaving a spinner running forever.
        setState((prev) =>
          prev.status === 'running'
            ? {
                status: 'error',
                error: { code: 'INTERNAL', message: 'The fill was interrupted. Try again.' },
              }
            : prev,
        )
      })

      const message: FillPortRequest = {
        type: 'start',
        tabId: tab.id,
        quality: options.quality,
        overwriteExisting: options.overwriteExisting,
      }
      port.postMessage(message)
    },
    [queryClient],
  )

  const reset = useCallback(() => {
    portRef.current?.disconnect()
    setState({ status: 'idle' })
    // Drop the parked result too. Without this, finishing a review and reopening the panel
    // brings the same review straight back, which reads as the panel being stuck.
    void chrome.storage.session.remove('aff:lastFill').catch(() => undefined)
  }, [])

  return { state, start, reset }
}

export const STAGE_LABEL: Record<string, string> = {
  detecting: 'Reading the page…',
  routing: 'Working out what to answer…',
  generating: 'Writing your answers…',
  applying: 'Filling the form…',
}
