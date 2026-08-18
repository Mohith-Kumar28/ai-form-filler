import { type DetectionResult, detectPageForm } from '@aff/form-adapters'
import type { ApplyReport, ContentRequest, FillPlan, FillPortEvent } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { sendMessage } from '../lib/messaging.js'
import { type AnimatedFill, runFillAnimation } from '../overlay/animate.js'
import { type CardHandle, mountMenuCard } from '../overlay/card.js'
import { burstConfetti } from '../overlay/confetti.js'
import { createFeedbackCapture, displayValueOf } from '../overlay/feedback.js'
import { GLYPH, getOverlayHost, isOverlayEvent, isOverlayHost } from '../overlay/host.js'
import { type LauncherHandle, mountLauncher } from '../overlay/launcher.js'
import { type FieldMark, mountFieldMark } from '../overlay/markers.js'
import { positionScheduler } from '../overlay/scheduler.js'
import { type KnownFacts, suggestForField } from '../overlay/suggest.js'

const BUILD_STAMP = chrome.runtime.getManifest().version_name ?? 'dev'

const MUTED_KEY = 'aff:mutedOrigins'
const SETTINGS_KEY = 'aff:settings'

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
    let settings = { inlineAutofill: true, showLauncher: true }

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

    async function loadSettings() {
      const stored = (await chrome.storage.local.get(SETTINGS_KEY)) as Record<
        string,
        { inlineAutofill: boolean; showLauncher: boolean } | undefined
      >
      settings = stored[SETTINGS_KEY] ?? { inlineAutofill: true, showLauncher: true }
    }

    void loadMuted()
    void loadSettings()

    chrome.storage.onChanged.addListener((changes) => {
      if (changes[SETTINGS_KEY]) {
        const next = (changes[SETTINGS_KEY].newValue as typeof settings) ?? {
          inlineAutofill: true,
          showLauncher: true,
        }
        settings = next
        if (!next.showLauncher) {
          launcher?.destroy()
          launcher = null
        } else {
          ensureLauncher()
        }
        if (!next.inlineAutofill) {
          destroyFieldTrigger()
          closeCard()
        }
      }
    })

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
        if (
          ['password', 'hidden', 'submit', 'button', 'reset', 'file', 'search'].includes(
            element.type,
          )
        )
          return false

        const name = `${element.name} ${element.autocomplete} ${element.id}`.toLowerCase()
        if (/pass(word|code)|otp|cvv|cvc|card|credit|security-code|captcha|recaptcha/i.test(name))
          return false

        if (element.autocomplete === 'one-time-code') return false

        // OTP digit cell: single-character with numeric inputmode
        if (element.maxLength === 1) {
          const mode = element.getAttribute('inputmode')
          if (mode === 'numeric' || mode === 'decimal') return false
          if (element.type === 'number' || element.type === 'tel') return false
        }

        const className = element.className?.toString()?.toLowerCase() ?? ''
        if (/\botp\b|pin-?code|pass-?code|\b2fa\b|one-?time|token[-_]?input/i.test(className))
          return false

        // Tiny inputs (likely OTP cells, date parts, etc.) — too narrow for the trigger
        const rect = element.getBoundingClientRect()
        if (rect.width < 40 && element.type !== 'checkbox' && element.type !== 'radio') return false
      }

      if (element.getAttribute('role') === 'searchbox') return false
      if (element.closest('[role="search"]')) return false

      if (!detection) detect()
      return fieldIdFor(element) !== null
    }

    // ── cards & the launcher ────────────────────────────────────────────────

    function closeCard(): void {
      if (card) suggestionDismissed = true
      card?.close()
      card = null
      dismissInputListeners()
    }

    // ── field assist ────────────────────────────────────────────────────────
    // Two per field, shown only while a fillable field is focused and empty:
    //
    //   • every field gets a sparkle icon on its right edge — click it and the icon spins out
    //     while the AI writes, with no popup; hover for a moment to see the native tooltip.
    //   • a field we already know (an email, a typed fact) additionally gets an autofill
    //     suggestion below it — the value, focused so Enter fills it and Escape closes it.

    let fieldTrigger: HTMLElement | null = null
    let fieldTriggerTarget: HTMLElement | null = null

    function mountFieldTrigger(element: HTMLElement) {
      destroyFieldTrigger()
      const { root } = getOverlayHost()
      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.className = 'field-trigger'
      trigger.setAttribute('aria-label', 'Fill this field')
      trigger.setAttribute('title', 'Auto-fill this field')
      trigger.innerHTML = GLYPH.sparkle

      const TRIGGER_SIZE = 22
      const GAP = 6
      // Thresholds where the icon stops fitting inside and moves outside.
      const NARROW_THRESHOLD = 56
      const TINY_THRESHOLD = 36

      const place = () => {
        const rect = element.getBoundingClientRect()
        const narrow = rect.width < NARROW_THRESHOLD
        const tiny = rect.width < TINY_THRESHOLD

        if (tiny) {
          // Too small to sit beside — place above the left edge.
          const top = Math.max(GAP, rect.top - TRIGGER_SIZE - GAP)
          trigger.style.translate = `${Math.round(rect.left)}px ${Math.round(top)}px`
        } else if (narrow) {
          // Outside the right edge. Clamped so it never leaves the viewport.
          const rawLeft = rect.right + GAP
          const left = Math.min(rawLeft, window.innerWidth - TRIGGER_SIZE - GAP)
          trigger.style.translate = `${Math.round(left)}px ${Math.round(rect.top + (rect.height - TRIGGER_SIZE) / 2)}px`
        } else {
          // Inside the right edge, next to any existing decoration.
          trigger.style.translate = `${Math.round(rect.right - TRIGGER_SIZE - GAP)}px ${Math.round(rect.top + (rect.height - TRIGGER_SIZE) / 2)}px`
        }
      }
      place()

      trigger.addEventListener('mousedown', (event) => event.preventDefault())
      trigger.addEventListener('click', () => {
        if (element !== document.activeElement) return
        trigger.setAttribute('data-loading', 'true')
        requestFill('field', element)
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

    let suggestionDismissed = false

    let suggestionInputCleanup: (() => void) | null = null

    function mountAutofillSuggestion(
      element: HTMLElement,
      _field: { label: string },
      value: string,
    ) {
      const fieldId = fieldIdFor(element)
      const detectedField = fieldId ? detection?.elements.get(fieldId) : null
      if (!detectedField || !detection) return

      closeCard()
      dismissInputListeners()

      const rect = element.getBoundingClientRect()
      const anchor = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }

      card = mountMenuCard({
        kind: 'menu',
        anchor,
        actions: [{ id: 'fill', label: value, glyph: 'check' }],
        note: { text: 'Click to fill' },
        autofocus: false,
        closeable: true,
        onSelect: (id) => {
          closeCard()
          dismissInputListeners()
          if (id === 'fill') void detection?.adapter.applyValue(detectedField, value)
        },
        onClose: () => {
          suggestionDismissed = true
          closeCard()
          dismissInputListeners()
          element.focus()
        },
      })

      const onInput = () => {
        closeCard()
        dismissInputListeners()
      }
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          closeCard()
          dismissInputListeners()
          suggestionDismissed = true
        }
      }

      element.addEventListener('input', onInput)
      element.addEventListener('keydown', onKeydown)

      suggestionInputCleanup = () => {
        element.removeEventListener('input', onInput)
        element.removeEventListener('keydown', onKeydown)
      }
    }

    function dismissInputListeners() {
      suggestionInputCleanup?.()
      suggestionInputCleanup = null
    }

    function showFieldAssist(element: HTMLElement) {
      if (filling || card) return
      if (!detection) return
      if (!settings.inlineAutofill) return
      const fieldId = fieldIdFor(element)
      if (!fieldId) return
      const field = detection.form.fields.find((f) => f.id === fieldId)
      const detectedField = detection.elements.get(fieldId)
      if (!field || !detectedField) return

      // Only when empty — a field already answered should not be second-guessed.
      const current = detection.adapter.readValue(detectedField)
      if (current && current.trim() !== '') return

      // The sparkle icon goes on every field, known or not.
      mountFieldTrigger(element)

      void ensureKnownFacts().then((facts) => {
        if (element !== document.activeElement) return
        const suggestion = facts
          ? suggestForField(
              { label: field.label, autocomplete: field.autocomplete, kind: field.kind },
              facts,
            )
          : null
        if (!suggestion || suggestionDismissed) {
          suggestionDismissed = false
          return
        }
        mountAutofillSuggestion(element, field, suggestion.value)
      })
    }

    // ── the launcher ────────────────────────────────────────────────────────
    // A circle icon pinned to the right edge, with a field-count badge below and a grabber
    // beside it. One click opens the side panel and starts filling; while filling it expands
    // into a progress pill with a stop button.

    function showUpgradePrompt() {
      closeCard()
      if (!detection) return
      const firstField = detection.elements.values().next().value
      const anchor = firstField?.element.getBoundingClientRect()
      if (!anchor) return

      card = mountMenuCard({
        kind: 'menu',
        anchor: {
          top: anchor.top,
          left: anchor.left,
          width: anchor.width,
          height: anchor.height,
        },
        actions: [
          { id: 'upgrade', label: 'Upgrade to Pro', glyph: 'sparkle' },
          { id: 'panel', label: 'Open panel', glyph: 'sparkle' },
        ],
        note: {
          text: 'Monthly limit reached. Upgrade to keep filling forms.',
          bad: true,
        },
        onSelect: (id) => {
          closeCard()
          if (id === 'upgrade') {
            void chrome.runtime.sendMessage({ type: 'overlay/openPanel' }).catch(() => undefined)
          } else if (id === 'panel') {
            void chrome.runtime.sendMessage({ type: 'overlay/openPanel' }).catch(() => undefined)
          }
        },
        onClose: closeCard,
      })
    }

    async function checkQuotaAndFill(): Promise<boolean> {
      const result = await sendMessage({ type: 'account/quota' })
      if (!result.ok || !result.value) {
        requestFill('form')
        return true
      }
      if (result.value.exhausted) {
        launcher?.reset()
        showUpgradePrompt()
        return false
      }
      return true
    }

    function ensureLauncher() {
      if (!settings.showLauncher) return
      const count = !muted && detection ? detection.form.fields.length : 0
      if (count === 0) {
        launcher?.destroy()
        launcher = null
        return
      }
      if (launcher?.element.isConnected) {
        launcher.setFieldCount(count)
        return
      }
      launcher = mountLauncher({
        onOpen: () => {
          launcher?.setLoading(true)
          void chrome.runtime.sendMessage({ type: 'overlay/openPanel' }).catch(() => undefined)
          void checkQuotaAndFill().then((ok) => {
            if (ok) requestFill('form')
          })
        },
        onStop: () => {
          filling = false
          clearMarks()
          launcher?.reset()
          void chrome.runtime.sendMessage({ type: 'overlay/cancelFill' })
        },
      })
      launcher.setFieldCount(count)

      void sendMessage({ type: 'account/quota' }).then((result) => {
        if (result.ok && result.value?.exhausted) {
          launcher?.setExhausted()
        }
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
          mountFieldMark(
            markTargetFor(field),
            () => resolveField(fill.fieldId, fill.value, 'accepted'),
            () => resolveField(fill.fieldId, '', 'cleared'),
          ),
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

      const result = await runFillAnimation(animated, {
        onFieldStart: (fieldId) => marks.get(fieldId)?.setState('active'),
        onFieldEnd: (fieldId, ok) => {
          marks.get(fieldId)?.setState(!ok ? 'failed' : aiWrote.has(fieldId) ? 'aiWrote' : 'filled')
        },
      })

      filling = false

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
            launcher?.setLoading(false)
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
                destroyFieldTrigger()
              } else {
                launcher?.setBusy(event.done, event.total)
              }
            } else if (event.type === 'error') {
              filling = false
              clearMarks()
              destroyFieldTrigger()
              launcher?.reset()
            } else if (event.type === 'complete') {
              filling = false
              destroyFieldTrigger()
              launcher?.reset()
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
      showFieldAssist(target)
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
