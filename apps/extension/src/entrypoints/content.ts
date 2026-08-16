import { type DetectionResult, detectPageForm } from '@aff/form-adapters'
import type { ApplyReport, ContentRequest, FillPlan, FillPortEvent } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { sendMessage } from '../lib/messaging.js'
import { type AnimatedFill, runFillAnimation } from '../overlay/animate.js'
import { type CardHandle, mountMenuCard, mountReviewCard } from '../overlay/card.js'
import { burstConfetti } from '../overlay/confetti.js'
import { createFeedbackCapture, displayValueOf } from '../overlay/feedback.js'
import { GLYPH, getOverlayHost, isOverlayEvent, isOverlayHost } from '../overlay/host.js'
import { type LauncherHandle, mountLauncher } from '../overlay/launcher.js'
import { type FieldMark, mountFieldMark } from '../overlay/markers.js'
import { positionScheduler } from '../overlay/scheduler.js'
import { type KnownFacts, suggestForField } from '../overlay/suggest.js'

const BUILD_STAMP = chrome.runtime.getManifest().version_name ?? 'dev'

const MUTED_KEY = 'aff:mutedOrigins'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  allFrames: false,

  main() {
    let detection: DetectionResult | null = null
    let launcher: LauncherHandle | null = null
    let card: CardHandle | null = null
    let muted = false
    let filling = false

    const marks = new Map<string, FieldMark>()
    let lastPlan: FillPlan | null = null
    const slipDrafts = new Map<string, string>()

    // ── known facts (instant suggestions) ───────────────────────────────────

    let knownFacts: KnownFacts | null = null
    let knownFactsPending: Promise<void> | null = null

    /** Fetched lazily on first focus, so pages the user never touches cost nothing. */
    function ensureKnownFacts(): Promise<KnownFacts | null> {
      if (knownFacts) return Promise.resolve(knownFacts)
      if (!knownFactsPending) {
        knownFactsPending = (async () => {
          const result = await sendMessage({ type: 'profile/knownFacts' })
          knownFacts = result.ok ? result.value : null
        })()
      }
      return knownFactsPending.then(() => knownFacts)
    }

    // ── mute per site ───────────────────────────────────────────────────────

    async function loadMuted() {
      const stored = (await chrome.storage.local.get(MUTED_KEY)) as Record<
        string,
        string[] | undefined
      >
      muted = (stored[MUTED_KEY] ?? []).includes(location.origin)
    }

    void loadMuted()

    const feedback = createFeedbackCapture(location.origin, (payload) => {
      void chrome.runtime.sendMessage({ type: 'feedback/submit', payload })
    })

    // ── detection ───────────────────────────────────────────────────────────

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
      if (muted) return false
      if (element.closest('[data-aff-ignore]')) return false

      const tag = element.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && element.contentEditable !== 'true') return false

      if (element instanceof HTMLInputElement) {
        if (['password', 'hidden', 'submit', 'button', 'reset', 'file'].includes(element.type))
          return false
        const name = `${element.name} ${element.autocomplete} ${element.id}`.toLowerCase()
        if (/pass|otp|cvv|cvc|card|credit|security-code/.test(name)) return false
      }

      if (!detection) detect()
      return fieldIdFor(element) !== null
    }

    // ── cards & the launcher ────────────────────────────────────────────────

    function closeCard(): void {
      card?.close()
      card = null
    }

    // ── field-side trigger (the "session thingy") ──────────────────────────
    // A small sparkle icon on the right-side of every focused fillable field. Clicking it
    // opens a menu with field-level actions: instant fill for known values, AI for the rest,
    // or the whole form at once.

    let fieldTrigger: HTMLElement | null = null
    let fieldTriggerTarget: HTMLElement | null = null

    function mountFieldTrigger(element: HTMLElement) {
      destroyFieldTrigger()
      const { root } = getOverlayHost()
      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.className = 'field-trigger'
      trigger.setAttribute('aria-label', 'Fill this field')
      trigger.innerHTML = GLYPH.sparkle

      const place = () => {
        const rect = element.getBoundingClientRect()
        const size = 22
        trigger.style.translate = `${Math.round(rect.right - size - 6)}px ${Math.round(rect.top + (rect.height - size) / 2)}px`
      }
      place()

      trigger.addEventListener('mousedown', (event) => event.preventDefault())
      trigger.addEventListener('click', () => {
        if (element !== document.activeElement) return
        openFieldMenu(element)
      })

      root.appendChild(trigger)
      fieldTrigger = trigger
      fieldTriggerTarget = element
    }

    function destroyFieldTrigger() {
      fieldTrigger?.remove()
      fieldTrigger = null
      fieldTriggerTarget = null
    }

    function openFieldMenu(element: HTMLElement) {
      if (!detection) return
      const fieldId = fieldIdFor(element)
      if (!fieldId) return
      const field = detection.form.fields.find((f) => f.id === fieldId)
      const detectedField = detection.elements.get(fieldId)
      if (!field || !detectedField) return

      closeCard()
      const rect = element.getBoundingClientRect()
      const anchor = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      const total = detection.form.fields.length

      void ensureKnownFacts().then((facts) => {
        if (element !== document.activeElement) return
        closeCard()

        const suggestion = facts
          ? suggestForField(
              { label: field.label, autocomplete: field.autocomplete, kind: field.kind },
              facts,
            )
          : null

        const actions: Array<{
          id: string
          label: string
          glyph: 'check' | 'sparkle' | 'form'
        }> = []
        if (suggestion) actions.push({ id: 'fill', label: 'Fill this field', glyph: 'check' })
        actions.push({ id: 'generate', label: 'Write this with AI', glyph: 'sparkle' })
        actions.push({
          id: 'form',
          label: `Fill all ${total} ${total === 1 ? 'field' : 'fields'}`,
          glyph: 'form',
        })

        card = mountMenuCard({
          kind: 'menu',
          anchor,
          question: field.label,
          actions,
          autofocus: false,
          onSelect: (id) => {
            closeCard()
            if (id === 'fill' && suggestion)
              void detection?.adapter.applyValue(detectedField, suggestion.value)
            else if (id === 'generate') requestFill('field', element)
            else if (id === 'form') requestFill('form')
          },
          onClose: closeCard,
        })
      })
    }

    // ── the launcher ────────────────────────────────────────────────────────
    // The pill at the bottom-right of the page. One click opens the side panel and starts
    // filling the form — no popup menu, just straight into it. While a fill is running it
    // becomes the progress indicator, and when it is done it shows the result; clicking it
    // then reopens the panel to the review.

    function ensureLauncher() {
      if (muted || !detection || detection.form.fields.length === 0) return
      if (launcher?.element.isConnected) {
        launcher.setFieldCount(detection.form.fields.length)
        return
      }
      const total = detection.form.fields.length
      launcher = mountLauncher({
        fieldCount: total,
        onOpen: () => {
          void chrome.runtime
            .sendMessage({ type: 'overlay/openPanel' })
            .then(() => requestFill('form'))
        },
        onReview: () => void chrome.runtime.sendMessage({ type: 'overlay/openPanel' }),
      })
    }

    function openReview(fieldId: string) {
      const fill = lastPlan?.fills.find((candidate) => candidate.fieldId === fieldId)
      const field = detection?.elements.get(fieldId)
      if (!fill || !field) return

      closeCard()

      const rect = field.element.getBoundingClientRect()
      const anchor = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      let draft = slipDrafts.get(fieldId) ?? fill.value

      card = mountReviewCard({
        kind: 'review',
        anchor,
        question: fill.label || 'This answer',
        value: draft,
        onValueChange: (value) => {
          draft = value
          slipDrafts.set(fieldId, value)
        },
        onImprove: async (instruction) => {
          const result = await sendMessage({
            type: 'fill/improve',
            label: fill.label,
            value: draft,
            instruction,
          })
          if (!result.ok) throw new Error(result.error.message)
          return result.value.value
        },
        onSelect: (id) => {
          closeCard()
          if (id === 'keep') resolveField(fieldId, fill.value, 'accepted')
          else if (id === 'save') resolveField(fieldId, draft, 'edited')
          else if (id === 'clear') resolveField(fieldId, '', 'cleared')
        },
        onClose: closeCard,
      })
    }

    function resolveField(
      fieldId: string,
      value: string,
      verdict: 'accepted' | 'edited' | 'cleared',
    ) {
      const fill = lastPlan?.fills.find((c) => c.fieldId === fieldId)
      const field = detection?.elements.get(fieldId)
      if (!fill || !field || !detection) return

      const settle = (ok: boolean) => {
        if (!ok) return
        slipDrafts.delete(fieldId)
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

    // ── fill flow ───────────────────────────────────────────────────────────

    function requestFill(scope: 'form' | 'field', element?: HTMLElement) {
      if (filling) return
      detect()

      let fieldId: string | undefined
      if (scope === 'field') {
        fieldId = (element && fieldIdFor(element)) ?? undefined
        if (!fieldId) {
          showErrorBox(element, 'That field moved. Try again, or fill the whole form.')
          return
        }
      }

      filling = true
      clearMarks()
      launcher?.setBusy(0, detection?.form.fields.length ?? 0)
      void chrome.runtime.sendMessage({ type: 'overlay/requestFill', scope, fieldId })
    }

    function showErrorBox(element: HTMLElement | undefined, message: string) {
      const anchor = element
      if (!anchor?.isConnected) return

      closeCard()
      const box = anchor.getBoundingClientRect()
      card = mountMenuCard({
        kind: 'menu',
        anchor: { top: box.top, left: box.left, width: box.width, height: box.height },
        actions: [{ id: 'retry', label: 'Try again', glyph: 'sparkle' }],
        note: { text: message, bad: true },
        onSelect: (id) => {
          closeCard()
          if (id === 'retry') requestFill('form')
        },
        onClose: closeCard,
      })
    }

    function clearMarks() {
      for (const mark of marks.values()) mark.destroy()
      marks.clear()
      slipDrafts.clear()
    }

    function markTargetFor(field: {
      element: HTMLElement
      groupElements?: HTMLElement[]
    }): HTMLElement {
      const group = field.groupElements
      if (!group || group.length < 2) return field.element

      let ancestor = field.element.parentElement
      while (ancestor && !group.every((node) => ancestor?.contains(node))) {
        ancestor = ancestor.parentElement
      }

      if (!ancestor || ancestor === document.body || ancestor === document.documentElement) {
        return field.element
      }
      return ancestor
    }

    async function apply(plan: FillPlan): Promise<ApplyReport> {
      const active = detection
      if (!active) {
        filling = false
        launcher?.reset()
        return { applied: [], failed: plan.fills.map((f) => f.fieldId) }
      }

      lastPlan = plan
      clearMarks()

      const animated: AnimatedFill[] = []
      const missing: string[] = []

      for (const fill of plan.fills) {
        const field = active.elements.get(fill.fieldId)
        if (!field?.element.isConnected) {
          missing.push(fill.fieldId)
          continue
        }

        marks.set(
          fill.fieldId,
          mountFieldMark(markTargetFor(field), () => openReview(fill.fieldId)),
        )
        animated.push({
          fieldId: fill.fieldId,
          element: field.element,
          value: fill.value,
          needsReview: fill.confidence < REVIEW_CONFIDENCE_THRESHOLD,
          apply: () => active.adapter.applyValue(field, fill.value),
        })
      }

      const aiWrote = new Set(
        plan.fills
          .filter((f) => f.inferred || f.confidence < REVIEW_CONFIDENCE_THRESHOLD)
          .map((f) => f.fieldId),
      )

      let completed = 0
      const result = await runFillAnimation(animated, {
        onFieldStart: (fieldId) => marks.get(fieldId)?.setState('active'),
        onFieldEnd: (fieldId, ok) => {
          completed += 1
          launcher?.setBusy(completed, animated.length)
          marks.get(fieldId)?.setState(!ok ? 'failed' : aiWrote.has(fieldId) ? 'aiWrote' : 'filled')
        },
      })

      filling = false
      launcher?.setResult(
        result.applied.length,
        plan.fills.filter((f) => f.inferred || f.confidence < REVIEW_CONFIDENCE_THRESHOLD).length,
      )

      const launcherRect = launcher?.anchorRect()
      if (launcherRect) {
        burstConfetti(
          launcherRect.left + launcherRect.width / 2,
          launcherRect.top + launcherRect.height / 2,
        )
      }

      const written = new Map(
        animated.filter((f) => result.applied.includes(f.fieldId)).map((f) => [f.fieldId, f.value]),
      )

      feedback.arm(
        active.form.fields.map((field) => ({
          fieldId: field.id,
          label: field.label,
          kind: field.kind,
          ...(field.section ? { section: field.section } : {}),
          ...(field.hint ? { hint: field.hint } : {}),
          proposed: displayValueOf(field, written.get(field.id) ?? ''),
        })),
        {
          read: (fieldId) => {
            const f = active.elements.get(fieldId)
            return f ? active.adapter.readValue(f) : null
          },
          isAlive: (fieldId) => active.elements.get(fieldId)?.element.isConnected === true,
        },
      )

      return { applied: result.applied, failed: [...missing, ...result.failed] }
    }

    // ── wiring ─────────────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener(
      (
        request: ContentRequest | { type: 'fill/event'; event: FillPortEvent },
        _sender,
        sendResponse,
      ) => {
        switch (request.type) {
          case 'content/detect':
            sendResponse(detection?.form ?? null)
            return false

          case 'content/apply':
            void apply(request.plan).then(sendResponse)
            return true

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

          case 'content/highlight': {
            const mark = marks.get(request.fieldId)
            if (mark) {
              mark.flash()
            } else {
              const field = detection?.elements.get(request.fieldId)
              const box = field?.element.isConnected ? field.element.getBoundingClientRect() : null
              if (box && (box.bottom < 8 || box.top > window.innerHeight - 8)) {
                field?.element.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }
            }
            sendResponse(null)
            return false
          }

          case 'content/resolved': {
            marks.get(request.fieldId)?.destroy()
            marks.delete(request.fieldId)
            slipDrafts.delete(request.fieldId)
            sendResponse(null)
            return false
          }

          case 'fill/event': {
            const event = request.event
            if (event.type === 'progress') {
              if (event.stage === 'applying') {
                closeCard()
              } else {
                launcher?.setBusy(0, event.total)
              }
            } else if (event.type === 'error') {
              filling = false
              launcher?.reset()
              clearMarks()
            } else if (event.type === 'complete') {
              filling = false
              launcher?.setResult(
                event.report.applied.length,
                event.plan.fills.filter(
                  (f) => f.inferred || f.confidence < REVIEW_CONFIDENCE_THRESHOLD,
                ).length,
              )
            }
            return false
          }

          default:
            return false
        }
      },
    )

    // ── lifecycle ───────────────────────────────────────────────────────────

    const initial = detect()
    console.debug(
      `[aff ${BUILD_STAMP}] ${initial?.adapter.name ?? 'none'}: ${initial?.form.fields.length ?? 0} fields`,
    )

    if (!muted) ensureLauncher()

    const onPointerDown = (event: PointerEvent) => {
      if (!card) return
      if (isOverlayEvent(event)) return
      closeCard()
    }

    document.addEventListener('pointerdown', onPointerDown, true)

    // Field trigger: show on focus, hide on blur.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || muted || !isFillable(target)) return
      mountFieldTrigger(target)
    }

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      // One frame, so focus moving *into* the overlay (a menu item) does not read as leaving
      // the field, and a tab to the next field does not tear down the trigger it just mounted.
      requestAnimationFrame(() => {
        if (target && fieldTriggerTarget === target) destroyFieldTrigger()
        if (!card) return
        if (isOverlayHost(document.activeElement)) return
        closeCard()
      })
    }

    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)

    /**
     * Re-detect after DOM changes, debounced. SPA navigation swaps forms without a page load,
     * and a form behind a "show more" toggle does not exist at first paint.
     */
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new MutationObserver(() => {
      if (filling) return
      if (refreshTimer !== null) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        detect()
        if (!muted) ensureLauncher()
      }, 400)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('pagehide', () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      destroyFieldTrigger()
      closeCard()
      clearMarks()
      launcher?.destroy()
      positionScheduler.clear()
    })
  },
})
