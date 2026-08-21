import { GLYPH, getOverlayHost } from './host.js'
import type { Rect } from './scheduler.js'

/**
 * The launcher — the extension's one persistent presence on a form page.
 *
 * Three shapes: a circle icon with a field-count badge below it when idle; an expanded pill
 * with progress text and a red stop button while a fill is running; and a brief pulse while
 * thinking. A dots grabber appears on hover to drag it up and down the right edge.
 */

const POSITION_KEY = 'aff:launcherPos'
const EDGE = 16
const DRAG_THRESHOLD = 4

/**
 * How far outside the launcher still counts as reaching for it, in CSS pixels.
 *
 * The drag handle used to appear only while the 38px circle itself was hovered, so picking the
 * launcher up meant landing on the circle, spotting the handle, and getting to it before the
 * cursor slipped off — the handle vanished from under the hand reaching for it. 44px is roughly
 * a thumb, and it is measured from the wrap's box, so it extends past the handle as well.
 */
const NEAR_PAD = 44

/** How long the launcher stays "near" after the cursor leaves. Long enough to turn around. */
const NEAR_LINGER_MS = 700

/** Rotating reassurance shown in place of the field count while the AI thinks. */
/**
 * What the badge says while there is no number worth showing.
 *
 * Per stage, and every line is true of the stage it belongs to — the previous set rotated
 * "Thinking… / Reading the form… / Writing answers…" regardless of what was actually happening.
 * `generating` gets two lines because it is the one that takes ten to twenty seconds, and a
 * label that never changes for that long reads as a hang.
 */
const STAGE_MESSAGES: Record<string, string[]> = {
  detecting: ['Reading the form…'],
  generating: ['Writing your answers…', 'Working through the form…'],
  applying: ['Filling the fields…'],
}

export interface LauncherHandle {
  element: HTMLElement
  anchorRect: () => Rect
  setFieldCount: (count: number) => void
  /** Switches to the filling pill, sets the progress text, and shows the stop button. */
  setStage: (stage: string, done: number, total: number) => void
  /** Pulsing animation while thinking (before the pill appears). */
  setLoading: (loading: boolean) => void
  /** Shows an upgrade indicator instead of the field count. */
  setExhausted: () => void
  /** A one-off wiggle on detection, so a form on the page is noticed. Plays at most once. */
  playAttention: () => void
  /** Back to the idle circle + badge. */
  reset: () => void
  destroy: () => void
}

