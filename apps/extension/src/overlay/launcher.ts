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
const LOADING_MESSAGES = ['Thinking…', 'Reading the form…', 'Writing answers…']

export interface LauncherHandle {
  element: HTMLElement
  anchorRect: () => Rect
  setFieldCount: (count: number) => void
  /** Switches to the filling pill, sets the progress text, and shows the stop button. */
  setBusy: (done: number, total: number) => void
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
    countBadge.textContent =
      fieldCount === 0 ? '' : `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`
  }

  const loadingMessage = (index: number): string =>
    LOADING_MESSAGES[index % LOADING_MESSAGES.length] ?? 'Thinking…'

  const startLoadingText = () => {
    loadingIndex = 0
    countBadge.textContent = loadingMessage(0)
    loadingTimer = setInterval(() => {
      loadingIndex = (loadingIndex + 1) % LOADING_MESSAGES.length
      countBadge.textContent = loadingMessage(loadingIndex)
    }, 1400)
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
    setBusy: (done, total) => {
      settleLoading()
      wrap.setAttribute('data-filling', 'true')
      progressText.textContent = `${done}/${total}`
      // The pill is wider than the circle, and wider again with every digit. Re-pin, or it
      // hangs off the right edge of the window and the count is cut in half.
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
        startLoadingText()
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
