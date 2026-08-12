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
  }, [])

  return { state, start, reset }
}

export const STAGE_LABEL: Record<string, string> = {
  detecting: 'Reading the page…',
  routing: 'Working out what to answer…',
  generating: 'Writing your answers…',
  applying: 'Filling the form…',
}