export function mountLauncher(options: { onOpen: () => void; onStop: () => void }): LauncherHandle {
  const { root } = getOverlayHost()

  // ── DOM ─────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div')
  wrap.className = 'launcher-wrap'

  const body = document.createElement('div')
  body.className = 'launcher-body'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'launcher'
  button.setAttribute('aria-label', 'Fill this form')
  button.setAttribute('title', 'Fill all fields')

  const icon = document.createElement('span')
  icon.className = 'launcher-icon'
  icon.innerHTML = GLYPH.mascot

  const progressText = document.createElement('span')
  progressText.className = 'launcher-progress'

  button.appendChild(icon)
  button.appendChild(progressText)

  const countBadge = document.createElement('span')
  countBadge.className = 'launcher-count'

  // Field count + loading text. The badge shows "N fields" when idle and a rotating
  // "Thinking… / Reading the form… / Writing answers…" while the AI works.
  let fieldCount = 0
  let loadingTimer: ReturnType<typeof setInterval> | null = null
  let loadingIndex = 0

  const showFieldCount = () => {
    setBadge(
      fieldCount === 0 ? '' : `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`,
      false,
    )
  }

  /** The badge, with the breathing dot that carries the "still working" signal. */
  const setBadge = (text: string, thinking: boolean) => {
    countBadge.textContent = ''
    if (thinking) {
      const dot = document.createElement('span')
      dot.className = 'launcher-count-dot'
      countBadge.appendChild(dot)
    }
    countBadge.appendChild(document.createTextNode(text))
  }

  let loadingStage = 'generating'

  const messagesFor = (stage: string): string[] =>
    STAGE_MESSAGES[stage] ?? STAGE_MESSAGES.generating ?? ['Working…']

  const startLoadingText = (stage: string) => {
    const messages = messagesFor(stage)
    // Restarting the same stage would reset the rotation on every progress event.
    if (loadingTimer !== null && stage === loadingStage) return
    stopLoadingText()
    loadingStage = stage
    loadingIndex = 0
    setBadge(messages[0] ?? 'Working…', true)
    if (messages.length < 2) return
    loadingTimer = setInterval(() => {
      loadingIndex = (loadingIndex + 1) % messages.length
      setBadge(messages[loadingIndex] ?? 'Working…', true)
    }, 2600)
  }

  const stopLoadingText = () => {
    if (loadingTimer !== null) {
      clearInterval(loadingTimer)
      loadingTimer = null
    }
  }

  let attentionPlayed = false

  // Safety net: if no fill event ever arrives, the icon must not spin forever.
  let loadingSafety: ReturnType<typeof setTimeout> | null = null

  const settleLoading = () => {
    if (loadingSafety !== null) {
      clearTimeout(loadingSafety)
      loadingSafety = null
    }
    button.classList.remove('launcher--loading')
    stopLoadingText()
    loadingStage = ''
  }

  const stopBtn = document.createElement('button')
  stopBtn.type = 'button'
  stopBtn.className = 'launcher-stop'
  stopBtn.setAttribute('aria-label', 'Stop filling')
  stopBtn.innerHTML = GLYPH.close
  stopBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    options.onStop()
  })

  const grabber = document.createElement('button')
  grabber.type = 'button'
  grabber.className = 'launcher-grab'
  grabber.setAttribute('aria-label', 'Drag to move')
  grabber.setAttribute('title', 'Drag to move')
  // Six, in two columns of three — the grabber glyph. Three in a line is a kebab menu.
  grabber.innerHTML = '<span></span>'.repeat(6)

  body.appendChild(button)
  body.appendChild(countBadge)
  body.appendChild(stopBtn)

  wrap.appendChild(grabber)
  wrap.appendChild(body)
  root.appendChild(wrap)

  // ── Position ─────────────────────────────────────────────────────────────
  // The wrap is pinned to the right edge; dragging moves it vertically.

  /**
   * The viewport, *excluding* the scrollbar.
   *
   * `window.innerWidth` includes it, so on any page long enough to scroll — which is most pages
   * with a form on them — the launcher was placed 16px from the outer edge of a viewport whose
   * last 15px are occupied by the scrollbar. The gap the user actually saw was nearer 1px, and
   * anything hanging off the launcher, the badge above all, went under the scrollbar or off the
   * edge entirely. `clientWidth` is the content box.
   *
   * Guarded because a quirks-mode document can report 0 here, and 0 would pin the launcher off
   * the left of the window.
   */
  const viewportWidth = () => document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = () => document.documentElement.clientHeight || window.innerHeight

  const rightX = () => viewportWidth() - wrap.offsetWidth - EDGE
  let pos = { y: Math.round(viewportHeight() * 0.25) }

  // Declared up here rather than beside the pointermove handler that uses them: `applyPosition`
  // calls `invalidateNear` and runs during mount, which a `const` declared further down would
  // meet in its temporal dead zone.
  let nearRect: DOMRect | null = null
  let nearTimer: ReturnType<typeof setTimeout> | null = null
  let isNear = false

  const invalidateNear = () => {
    nearRect = null
  }

  const clampY = (y: number) =>
    Math.min(Math.max(EDGE, y), viewportHeight() - button.offsetHeight - EDGE)

  const applyPosition = (y: number) => {
    pos = { y }
    wrap.style.translate = `${Math.round(rightX())}px ${Math.round(y)}px`
    // The cached proximity rect is now stale — see `onPointerMove`.
    invalidateNear()
  }

  /**
   * Re-pin to the right edge after the launcher changes shape.
   *
   * `rightX` measures the wrap and subtracts, so the x it produces is only correct for the
   * width the launcher had at the time. The idle circle is ~56px and the filling pill is much
   * wider — and the pill grows again as the progress text goes from "0/7" to "10/70" — so every
   * one of those transitions left the element pinned at the *circle's* left edge with the pill
   * hanging off the right of the viewport, clipped mid-digit. Nothing recomputed it, because
   * the only thing that ever did was a drag or a window resize.
   */
  const reposition = () => applyPosition(clampY(pos.y))

  applyPosition(pos.y)

  // ── Drag (grabber) + click (icon) ────────────────────────────────────────
  let dragState: { startY: number; origY: number; dragging: boolean } | null = null

  grabber.addEventListener('pointerdown', (event) => {
    grabber.setPointerCapture(event.pointerId)
    dragState = { startY: event.clientY, origY: pos.y, dragging: false }
    /*
      The CSS has wanted this attribute since it was written; nothing ever set it.

      Both rules that keep the handle alive mid-drag were therefore resting on `:active` alone,
      and `:active` is lost as soon as the pointer leaves the button's box — which, when the
      thing you are doing is dragging that button somewhere else, is instantly. The handle
      faded out from under a pointer that still had it captured, and the cursor reverted from
      `grabbing` to the page's own.
    */
    wrap.setAttribute('data-dragging', 'true')
  })

  grabber.addEventListener('pointermove', (event) => {
    if (!dragState) return
    const dy = event.clientY - dragState.startY
    if (!dragState.dragging && Math.abs(dy) < DRAG_THRESHOLD) return
    dragState.dragging = true
    applyPosition(clampY(dragState.origY + dy))
  })

  const endDrag = () => {
    wrap.removeAttribute('data-dragging')
    if (!dragState) return
    if (dragState.dragging) void chrome.storage.local.set({ [POSITION_KEY]: pos })
    dragState = null
  }

  grabber.addEventListener('pointerup', endDrag)
  // A cancelled pointer (a gesture the browser took over, a lost capture) never fires `pointerup`,
  // and without this the wrap keeps `data-dragging` and the handle never hides again.
  grabber.addEventListener('pointercancel', endDrag)

  button.addEventListener('click', () => options.onOpen())

  // Restore remembered position.
  void chrome.storage.local.get(POSITION_KEY).then((stored) => {
    const saved = (stored as Record<string, { y: number } | undefined>)[POSITION_KEY]
    if (saved) applyPosition(clampY(saved.y))
  })

  /*
    Proximity, measured on pointermove, in place of a bigger hover target.

    The rect is cached and invalidated on the two things that move the launcher — a drag and a
    resize — because reading `getBoundingClientRect` on every pointermove of every page the
    extension is injected into is a layout flush we have no business asking for. `data-near`
    only ever changes when it actually flips, so a cursor crossing the page does no DOM work.
  */
  const setNear = (near: boolean) => {
    if (near === isNear) return
    isNear = near
    if (near) wrap.setAttribute('data-near', 'true')
    else wrap.removeAttribute('data-near')
  }

  const onPointerMove = (event: PointerEvent) => {
    // Mid-drag the pointer is wherever the user has taken it; "near" is not the question.
    if (dragState) return
    if (!nearRect) nearRect = wrap.getBoundingClientRect()
    const r = nearRect
    const near =
      event.clientX >= r.left - NEAR_PAD &&
      event.clientX <= r.right + NEAR_PAD &&
      event.clientY >= r.top - NEAR_PAD &&
      event.clientY <= r.bottom + NEAR_PAD

    if (near) {
      if (nearTimer !== null) {
        clearTimeout(nearTimer)
        nearTimer = null
      }
      setNear(true)
      return
    }

    if (!isNear || nearTimer !== null) return
    nearTimer = setTimeout(() => {
      nearTimer = null
      setNear(false)
    }, NEAR_LINGER_MS)
  }

  document.addEventListener('pointermove', onPointerMove, { passive: true })

  const onResize = () => {
    invalidateNear()
    applyPosition(clampY(pos.y))
  }
  window.addEventListener('resize', onResize)

  const anchorRect = (): Rect => {
    const rect = button.getBoundingClientRect()
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
  }

  return {
    element: wrap,
    anchorRect,
    setFieldCount: (count) => {
      fieldCount = count
      showFieldCount()
    },
    /**
     * Where the fill has got to.
     *
     * `done === 0` shows the thinking state, not the number. This is the whole fix for a
     * launcher that read as hung: the pipeline emits `{done: 0}` for both `detecting` and
     * `generating`, the old `setBusy` called `settleLoading()` unconditionally — killing the
     * pulse and the text it had just started — and then displayed a frozen "0/5" for the ten
     * to twenty seconds the model actually takes. A zero is not progress; say what is
     * happening instead, and show a count only once there is one.
     */
    setStage: (stage, done, total) => {
      if (done > 0) {
        settleLoading()
        wrap.setAttribute('data-filling', 'true')
        progressText.textContent = `${done}/${total}`
        // The pill is wider than the circle, and wider again with every digit. Re-pin, or it
        // hangs off the right edge of the window and the count is cut in half.
        reposition()
        return
      }

      wrap.removeAttribute('data-filling')
      button.classList.add('launcher--loading')
      startLoadingText(stage)
      reposition()
    },
    setExhausted: () => {
      settleLoading()
      countBadge.textContent = 'Upgrade'
      countBadge.setAttribute('data-exhausted', 'true')
    },
    /**
     * "There is a form here."
     *
     * The launcher is a static circle in the corner of a page somebody is reading, which is
     * precisely the shape peripheral vision discards. Three beats on arrival is the smallest
     * thing that says the tool has something to offer on *this* page rather than merely
     * existing on every page.
     *
     * Once per launcher, and the launcher is destroyed and rebuilt only when the field count
     * goes to zero and back — so a single-page app that swaps forms wiggles again, and a page
     * that merely re-detects the same form does not. The class is removed on `animationend`
     * so it cannot fight the hover scale afterwards; reduced motion drops the animation, and
     * the listener never fires, which is why the guard is a flag rather than the class itself.
     */
    playAttention: () => {
      if (attentionPlayed) return
      attentionPlayed = true
      button.classList.add('launcher--attention')
      button.addEventListener(
        'animationend',
        () => button.classList.remove('launcher--attention'),
        { once: true },
      )
    },
    setLoading: (loading) => {
      if (loading) {
        button.classList.add('launcher--loading')
        startLoadingText('detecting')
        if (loadingSafety !== null) clearTimeout(loadingSafety)
        loadingSafety = setTimeout(() => {
          loadingSafety = null
          settleLoading()
          showFieldCount()
        }, 30000)
      } else {
        settleLoading()
        showFieldCount()
      }
    },
    reset: () => {
      settleLoading()
      wrap.removeAttribute('data-filling')
      showFieldCount()
      // Back to the circle: the same re-pin in the other direction, or it sits inset from the
      // edge by the width the pill used to be.
      reposition()
    },
    destroy: () => {
      settleLoading()
      if (nearTimer !== null) clearTimeout(nearTimer)
      document.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      wrap.remove()
    },
  }
}
