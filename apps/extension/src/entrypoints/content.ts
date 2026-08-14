import { type DetectionResult, detectPageForm } from '@aff/form-adapters'
import type { ApplyReport, ContentRequest, FillPortEvent } from '@aff/shared'
import { isAuthError, REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { type AnimatedFill, runFillAnimation } from '../overlay/animate.js'
import { createFeedbackCapture, readFieldValue } from '../overlay/feedback.js'
import {
  type DockHandle,
  type FieldMarker,
  mountDock,
  mountFieldMarker,
} from '../overlay/launcher.js'
import { positionScheduler } from '../overlay/scheduler.js'

/** Below this, it is a search box or a newsletter signup, not a form worth offering to fill. */
const MIN_FIELDS = 3

export default defineContentScript({
  matches: ['<all_urls>'],
  // Forms rendered by client-side frameworks do not exist at document_end.
  runAt: 'document_idle',
  allFrames: false,

  main() {
    let lastDetection: DetectionResult | null = null
    let dock: DockHandle | null = null
    const markers = new Map<string, FieldMarker>()

    /**
     * Dismissal is remembered against the *shape* of the form, not the page.
     *
     * Hiding should stick while the user works on this form, but a single-page app that
     * swaps in a different form should bring the dock back — otherwise one dismissal
     * silences the extension for the rest of the session.
     */
    let dismissedSignature: string | null = null
    /**
     * What the dock is currently showing.
     *
     * `refreshDock` must never clobber a result. Writing values into the form mutates the
     * DOM, which fires the MutationObserver, which re-detected and reset the dock straight
     * back to `idle` — so the "15 filled · Review" state appeared for about a second and
     * vanished. Guarding only on `busy` was not enough, because by then the fill is done.
     */
    let dockState: 'idle' | 'working' | 'settled' = 'idle'

    const feedback = createFeedbackCapture(location.origin, (payload) => {
      void chrome.runtime.sendMessage({ type: 'feedback/submit', payload })
    })

    function clearMarkers(): void {
      for (const marker of markers.values()) marker.destroy()
      markers.clear()
    }

    function signatureOf(detection: DetectionResult): string {
      return `${detection.form.fields.length}:${detection.form.fields
        .slice(0, 5)
        .map((f) => f.label)
        .join('|')}`
    }

    function detect() {
      lastDetection = detectPageForm(document, new URL(location.href))
      return lastDetection?.form ?? null
    }

    function ensureDock(): DockHandle {
      if (dock) return dock
      dock = mountDock({
        onActivate: () => {
          dockState = 'working'
          clearMarkers()
          dock?.setState({ kind: 'working', stage: 'detecting', done: 0, total: 0 })
          void chrome.runtime.sendMessage({ type: 'overlay/requestFill' })
        },
        onDismiss: () => {
          if (lastDetection) dismissedSignature = signatureOf(lastDetection)
          dockState = 'idle'
          clearMarkers()
          dock?.destroy()
          dock = null
        },
        onReview: () => {
          void chrome.runtime.sendMessage({ type: 'overlay/openPanel' })
        },
        onSignIn: () => {
          void chrome.runtime.sendMessage({ type: 'overlay/openPanel' })
        },
      })
      return dock
    }

    /**
     * Shows or hides the dock as the page's form changes.
     *
     * Never runs while a fill is in flight — a React re-render mid-fill would otherwise
     * reset the dock to idle and throw away the progress the user is watching.
     */
    function refreshDock(): void {
      // A working or settled dock owns the surface until the user dismisses it.
      if (dockState !== 'idle') return

      const detection = detectPageForm(document, new URL(location.href))
      const fieldCount = detection?.form.fields.length ?? 0

      if (!detection || fieldCount < MIN_FIELDS) {
        dock?.destroy()
        dock = null
        return
      }

      lastDetection = detection

      if (dismissedSignature === signatureOf(detection)) return
      dismissedSignature = null

      ensureDock().setState({ kind: 'idle', fieldCount })
    }

    async function apply(plan: {
      fills: { fieldId: string; value: string; confidence: number; inferred?: boolean }[]
    }): Promise<ApplyReport> {
      const detection = lastDetection

      if (!detection) {
        dockState = 'settled'
        dock?.setState({ kind: 'error', message: 'The page changed while answering.' })
        return { applied: [], failed: plan.fills.map((f) => f.fieldId) }
      }

      clearMarkers()

      const animated: AnimatedFill[] = []
      const missing: string[] = []

      for (const fill of plan.fills) {
        const field = detection.elements.get(fill.fieldId)

        // The node can be gone if the page re-rendered while the model was thinking.
        if (!field?.element.isConnected) {
          missing.push(fill.fieldId)
          continue
        }

        markers.set(fill.fieldId, mountFieldMarker(field.element))

        animated.push({
          fieldId: fill.fieldId,
          element: field.element,
          value: fill.value,
          needsReview: fill.confidence < REVIEW_CONFIDENCE_THRESHOLD,
          apply: () => detection.adapter.applyValue(field, fill.value),
        })
      }

      const lowConfidence = new Set(animated.filter((f) => f.needsReview).map((f) => f.fieldId))
      const inferred = new Set(plan.fills.filter((f) => f.inferred).map((f) => f.fieldId))

      const total = detection.form.fields.length
      let completed = 0

      const result = await runFillAnimation(animated, {
        onFieldStart: (fieldId) => {
          markers.get(fieldId)?.setState('active')
          dock?.setState({ kind: 'working', stage: 'applying', done: completed, total })
        },
        onFieldEnd: (fieldId, ok) => {
          completed += 1
          markers
            .get(fieldId)
            ?.setState(
              !ok
                ? 'failed'
                : inferred.has(fieldId) || lowConfidence.has(fieldId)
                  ? 'review'
                  : 'filled',
            )
        },
      })

      dockState = 'settled'
      dock?.setState({
        kind: 'done',
        applied: result.applied.length,
        total,
        inferred: result.applied.filter((id) => inferred.has(id)).length,
      })

      // Arm only for fields actually written — a skipped field has no proposal to compare
      // the user's value against, so it teaches nothing.
      feedback.arm(
        animated
          .filter((f) => result.applied.includes(f.fieldId))
          .map((f) => ({
            fieldId: f.fieldId,
            label: detection.elements.get(f.fieldId)?.schema.label ?? '',
            proposed: f.value,
          })),
        (fieldId) => {
          const element = detection.elements.get(fieldId)?.element
          return element ? readFieldValue(element) : null
        },
      )

      return { applied: result.applied, failed: [...missing, ...result.failed] }
    }

    chrome.runtime.onMessage.addListener(
      (
        request: ContentRequest | { type: 'fill/event'; event: FillPortEvent },
        _sender,
        sendResponse,
      ) => {
        switch (request.type) {
          case 'content/detect':
            sendResponse(detect())
            return false

          case 'content/apply':
            // `true` keeps the channel open: applying is async because it animates.
            void apply(request.plan).then(sendResponse)
            return true

          /**
           * Progress forwarded from the background's fill flow.
           *
           * Without this the dock would sit on one label for the whole ten-to-twenty second
           * run, which is the single thing that makes a working fill feel broken.
           */
          case 'fill/event': {
            const event = request.event
            if (event.type === 'progress' && dockState === 'working') {
              dock?.setState({
                kind: 'working',
                stage: event.stage,
                done: event.done,
                total: event.total,
              })
            } else if (event.type === 'error') {
              dockState = 'settled'
              clearMarkers()
              // A dead session gets a sign-in action instead of a retry that cannot succeed.
              dock?.setState({
                kind: 'error',
                message: event.error.message,
                needsAuth: isAuthError(event.error.code),
              })
            }
            return false
          }

          default:
            return false
        }
      },
    )

    refreshDock()

    /**
     * Re-check after DOM changes, debounced.
     *
     * Single-page apps swap forms in without a navigation event, and a form behind a "show
     * more" toggle does not exist at first paint. Debounced because one React render can
     * fire hundreds of mutations in a tick.
     */
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (dockState !== 'idle') return
      if (refreshTimer !== null) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshDock, 400)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('pagehide', () => {
      observer.disconnect()
      clearMarkers()
      dock?.destroy()
      positionScheduler.clear()
      // The feedback capture keeps its own pagehide listener: it must still fire to report
      // a form submitted by navigating away.
    })
  },
})
