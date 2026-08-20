import { type DetectionResult, detectPageForm } from '@aff/form-adapters'
import type {
  ApplyReport,
  ContentRequest,
  FeedbackRequest,
  FillPlan,
  FillPortEvent,
  FillPortRequest,
} from '@aff/shared'
import { FILL_PORT, LEARN_MAX_OPTIONS, REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { sendMessage } from '../lib/messaging.js'
import { type AnimatedFill, runFillAnimation } from '../overlay/animate.js'
import { type CardHandle, mountAnswerCard, mountMenuCard } from '../overlay/card.js'
import { burstConfetti } from '../overlay/confetti.js'
import { createFeedbackCapture, displayValueOf, feedbackEntryFor } from '../overlay/feedback.js'
import { GLYPH, getOverlayHost, isOverlayEvent, isOverlayHost } from '../overlay/host.js'
import { type LauncherHandle, mountLauncher } from '../overlay/launcher.js'
import { clearLearningNotes, noteLearning } from '../overlay/learning.js'
import { type FieldMark, mountFieldMark } from '../overlay/markers.js'
import { positionScheduler, type Rect } from '../overlay/scheduler.js'
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

    /** The open answer card, and which field it belongs to. At most one at a time. */
    let answerCard: { handle: CardHandle; fieldId: string } | null = null

    /**
     * The last rewrite instruction used on each field, so a second nudge is one keystroke.
     *
     * Lives and dies with the tab, like `marks`. A remembered instruction from yesterday's form
     * is noise, not a preference.
     */
    const lastInstruction = new Map<string, string>()

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

    /**
     * Teach the server what the user decided, and say so on the page.
     *
     * One function for both routes in — the capture that watches fields settle, and the card's
     * Keep and Clear — because the acknowledgement has to be identical either way. An answer
     * the user typed straight into the field and one they typed into our card are the same act
     * from their side, and only one of them having a receipt would read as the other having
     * been ignored.
     *
     * `fieldIds` is what it can be anchored to. Never fails loudly: the worst outcome is a chip
     * that says it could not save, on a form that is otherwise untouched.
     */
    function teach(payload: FeedbackRequest, fieldIds: string[]): void {
      const work = sendMessage({ type: 'feedback/submit', payload })

      const anchors = fieldIds
        .map((fieldId) => detection?.elements.get(fieldId)?.element)
        .filter((element): element is HTMLElement => element?.isConnected === true)

      /**
       * One chip, on the first field that is still on the page.
       *
       * A submit-time sweep can report a dozen answers at once, and a dozen chips is a wall of
       * receipts over a form somebody is reading. The first is the acknowledgement; the rest
       * would be noise saying the same thing.
       */
      const anchor = anchors[0]
      if (anchor) noteLearning(anchor, work)
      else void work
    }

    const feedback = createFeedbackCapture(location.origin, (payload, fieldIds) =>
      teach(payload, fieldIds),
    )

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
      cardUntrack?.()
      cardUntrack = null
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
    let triggerUntrack: (() => void) | null = null

    /**
     * The sparkle beside a focused field. Two jobs, decided by whether the field is empty.
     *
     * `fill` writes an answer into a blank field. `review` opens the answer card on a field we
     * have already filled — which is how a *stated* answer becomes editable at all. Judged
     * answers advertise themselves with a provenance tab, and stated ones deliberately do not:
     * the Unmarked Fact Rule in `markers.ts` says a fact asks nothing of the user, and putting
     * a tab on every filled field would flatten the only contrast the marks carry.
     *
     * But "asks nothing of you" is not "cannot be changed", and it was being read as the second
     * thing. A profile answer the user wanted reworded had no affordance anywhere on the page.
     * Hanging it off focus keeps the form quiet — nothing appears until they are in the field,
     * which is the moment they are thinking about that answer — while reusing the one control
     * that already means "make the AI do something here".
     */
    function mountFieldTrigger(element: HTMLElement, mode: 'fill' | 'review' = 'fill') {
      destroyFieldTrigger()
      const { root } = getOverlayHost()
      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.className = 'field-trigger'
      trigger.dataset.mode = mode
      const label = mode === 'review' ? 'Rewrite this answer' : 'Fill this field'
      trigger.setAttribute('aria-label', label)
      trigger.setAttribute('title', label)
      trigger.innerHTML = mode === 'review' ? GLYPH.pen : GLYPH.mascot

      // Must match `.field-trigger`'s box in `host.ts`, or the icon sits off its own anchor.
      const TRIGGER_SIZE = 26
      const GAP = 6
      // Thresholds where the icon stops fitting inside and moves outside.
      const NARROW_THRESHOLD = 56
      const TINY_THRESHOLD = 36
      /** Past this, a field holds more than one line and centring lands mid-answer. */
      const MULTILINE_HEIGHT = 72

      const place = (rect: Rect) => {
        const narrow = rect.width < NARROW_THRESHOLD
        const tiny = rect.width < TINY_THRESHOLD

        /**
         * Vertically centred on a single-line input, and in the bottom corner of a box.
         *
         * Centring a 600px cover-letter field puts the icon three hundred pixels down, in the
         * middle of the answer — which is both a strange place to look for a control and
         * directly over the user's text. The bottom-right corner is where a textarea's own
         * affordances live, and it is below the text rather than in it.
         */
        const inside =
          rect.height > MULTILINE_HEIGHT
            ? rect.top + rect.height - TRIGGER_SIZE - GAP
            : rect.top + (rect.height - TRIGGER_SIZE) / 2

        if (tiny) {
          // Too small to sit beside — place above the left edge.
          const top = Math.max(GAP, rect.top - TRIGGER_SIZE - GAP)
          trigger.style.translate = `${Math.round(rect.left)}px ${Math.round(top)}px`
        } else if (narrow) {
          // Outside the right edge. Clamped so it never leaves the viewport.
          const rawLeft = rect.left + rect.width + GAP
          const left = Math.min(rawLeft, window.innerWidth - TRIGGER_SIZE - GAP)
          trigger.style.translate = `${Math.round(left)}px ${Math.round(inside)}px`
        } else {
          // Inside the right edge, next to any existing decoration.
          const right = rect.left + rect.width
          trigger.style.translate = `${Math.round(right - TRIGGER_SIZE - GAP)}px ${Math.round(inside)}px`
        }
      }
      place(element.getBoundingClientRect())

      /**
       * Follow the field.
       *
       * It used to be placed once, at viewport coordinates, and never again — so the moment the
       * page scrolled the icon stayed exactly where it was on screen while the input it belongs
       * to slid away underneath, and it ended up hovering over some unrelated question. The
       * shared rAF loop already existed for the marks and the answer card; this simply joins it,
       * which is also why it is not a per-element scroll listener (a 50-field form would install
       * 50 of them).
       */
      triggerUntrack = positionScheduler.track({
        element,
        onMove: (rect, visible) => {
          trigger.style.display = visible ? '' : 'none'
          if (visible) place(rect)
        },
        onDetach: destroyFieldTrigger,
      })

      trigger.addEventListener('mousedown', (event) => event.preventDefault())
      trigger.addEventListener('click', () => {
        if (mode === 'review') {
          const fieldId = fieldIdFor(element)
          // No plan for this field means nothing to open. Silence rather than an empty card.
          if (fieldId && lastPlan?.fills.some((fill) => fill.fieldId === fieldId)) {
            destroyFieldTrigger()
            openAnswerCard(fieldId)
          }
          return
        }
        if (element !== document.activeElement) return
        trigger.setAttribute('data-loading', 'true')
        requestFill('field', element)
      })

      root.appendChild(trigger)
      fieldTrigger = trigger
      fieldTriggerTarget = element
    }

    function destroyFieldTrigger() {
      triggerUntrack?.()
      triggerUntrack = null
      fieldTrigger?.remove()
      fieldTrigger = null
      fieldTriggerTarget = null
    }

    let suggestionDismissed = false

    let suggestionInputCleanup: (() => void) | null = null

    /** Untracks whatever `card` is currently following. Cleared by `closeCard`. */
    let cardUntrack: (() => void) | null = null

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

      /**
       * Follow the field, same as the trigger and the answer card.
       *
       * This one was anchored once and left there, so scrolling parted the suggestion from the
       * input it was offering to fill — and unlike the answer card it has no `data-adrift`
       * treatment, because a suggestion detached from its field is not a thing to keep on
       * screen. It hides while the anchor is off screen and comes back with it.
       */
      cardUntrack?.()
      cardUntrack = positionScheduler.track({
        element,
        onMove: (next, visible) => {
          if (!card) return
          card.element.style.display = visible ? '' : 'none'
          if (visible) card.reposition(next)
        },
        onDetach: closeCard,
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

      const current = detection.adapter.readValue(detectedField)

      /**
       * A field that already has an answer gets the rewrite affordance instead of a suggestion.
       *
       * Only for answers *we* wrote, which is what `lastPlan` establishes. Offering to rewrite
       * something the user typed themselves would be the tool second-guessing them, which is
       * the rule this branch used to enforce by returning — correctly for their text, and
       * wrongly for ours.
       */
      if (current && current.trim() !== '') {
        if (lastPlan?.fills.some((fill) => fill.fieldId === fieldId)) {
          mountFieldTrigger(element, 'review')
        }
        return
      }

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
      const anchor = launcher?.anchorRect() ?? firstFieldRect()
      if (!anchor) return

      card = mountMenuCard({
        kind: 'menu',
        anchor,
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

    /**
     * Whether there is quota left to fill with. A check, and only a check.
     *
     * It used to start the fill itself in one branch and leave the caller to start it in the
     * others, so the caller had to call `requestFill` after a `true` that sometimes already
     * meant "filling". The second call was swallowed by the `filling` guard, which is the kind
     * of accident that works until someone removes the guard.
     */
    async function hasQuotaToFill(): Promise<boolean> {
      const result = await sendMessage({ type: 'account/quota' })
      // Unknown is not exhausted: a signed-out or unreachable account is the fill's problem to
      // report, and blocking here would replace a real error with a wrong one.
      if (!result.ok || !result.value) return true
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
        /**
         * Fills in place. The side panel is deliberately **not** opened.
         *
         * It used to open on every click, and that was the single largest thing wrong with the
         * gesture. Opening it narrows the viewport, which relays out the form underneath —
         * centred content slides sideways, answers rewrap — at the exact moment the overlay is
         * drawing marks against the old geometry. The scheduler now survives that (see
         * `invalidate`), but surviving a layout shift is not a reason to cause one.
         *
         * It was also showing the wrong thing. Everything a fill produces is on the page: the
         * progress pill, a mark per field, and the card that edits any answer. The panel is for
         * sources, the account, and settings — none of which was asked for by pressing "fill" —
         * so it covered a third of the form the user was watching to show them nothing they
         * wanted. `background.ts` has documented this as the intent since the flow was written;
         * only this call site disagreed.
         *
         * It still opens on demand: the toolbar icon, and the actions on the error card below,
         * which point at the panel precisely when the panel is where the answer is.
         */
        onOpen: () => {
          launcher?.setLoading(true)
          void hasQuotaToFill().then((ok) => {
            if (ok) requestFill('form')
            else launcher?.setLoading(false)
          })
        },
        onStop: () => {
          filling = false
          clearMarks()
          launcher?.reset()
          /**
           * Cancelling is closing the channel, which is the whole reason to have one.
           * `cancel` is posted first so a worker that is still alive stops before the
           * disconnect, rather than racing the answers it is about to write.
           */
          if (fillPort) {
            try {
              fillPort.postMessage({ type: 'cancel' } satisfies FillPortRequest)
              fillPort.disconnect()
            } catch {
              // Already gone, which is the outcome being asked for.
            }
            fillPort = null
          }
        },
      })
      launcher.setFieldCount(count)

      void sendMessage({ type: 'account/quota' }).then((result) => {
        if (result.ok && result.value?.exhausted) {
          launcher?.setExhausted()
        }
      })
    }

    /**
     * Apply one value to the page, through the same adapter the fill used.
     *
     * The only route by which anything reaches the page's own elements. Everything else the
     * overlay draws lives in its shadow root, so teardown can never leave a mark on somebody
     * else's form.
     */
    async function writeThrough(fieldId: string, value: string): Promise<boolean> {
      const current = detection
      const field = current?.elements.get(fieldId)
      if (!current || !field?.element.isConnected) return false
      return Promise.resolve(current.adapter.applyValue(field, value))
    }

    /**
     * Report what the user decided, and take the mark off.
     *
     * Every verdict reports, `cleared` included. Clearing used to return early and send
     * nothing, on the reasoning that a rejection says an answer was wrong without saying what
     * is right. True — and it does not follow that the signal is worthless, because dropping it
     * meant the next form offered the same wrong answer again, indefinitely.
     */
    function reportVerdict(
      fieldId: string,
      verdict: 'accepted' | 'edited' | 'cleared',
      value: string,
      meta: { rewritten?: boolean } = {},
    ) {
      const fill = lastPlan?.fills.find((candidate) => candidate.fieldId === fieldId)
      if (!fill) return

      const schema = detection?.form.fields.find((candidate) => candidate.id === fieldId)

      marks.get(fieldId)?.destroy()
      marks.delete(fieldId)

      teach(
        {
          origin: location.origin,
          entries: [
            feedbackEntryFor(
              {
                label: fill.label,
                ...(fill.kind ? { kind: fill.kind } : {}),
                value: fill.value,
                ...(fill.options.length > 0 ? { options: fill.options } : {}),
              },
              {
                ...(schema?.section ? { section: schema.section } : {}),
                ...(schema?.hint ? { hint: schema.hint } : {}),
              },
              verdict,
              value,
              { trigger: 'review', ...(meta.rewritten ? { rewritten: true } : {}) },
            ),
          ],
        },
        [fieldId],
      )

      // So an open panel's receipt stays true. Reaches nobody when the panel is closed, which
      // is the ordinary case and not a failure.
      void chrome.runtime.sendMessage({ type: 'review/verdict', fieldId, verdict, value })
    }

    function closeAnswerCard(returnFocus: boolean) {
      if (!answerCard) return
      const { handle, fieldId } = answerCard
      answerCard = null
      handle.close()
      if (!returnFocus) return
      const field = detection?.elements.get(fieldId)
      if (field?.element.isConnected) field.element.focus()
    }

    /**
     * Open the one place anything can be done about a judged answer.
     *
     * Anchored to the tab rather than the field when the field is very tall: a 600px textarea's
     * own rect would put the card hundreds of pixels below the question it belongs to.
     */
    function openAnswerCard(fieldId: string, options: { scroll?: boolean } = {}) {
      closeCard()
      closeAnswerCard(false)

      const fill = lastPlan?.fills.find((candidate) => candidate.fieldId === fieldId)
      const current = detection
      const field = current?.elements.get(fieldId)
      if (!fill || !current || !field?.element.isConnected) return

      if (options.scroll) marks.get(fieldId)?.flash()

      const schema = current.form.fields.find((candidate) => candidate.id === fieldId)

      /**
       * Whether this answer was ever presented as a judgement, recomputed from the plan.
       *
       * The same rule `apply` uses to decide which fields keep a mark. Recomputed rather than
       * captured, because the card can be opened long after that fill — from the sparkle on a
       * focused field, or from the panel — and a card that says "I guessed" about a phone
       * number read out of the profile is telling the user something untrue about their own
       * data.
       */
      const judged = fill.inferred || fill.confidence < REVIEW_CONFIDENCE_THRESHOLD

      /**
       * What the field says now, not what we proposed.
       *
       * The two differ whenever the user has typed in the field since the fill — which is
       * common, and used to be destructive: the card opened with our original text, and its
       * first write-through then put that text back over theirs. Reading live means the card
       * always opens on the answer the person can see.
       */
      const live = current.adapter.readValue(field)
      const shown = live !== null && live.trim() !== '' ? live : fill.value

      const box = field.element.getBoundingClientRect()
      const tab = marks.get(fieldId)?.tabRect()
      const anchor =
        box.height > 240 && tab
          ? tab
          : { top: box.top, left: box.left, width: box.width, height: box.height }

      const options_ = schema?.options?.map((option) => option.label) ?? []
      const choose = options_.length > 0
      const multiple = fill.kind === 'multiselect' || fill.kind === 'checkbox'

      const handle = mountAnswerCard({
        kind: 'answer',
        anchor,
        anchorElement: field.element,
        question: fill.label || schema?.label || 'This answer',
        value: shown,
        reason: judged ? (fill.inferred ? 'inferred' : 'unsure') : 'stated',
        mode: choose ? 'choose' : 'prose',
        ...(choose ? { options: options_, multiple } : {}),
        ...(lastInstruction.has(fieldId)
          ? { lastInstruction: lastInstruction.get(fieldId) as string }
          : {}),
        onWrite: (value) => writeThrough(fieldId, value),
        onRewrite: async (instruction) => {
          const result = await sendMessage({
            type: 'fill/improve',
            label: fill.label,
            // The answer as it stands, for the same reason the card shows it: "make it
            // shorter" must shorten what the user is looking at, not what we first wrote.
            value: current.adapter.readValue(field) || shown,
            instruction,
          })
          if (!result.ok) throw new Error(result.error.message)
          lastInstruction.set(fieldId, instruction)
          return result.value.value
        },
        onKeep: (value, meta) => {
          closeAnswerCard(true)
          reportVerdict(fieldId, meta.edited ? 'edited' : 'accepted', value, {
            ...(meta.rewritten ? { rewritten: true } : {}),
          })
        },
        onClear: () => {
          closeAnswerCard(true)
          void writeThrough(fieldId, '').then(() => reportVerdict(fieldId, 'cleared', ''))
        },
        onClose: (returnFocus) => closeAnswerCard(returnFocus !== false),
      })

      answerCard = { handle, fieldId }

      /**
       * Follow the anchor, and stop following rather than closing when it scrolls away.
       *
       * Closing a card somebody is mid-sentence in because they scrolled is worse than letting
       * it visibly detach — `data-adrift` says so without taking the editor away.
       */
      positionScheduler.track({
        element: field.element,
        onMove: (rect, visible) => {
          if (!answerCard || answerCard.fieldId !== fieldId) return
          /**
           * Follow the field while it is on screen, and stop following rather than closing when
           * it scrolls away. Closing a card somebody is mid-sentence in because they scrolled is
           * worse than letting it visibly detach — `data-adrift` says so without taking the
           * editor away.
           *
           * Following also covers the stepper case: the card is opened against whatever rect the
           * field had before a smooth scroll landed, and the first move after it lands puts the
           * card where it belongs.
           */
          answerCard.handle.element.dataset.adrift = String(!visible)
          if (visible) answerCard.handle.reposition(rect)
        },
        // The page replaced the question. Close silently; there is nothing left to edit.
        onDetach: () => {
          if (answerCard?.fieldId === fieldId) closeAnswerCard(false)
        },
      })
    }

    // ── fill flow ───────────────────────────────────────────────────────────

    /**
     * The open fill this page asked for, so its Stop button has something to close.
     *
     * A fill the *panel* started has no port here, and stopping it was never possible from the
     * page — `overlay/cancelFill` set a flag only the page-initiated flow read. That is
     * unchanged; Stop on a panel-initiated fill puts the launcher back and lets the fill land.
     */
    let fillPort: chrome.runtime.Port | null = null

    /**
     * Ask for a fill, over the same port the side panel uses.
     *
     * This was a one-shot `chrome.runtime.sendMessage` whose reply came ten seconds later, and
     * it failed exactly as HANDOFF 7.3 says it must: an MV3 service worker can be torn down
     * mid-request, and a dropped `sendMessage` gives the sender no way to notice. `filling` is
     * set to true here *before* asking, and only a `complete`, an `error`, or an `apply` clears
     * it — so one killed worker left it stuck true, and the guard on the first line then
     * swallowed every later click in silence. The launcher was dead for the rest of the tab's
     * life while the panel's port-based fill went on working, which is precisely how it was
     * reported: filling from the sidebar writes the fields, pressing the button does nothing.
     *
     * A port cannot fail that way. If the worker dies the port disconnects, and a disconnect
     * with no terminal event is an interrupted fill — which is now said out loud instead of
     * quietly poisoning the next click.
     */
    function requestFill(scope: 'form' | 'field', element?: HTMLElement) {
      /**
       * A fill is already running — unless the flag is a leftover, in which case recover.
       *
       * The port makes a stuck flag far less likely, but a bare `return` here is what turned
       * one lost message into a button that never worked again, and the cost of being wrong in
       * that direction is much higher than the cost of a second fill. No live port means
       * nothing is running, whatever the flag says.
       */
      if (filling) {
        if (fillPort) return
        filling = false
      }
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

      const port = chrome.runtime.connect({ name: FILL_PORT })
      fillPort = port
      let settled = false

      port.onMessage.addListener((event: FillPortEvent) => {
        if (event.type === 'complete' || event.type === 'error') settled = true
        handleFillEvent(event)
      })

      port.onDisconnect.addListener(() => {
        if (fillPort === port) fillPort = null
        // A terminal event already arrived; the flow closes its own port on the way out.
        if (settled || !filling) return
        handleFillEvent({
          type: 'error',
          error: { code: 'INTERNAL', message: 'The fill was interrupted. Try again.' },
        })
      })

      port.postMessage({
        type: 'start',
        overwriteExisting: false,
        // The tab is deliberately not named: the worker reads it off the port's sender, so a
        // page cannot ask us to fill a different one.
        ...(fieldId ? { onlyFieldId: fieldId } : {}),
      } satisfies FillPortRequest)
    }

    /**
     * One handler for fill events, whoever started the fill.
     *
     * A fill this page asked for arrives over its port; one the panel asked for arrives as a
     * broadcast. The page's response has to be identical either way, and the events are
     * deliberately delivered by only one of the two routes — see `emit` in `fill-port.ts`.
     */
    function handleFillEvent(event: FillPortEvent) {
      if (event.type === 'progress') {
        if (event.stage === 'applying') {
          closeCard()
          destroyFieldTrigger()
        }
        /*
          Every stage, not just the ones before `applying`.

          `applying` is the only event that carries a real count, and it was the one stage that
          never reached the launcher — so the badge sat on whatever `generating` had left it
          showing for the entire fill. Reporting all three is what makes the count mean
          something; `setStage` decides whether a number or a message is the honest thing to
          show.
        */
        launcher?.setStage(event.stage, event.done, event.total)
        return
      }

      if (event.type === 'error') {
        filling = false
        clearMarks()
        destroyFieldTrigger()
        launcher?.reset()
        showFillError(event.error)
        return
      }

      filling = false
      destroyFieldTrigger()
      launcher?.reset()
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

    /**
     * What went wrong with a fill, said on the page.
     *
     * This exists because the launcher stopped opening the side panel. The panel was doing two
     * jobs, and only one of them was a mistake: covering the form with sources and settings
     * nobody asked for was wrong, but it *was* the only place a signed-out user ever found out
     * why nothing happened. Without it the failure was a spinner that stopped — the fill error
     * event cleared the marks, reset the launcher, and said nothing at all.
     *
     * So the error is stated where the gesture happened, and the action names the one place
     * that can fix it. Which is when opening the panel is right: not because a fill started,
     * but because the answer is in there.
     */
    function showFillError(error: { code?: string; message?: string } | undefined) {
      const anchor = launcher?.anchorRect() ?? firstFieldRect()
      if (!anchor) return

      const code = error?.code ?? 'INTERNAL'
      const openPanel = () =>
        void chrome.runtime.sendMessage({ type: 'overlay/openPanel' }).catch(() => undefined)

      /**
       * One action, chosen by what the user has to do about it — not by what broke.
       *
       * A retry offered for a signed-out session is a button that cannot work, and offering it
       * is worse than offering nothing: it costs another round trip to reach the same silence.
       */
      const remedy: { id: string; label: string; act: () => void } =
        code === 'UNAUTHENTICATED' || code === 'INVALID_TOKEN'
          ? { id: 'signin', label: 'Sign in', act: openPanel }
          : code === 'QUOTA_EXCEEDED' || code === 'LIMIT_EXCEEDED'
            ? { id: 'upgrade', label: 'Upgrade', act: openPanel }
            : code === 'PROFILE_NOT_READY'
              ? { id: 'sources', label: 'Add a source', act: openPanel }
              : { id: 'retry', label: 'Try again', act: () => requestFill('form') }

      closeCard()
      card = mountMenuCard({
        kind: 'menu',
        anchor,
        actions: [{ id: remedy.id, label: remedy.label, glyph: 'sparkle' }],
        note: { text: error?.message ?? 'That fill did not go through.', bad: true },
        autofocus: false,
        closeable: true,
        onSelect: () => {
          closeCard()
          remedy.act()
        },
        onClose: closeCard,
      })
    }

    /** Somewhere honest to anchor a message when the launcher is hidden by settings. */
    function firstFieldRect() {
      const first = detection?.elements.values().next().value
      const box = first?.element.isConnected ? first.element.getBoundingClientRect() : null
      return box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null
    }

    function clearMarks() {
      closeAnswerCard(false)
      for (const mark of marks.values()) mark.destroy()
      marks.clear()
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
          mountFieldMark(markTargetFor(field), {
            reason: fill.inferred ? 'inferred' : 'unsure',
            onOpen: () => openAnswerCard(fill.fieldId),
            /*
              The tick. Accept without opening anything.

              The value is read off the page rather than taken from the plan: by the time
              somebody approves it they may have typed over it, and recording what we wrote
              instead of what is actually in the field would teach the wrong answer.
            */
            onAccept: () => {
              const live = detection?.adapter.readValue(field)
              reportVerdict(fill.fieldId, 'accepted', live?.trim() ? live : fill.value)
            },
            // The page replaced the question. The mark has torn itself down; drop the dead
            // handle too, so a review row or a panel message cannot act on it afterwards.
            onDetach: () => marks.delete(fill.fieldId),
          }),
        )
        animated.push({
          fieldId: fill.fieldId,
          element: field.element,
          value: fill.value,
          needsReview: fill.confidence < REVIEW_CONFIDENCE_THRESHOLD,
          apply: () => active.adapter.applyValue(field, fill.value),
        })
      }

      /**
       * Which answers the tool concluded rather than read.
       *
       * The only ones that keep a mark. A stated answer settles green and leaves nothing behind
       * — the Unmarked Fact Rule: a fact asks nothing of the user, so the interface asks
       * nothing, and the absence is itself the notation.
       */
      const judged = new Set(
        plan.fills
          .filter((f) => f.inferred || f.confidence < REVIEW_CONFIDENCE_THRESHOLD)
          .map((f) => f.fieldId),
      )

      const result = await runFillAnimation(animated, {
        onFieldStart: (fieldId) => marks.get(fieldId)?.setState('active'),
        onFieldEnd: (fieldId, ok) => {
          marks.get(fieldId)?.setState(!ok ? 'failed' : judged.has(fieldId) ? 'judged' : 'stated')
          /**
           * Writing an answer moves the rest of the form.
           *
           * A textarea grows to fit three paragraphs, a validation line appears, Google Forms
           * re-lays out a question — and every field below it shifts down while its own size is
           * unchanged. Nothing in the scheduler's event set reports that: no scroll, no resize,
           * and a ResizeObserver on the fields themselves does not fire for a field that merely
           * moved. So the marks below the one being written sat at stale positions for up to a
           * poll interval, which during an animated fill is exactly when they are being watched.
           *
           * Once per field written, not per frame — the cost is a measure pass on a set the
           * page already just relaid out.
           */
          positionScheduler.invalidate()
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
          /**
           * The option labels, when there are few enough to be worth carrying.
           *
           * Labels rather than values: a value is a page-local token that means nothing on the
           * next site, and these strings become remembered answers.
           */
          ...(field.options && field.options.length > 0 && field.options.length <= LEARN_MAX_OPTIONS
            ? { options: field.options.map((option) => option.label) }
            : {}),
          proposed: displayValueOf(field, written.get(field.id) ?? ''),
        })),
        /**
         * Resolved against the **current** detection, by id, at read time.
         *
         * Not against `active`. The MutationObserver below re-detects 400 ms after any DOM
         * change and replaces `detection` with a fresh element map, so a reader closing over
         * the snapshot taken at fill time ends up holding elements the page has since thrown
         * away. On an SPA form that re-renders after a fill, `isAlive` then reports false for
         * fields that are plainly still there, and capture quietly falls back to the stale
         * snapshot instead of reading what the user actually typed.
         */
        {
          read: (fieldId) => {
            const current = detection
            const field = current?.elements.get(fieldId)
            return current && field ? current.adapter.readValue(field) : null
          },
          isAlive: (fieldId) => detection?.elements.get(fieldId)?.element.isConnected === true,
          fieldIdAt: (node) => {
            const current = detection
            if (!current) return null
            let element = node instanceof Element ? node : (node?.parentElement ?? null)

            /**
             * Walked, not compared directly.
             *
             * `fieldIdFor` matches an element by identity, which misses the two commonest
             * targets: a click on a `<label>`, and a click on one radio inside a group whose
             * field is keyed on the group rather than the control.
             */
            while (element && element !== document.body) {
              for (const [id, field] of current.elements) {
                if (field.element === element) return id
                if (field.groupElements?.includes(element as HTMLElement)) return id
              }
              element = element.parentElement
            }
            return null
          },
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

          case 'content/openCard': {
            openAnswerCard(request.fieldId, { scroll: true })
            sendResponse(null)
            return false
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
            sendResponse(null)
            return false
          }

          case 'fill/event': {
            // A fill the side panel started. This page's own fills arrive over its port.
            handleFillEvent(request.event)
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

    /**
     * A click anywhere on the page dismisses whatever the overlay has open.
     *
     * Both kinds of card, and that is a change: this used to close only the menu/suggestion
     * card, on the reasoning that the answer card holds an edit in progress and the commonest
     * reason to click the form is to re-read the question it is asking about. In practice
     * nobody reads it that way — a popover that ignores a click outside it reads as stuck, and
     * the card is one click away from being reopened by its own tab. What made the old
     * behaviour defensible was `close()` dropping the pending write; now that dismissal flushes
     * it (see `card.ts`), leaving is safe and the edit survives.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (isOverlayEvent(event)) return
      if (card) closeCard()
      // `false`: the click already chose where focus goes. Yanking it back to the field would
      // fight whatever the person just clicked on.
      if (answerCard) closeAnswerCard(false)
    }

    /**
     * Escape closes the open card wherever focus happens to be.
     *
     * Each card also handles Escape itself, which covers the ordinary case of focus sitting
     * inside it. That was the *only* handler, so the key went dead the moment focus moved
     * anywhere else — including the very common one of clicking the field to re-read the
     * question, which left the card open with no keyboard way out. This is the backstop, on
     * `document` rather than on the card, and it is why the card's own handler calls
     * `stopPropagation`: inside the shadow root that halts propagation before it ever retargets
     * to here, so the two can never both fire.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!card && !answerCard) return
      event.stopPropagation()
      if (card) closeCard()
      // `true`: a keyboard dismissal has to put focus somewhere reachable, and the field the
      // card belongs to is the only sensible place.
      if (answerCard) closeAnswerCard(true)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)

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
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      destroyFieldTrigger()
      closeCard()
      closeAnswerCard(false)
      clearMarks()
      clearLearningNotes()
      fillPort?.disconnect()
      launcher?.destroy()
      positionScheduler.clear()
    })
  },
})
