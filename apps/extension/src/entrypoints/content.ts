import { type DetectionResult, detectPageForm } from '@aff/form-adapters'
import { type ApplyReport, type ContentRequest, REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared'
import { type AnimatedFill, runFillAnimation } from '../overlay/animate.js'
import { type FieldMarker, mountFieldMarker, mountLauncher } from '../overlay/launcher.js'
import { positionScheduler } from '../overlay/scheduler.js'

/**
 * Page-side half of the fill flow.
 *
 * Holds the only thing that cannot cross a message boundary: the `fieldId → Element` map.
 * DOM nodes are not serialisable, and keeping elements here means the server never receives
 * a selector it could be tricked into acting on — it sees ids it minted answers for and
 * nothing else.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  // Forms rendered by client-side frameworks do not exist at document_end.
  runAt: 'document_idle',
  allFrames: false,

  main() {
    /**
     * Result of the most recent detection pass.
     *
     * Detection and application are separate round trips (the model call sits between
     * them), so the map has to survive across them. Deliberately *not* refreshed on apply:
     * re-detecting would mint new ids that no longer match the plan's.
     */
    let lastDetection: DetectionResult | null = null
    let launcher: ReturnType<typeof mountLauncher> | null = null
    const markers = new Map<string, FieldMarker>()

    function clearMarkers(): void {
      for (const marker of markers.values()) marker.destroy()
      markers.clear()
    }

    function detect() {
      lastDetection = detectPageForm(document, new URL(location.href))
      return lastDetection?.form ?? null
    }

    /**
     * Shows the launcher when a fillable form appears.
     *
     * Only for forms with several fields: a lone search box or newsletter input is not what
     * this is for, and an overlay on every page carrying an input would be noise.
     */
    function refreshLauncher(): void {
      const detection = detectPageForm(document, new URL(location.href))
      const fieldCount = detection?.form.fields.length ?? 0

      if (!detection || fieldCount < 3) {
        launcher?.destroy()
        launcher = null
        return
      }

      lastDetection = detection
      if (launcher) return

      launcher = mountLauncher({
        anchor: detection.elements.values().next().value?.element ?? document.body,
        fieldCount,
        onActivate: () => {
          // The side panel owns the flow; the launcher only asks for it to be opened.
          // Driving the fill from here would duplicate the port protocol in a second place.
          void chrome.runtime.sendMessage({ type: 'overlay/requestFill' })
          launcher?.setState('working')
        },
      })
    }

    async function apply(plan: {
      fills: { fieldId: string; value: string; confidence: number }[]
    }): Promise<ApplyReport> {
      const detection = lastDetection

      if (!detection) {
        // Apply without a prior detect — the page navigated, or the worker restarted.
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

      const needsReview = new Set(animated.filter((f) => f.needsReview).map((f) => f.fieldId))

      const result = await runFillAnimation(animated, {
        onFieldStart: (fieldId) => markers.get(fieldId)?.setState('active'),
        onFieldEnd: (fieldId, ok) =>
          markers
            .get(fieldId)
            ?.setState(!ok ? 'failed' : needsReview.has(fieldId) ? 'review' : 'filled'),
      })

      launcher?.setState('done')

      return { applied: result.applied, failed: [...missing, ...result.failed] }
    }

    chrome.runtime.onMessage.addListener((request: ContentRequest, _sender, sendResponse) => {
      switch (request.type) {
        case 'content/detect':
          sendResponse(detect())
          return false

        case 'content/apply':
          // `true` keeps the channel open: applying is async because it animates.
          void apply(request.plan).then(sendResponse)
          return true

        default:
          return false
      }
    })

    refreshLauncher()

    /**
     * Re-check after DOM changes, debounced.
     *
     * Single-page apps swap entire forms in without a navigation event, and a form behind a
     * "Show more" toggle does not exist at first paint. Debounced because one React render
     * can fire hundreds of mutations in a tick.
     */
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (refreshTimer !== null) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshLauncher, 400)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('pagehide', () => {
      observer.disconnect()
      clearMarkers()
      launcher?.destroy()
      positionScheduler.clear()
    })
  },
})
