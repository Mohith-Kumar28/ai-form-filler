import { type DetectionResult, detectPageForm } from '@aff/form-adapters'
import type { ApplyReport, ContentRequest, FillPlan, FillPortEvent } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { type AnimatedFill, runFillAnimation } from '../overlay/animate.js'
import { createFeedbackCapture, displayValueOf } from '../overlay/feedback.js'
import { isMuted, mountSeal, mute, type SealHandle, watchFocus } from '../overlay/field-seal.js'
import { type FieldMark, mountFieldMark } from '../overlay/markers.js'
import { positionScheduler } from '../overlay/scheduler.js'
import { mountSlip, type SlipHandle } from '../overlay/slip.js'

/**
 * Stamped at build time.
 *
 * A content script keeps running in already-open tabs after the extension is reloaded, so "did
 * my fix ship" and "is this tab still on the old code" look identical from the outside.
 */
const BUILD_STAMP = chrome.runtime.getManifest().version_name ?? 'dev'

/**
 * Below this it is a search box or a newsletter signup, not a form worth offering to fill
 * wholesale. It no longer gates the seal — a single focused field always gets one, because
 * "fill this one field" is a sensible thing to want on a page with one field.
 */
const MIN_FORM_FIELDS = 3

export default defineContentScript({
  matches: ['<all_urls>'],
  // Forms rendered by client-side frameworks do not exist at document_end.
  runAt: 'document_idle',
  allFrames: false,

  main() {
    let detection: DetectionResult | null = null
    let seal: SealHandle | null = null
    let sealedElement: HTMLElement | null = null
    let slip: SlipHandle | null = null
    let muted = false
    let filling = false

    const marks = new Map<string, FieldMark>()
    /** The last plan, so a persistent mark can open the answer it belongs to. */
    let lastPlan: FillPlan | null = null
    /** Local edits made in a review slip, before they are written back. */
    const slipDrafts = new Map<string, string>()

    void isMuted(location.origin).then((value) => {
      muted = value
      if (muted) detachSeal()
    })

    const feedback = createFeedbackCapture(location.origin, (payload) => {
      void chrome.runtime.sendMessage({ type: 'feedback/submit', payload })
    })

    /* ── detection ─────────────────────────────────────────────────────── */

    function detect(): DetectionResult | null {
      detection = detectPageForm(document, new URL(location.href))
      return detection
    }

    function fieldIdFor(element: HTMLElement): string | null {
      for (const [id, field] of detection?.elements ?? []) {
        if (field.element === element) return id
      }
      return null
    }

    function isFillable(element: HTMLElement): boolean {
      if (muted || filling) return false
      if (element.closest('[data-aff-ignore]')) return false

      const tag = element.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && element.contentEditable !== 'true') return false

      if (element instanceof HTMLInputElement) {
        // Never on a credential or payment field. Those are the browser's and the password
        // manager's business, and offering to fill one is a promise we must not make.
        if (['password', 'hidden', 'submit', 'button', 'reset', 'file'].includes(element.type)) {
          return false
        }
        const name = `${element.name} ${element.autocomplete} ${element.id}`.toLowerCase()
        if (/pass|otp|cvv|cvc|card|credit|security-code/.test(name)) return false
      }

      if (!detection) detect()
      return fieldIdFor(element) !== null
    }

    /* ── the seal ──────────────────────────────────────────────────────── */

    function closeSlip(): void {
      slip?.close()
      slip = null
      seal?.setExpanded(false)
    }

    function detachSeal(): void {
      if (slip) return
      seal?.destroy()
      seal = null
      sealedElement = null
    }

    function attachSeal(element: HTMLElement): void {
      if (sealedElement === element && seal) return
      seal?.destroy()
      sealedElement = element
      seal = mountSeal(element, () => openMenu(element))
    }

    /* ── the slip ──────────────────────────────────────────────────────── */

    function openMenu(element: HTMLElement): void {
      if (slip) {
        closeSlip()
        return
      }

      const current = seal
      const anchor = current?.anchorRect()
      if (!current || !anchor) return

      const fieldId = fieldIdFor(element)
      const field = detection?.form.fields.find((candidate) => candidate.id === fieldId)
      const total = detection?.form.fields.length ?? 0
      const existing = lastPlan?.fills.find((fill) => fill.fieldId === fieldId)

      // A field that already carries a concluded answer opens straight into its review, which
      // is the thing a person clicking a stamped field is actually asking for.
      if (existing && (existing.inferred || existing.confidence < REVIEW_CONFIDENCE_THRESHOLD)) {
        openReview(fieldId as string)
        return
      }

      current.setExpanded(true)
      slip = mountSlip({
        kind: 'menu',
        anchor,
        label: 'Fill',
        question: field?.label,
        actions: [
          { id: 'field', label: 'Fill this field', glyph: 'pen' },
          {
            id: 'form',
            label: total >= MIN_FORM_FIELDS ? `Fill all ${total} fields` : 'Fill the whole form',
            glyph: 'form',
            disabled: total === 0,
          },
          { id: 'panel', label: 'Open the panel', glyph: 'panel', quiet: true },
          { id: 'mute', label: 'Not on this site', glyph: 'mute', quiet: true },
        ],
        onSelect: (id) => {
          closeSlip()
          if (id === 'field' && fieldId) requestFill('field', fieldId)
          else if (id === 'form') requestFill('form')
          else if (id === 'panel') void chrome.runtime.sendMessage({ type: 'overlay/openPanel' })
          else if (id === 'mute') {
            void mute(location.origin)
            muted = true
            detachSeal()
          }
        },
        onClose: () => {
          closeSlip()
          element.focus()
        },
      })
    }

    function openReview(fieldId: string): void {
      const fill = lastPlan?.fills.find((candidate) => candidate.fieldId === fieldId)
      const field = detection?.elements.get(fieldId)
      if (!fill || !field) return

      closeSlip()

      const rect = field.element.getBoundingClientRect()
      const anchor = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      let draft = slipDrafts.get(fieldId) ?? fill.value

      seal?.setExpanded(true)
      slip = mountSlip({
        kind: 'review',
        anchor,
        label: 'Review this answer',
        question: fill.label || 'This answer',
        value: draft,
        concluded: fill.inferred,
        confidence: fill.confidence,
        onValueChange: (value) => {
          draft = value
          slipDrafts.set(fieldId, value)
        },
        onSelect: (id) => {
          closeSlip()
          if (id === 'keep') {
            resolveField(fieldId, fill.value, 'accepted')
          } else if (id === 'save') {
            resolveField(fieldId, draft, 'edited')
          } else if (id === 'clear') {
            resolveField(fieldId, '', 'cleared')
          }
        },
        onClose: closeSlip,
      })
    }

    /**
     * Applies a review decision on the page, then teaches from it.
     *
     * Accepting writes nothing — the page already holds the value — it only records that the
     * person looked and agreed. Clearing teaches nothing either: it says the answer was wrong
     * without saying what is right, and feeding that into the index later answers are
     * retrieved from would make them worse.
     */
    function resolveField(
      fieldId: string,
      value: string,
      verdict: 'accepted' | 'edited' | 'cleared',
    ): void {
      const fill = lastPlan?.fills.find((candidate) => candidate.fieldId === fieldId)
      const field = detection?.elements.get(fieldId)
      if (!fill || !field || !detection) return

      const settle = (ok: boolean) => {
        if (!ok) return
        slipDrafts.delete(fieldId)
        // The mark comes off: this field has been dealt with, and a stamp left on a resolved
        // answer is exactly the noise the persistence rule exists to avoid.
        marks.get(fieldId)?.destroy()
        marks.delete(fieldId)

        if (verdict === 'cleared') return

        void chrome.runtime.sendMessage({
          type: 'feedback/submit',
          payload: {
            origin: location.origin,
            entries: [
              {
                label: fill.label,
                ...(fill.kind ? { kind: fill.kind } : {}),
                proposed: fill.value,
                accepted: value,
                edited: verdict === 'edited',
                ...(verdict === 'accepted' ? { confirmed: true } : {}),
              },
            ],
          },
        })
      }

      if (verdict === 'accepted') {
        settle(true)
        return
      }

      void Promise.resolve(detection.adapter.applyValue(field, value)).then(settle)
    }

    function requestFill(scope: 'form' | 'field', fieldId?: string): void {
      filling = true
      clearMarks()
      seal?.setProgress(0)
      void chrome.runtime.sendMessage({ type: 'overlay/requestFill', scope, fieldId })
    }

    /* ── marks ─────────────────────────────────────────────────────────── */

    function clearMarks(): void {
      for (const mark of marks.values()) mark.destroy()
      marks.clear()
      slipDrafts.clear()
    }

    async function apply(plan: FillPlan): Promise<ApplyReport> {
      /*
        Bound once, up front. `detection` is a mutable closure variable the MutationObserver
        also writes to, so re-reading it after an `await` could hand the second half of a fill
        a different element map than the first half was measured against.
      */
      const active = detection

      if (!active) {
        filling = false
        seal?.setProgress(null)
        return { applied: [], failed: plan.fills.map((fill) => fill.fieldId) }
      }

      lastPlan = plan
      clearMarks()

      const animated: AnimatedFill[] = []
      const missing: string[] = []

      for (const fill of plan.fills) {
        const field = active.elements.get(fill.fieldId)

        // The node can be gone if the page re-rendered while the model was thinking.
        if (!field?.element.isConnected) {
          missing.push(fill.fieldId)
          continue
        }

        marks.set(
          fill.fieldId,
          mountFieldMark(field.element, () => openReview(fill.fieldId)),
        )

        animated.push({
          fieldId: fill.fieldId,
          element: field.element,
          value: fill.value,
          needsReview: fill.confidence < REVIEW_CONFIDENCE_THRESHOLD,
          apply: () => active.adapter.applyValue(field, fill.value),
        })
      }

      const unsure = new Set(
        plan.fills
          .filter((fill) => !fill.inferred && fill.confidence < REVIEW_CONFIDENCE_THRESHOLD)
          .map((fill) => fill.fieldId),
      )
      const concluded = new Set(
        plan.fills.filter((fill) => fill.inferred).map((fill) => fill.fieldId),
      )

      let completed = 0
      const result = await runFillAnimation(animated, {
        onFieldStart: (fieldId) => marks.get(fieldId)?.setState('active'),
        onFieldEnd: (fieldId, ok) => {
          completed += 1
          seal?.setProgress(animated.length === 0 ? 1 : completed / animated.length)
          marks
            .get(fieldId)
            ?.setState(
              !ok
                ? 'failed'
                : concluded.has(fieldId)
                  ? 'endorsed'
                  : unsure.has(fieldId)
                    ? 'unsure'
                    : 'printed',
            )
        },
      })

      filling = false
      seal?.setProgress(null)

      /**
       * Watch every field on the form, not only the ones we wrote.
       *
       * A field we skipped and the user then filled in themselves — a phone number we never
       * had — is exactly as informative as a correction.
       */
      const written = new Map(
        animated
          .filter((fill) => result.applied.includes(fill.fieldId))
          .map((fill) => [fill.fieldId, fill.value]),
      )

      feedback.arm(
        active.form.fields.map((field) => ({
          fieldId: field.id,
          label: field.label,
          kind: field.kind,
          ...(field.section ? { section: field.section } : {}),
          ...(field.hint ? { hint: field.hint } : {}),
          // Recorded as the page displays it, not as the model said it: `readValue` reports
          // option labels, so comparing against a raw option value made every choice field on
          // a form whose values differ from its labels look edited.
          proposed: displayValueOf(field, written.get(field.id) ?? ''),
        })),
        {
          read: (fieldId) => {
            const field = active.elements.get(fieldId)
            return field ? active.adapter.readValue(field) : null
          },
          isAlive: (fieldId) => active.elements.get(fieldId)?.element.isConnected === true,
        },
      )

      return { applied: result.applied, failed: [...missing, ...result.failed] }
    }

    /* ── wiring ────────────────────────────────────────────────────────── */

    chrome.runtime.onMessage.addListener(
      (
        request: ContentRequest | { type: 'fill/event'; event: FillPortEvent },
        _sender,
        sendResponse,
      ) => {
        switch (request.type) {
          case 'content/detect':
            sendResponse(detect()?.form ?? null)
            return false

          case 'content/apply':
            // `true` keeps the channel open: applying is async because it animates.
            void apply(request.plan).then(sendResponse)
            return true

          /**
           * A single reviewed field, written without animation.
           *
           * The stagger exists to make a whole-form fill legible; replaying it for one
           * corrected answer is just latency between the person typing and the page agreeing.
           */
          case 'content/write': {
            const field = detection?.elements.get(request.fieldId)
            if (!detection || !field?.element.isConnected) {
              sendResponse(false)
              return false
            }

            void Promise.resolve(detection.adapter.applyValue(field, request.value)).then((ok) => {
              if (ok) {
                marks.get(request.fieldId)?.destroy()
                marks.delete(request.fieldId)
                slipDrafts.delete(request.fieldId)
              }
              sendResponse(ok)
            })
            return true
          }

          /** A review row in the panel is pointing at this field. */
          case 'content/highlight': {
            marks.get(request.fieldId)?.flash()
            const field = detection?.elements.get(request.fieldId)
            if (!marks.has(request.fieldId) && field?.element.isConnected) {
              field.element.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
            sendResponse(null)
            return false
          }

          case 'fill/event': {
            const event = request.event
            if (event.type === 'progress' && event.total > 0) {
              seal?.setProgress(event.done / event.total)
            } else if (event.type === 'error') {
              filling = false
              seal?.setProgress(null)
              clearMarks()
            }
            return false
          }

          default:
            return false
        }
      },
    )

    /* ── lifecycle ─────────────────────────────────────────────────────── */

    const initial = detect()
    // One line per load, so "why does it say N fields" is answerable from DevTools rather than
    // from screenshots — it names the adapter that claimed the page alongside the count, which
    // is what separates a detection bug from a tab still running the previous build.
    console.debug(
      `[aff ${BUILD_STAMP}] ${initial?.adapter.name ?? 'none'}: ${
        initial?.form.fields.length ?? 0
      } fields`,
    )

    const stopWatching = watchFocus({
      isFillable,
      onAttach: attachSeal,
      onDetach: detachSeal,
      isHeld: () => slip !== null,
    })

    /** Opens the slip on the focused field without reaching for the pointer. */
    const onHotkey = (event: KeyboardEvent) => {
      if (event.key !== '.' || !(event.metaKey || event.ctrlKey)) return
      const active = document.activeElement as HTMLElement | null
      if (!active || !isFillable(active)) return
      event.preventDefault()
      attachSeal(active)
      openMenu(active)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!slip) return
      const path = event.composedPath()
      if (path.some((node) => node instanceof Node && slip?.contains(node))) return
      closeSlip()
    }

    document.addEventListener('keydown', onHotkey, true)
    document.addEventListener('pointerdown', onPointerDown, true)

    /**
     * Re-detect after DOM changes, debounced.
     *
     * Single-page apps swap forms in without a navigation event, and a form behind a "show
     * more" toggle does not exist at first paint. Debounced because one React render can fire
     * hundreds of mutations in a tick. Never while a fill is running: writing values into the
     * page is itself a mutation, and re-detecting mid-fill would swap the element map out from
     * under the animation.
     */
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (filling) return
      if (refreshTimer !== null) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        detect()
        // The focused field may have been replaced by the re-render that woke us.
        if (sealedElement && !sealedElement.isConnected) detachSeal()
      }, 400)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('pagehide', () => {
      observer.disconnect()
      stopWatching()
      document.removeEventListener('keydown', onHotkey, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      closeSlip()
      clearMarks()
      seal?.destroy()
      positionScheduler.clear()
      // The feedback capture keeps its own pagehide listener: it must still fire to report a
      // form submitted by navigating away.
    })
  },
})
