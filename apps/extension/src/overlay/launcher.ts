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
    // Long text grows leftward into the page instead of off the right edge of the window.
    if (text.length > 11) countBadge.setAttribute('data-wide', 'true')
    else countBadge.removeAttribute('data-wide')
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
  grabber.innerHTML = '<span></span><span></span><span></span>'

  body.appendChild(button)
  body.appendChild(countBadge)
  body.appendChild(stopBtn)

  wrap.appendChild(grabber)
  wrap.appendChild(body)
  root.appendChild(wrap)

  // ── Position ─────────────────────────────────────────────────────────────
  // The wrap is pinned to the right edge; dragging moves it vertically.
  const rightX = () => window.innerWidth - wrap.offsetWidth - EDGE
  let pos = { y: Math.round(window.innerHeight * 0.25) }

  const clampY = (y: number) =>
    Math.min(Math.max(EDGE, y), window.innerHeight - button.offsetHeight - EDGE)

  const applyPosition = (y: number) => {
    pos = { y }
    wrap.style.translate = `${Math.round(rightX())}px ${Math.round(y)}px`
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
  })

  grabber.addEventListener('pointermove', (event) => {
    if (!dragState) return
    const dy = event.clientY - dragState.startY
    if (!dragState.dragging && Math.abs(dy) < DRAG_THRESHOLD) return
    dragState.dragging = true
    applyPosition(clampY(dragState.origY + dy))
  })

  grabber.addEventListener('pointerup', () => {
    if (!dragState) return
    if (dragState.dragging) void chrome.storage.local.set({ [POSITION_KEY]: pos })
    dragState = null
  })

  button.addEventListener('click', () => options.onOpen())

  // Restore remembered position.
  void chrome.storage.local.get(POSITION_KEY).then((stored) => {
    const saved = (stored as Record<string, { y: number } | undefined>)[POSITION_KEY]
    if (saved) applyPosition(clampY(saved.y))
  })

  const onResize = () => applyPosition(clampY(pos.y))
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
      window.removeEventListener('resize', onResize)
      wrap.remove()
    },
  }
}
