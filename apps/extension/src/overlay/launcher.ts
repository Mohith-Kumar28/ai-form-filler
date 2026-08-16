import { GLYPH, getOverlayHost } from './host.js'
import type { Rect } from './scheduler.js'

/**
 * The launcher — the extension's one persistent presence on a form page.
 *
 * A draggable pill, bottom-right by default, that appears when a form is detected. One click
 * fills the form; while it works the pill becomes the progress indicator; when it is done it
 * becomes the result. Dragging moves it and the position is remembered per-user.
 *
 * What it replaces: an 18px seal that only appeared when a field took focus, and a hover menu
 * that opened and closed on a timer. Nothing rendered until focus, which meant a person
 * landing on a form had no idea the tool was there. The launcher is visible the moment a form
 * exists, and it is the one place every action starts from.
 */

const POSITION_KEY = 'aff:launcherPos'
const EDGE = 16
const DRAG_THRESHOLD = 4

export interface LauncherHandle {
  element: HTMLElement
  /** Viewport rect of the pill, for anchoring the menu card. */
  anchorRect: () => Rect
  setBusy: (done: number, total: number) => void
  setResult: (written: number, needLook: number) => void
  setFieldCount: (count: number) => void
  reset: () => void
  destroy: () => void
}

export function mountLauncher(options: {
  fieldCount: number
  onOpen: () => void
  onReview: () => void
}): LauncherHandle {
  const { root } = getOverlayHost()

  const launcher = document.createElement('button')
  launcher.type = 'button'
  launcher.className = 'launcher'
  launcher.setAttribute('aria-label', 'Fill this form')

  root.appendChild(launcher)

  // State the pill can be in. `busy` renders a spinner + progress; `result` renders the
  // summary and routes a click to review; `idle` renders the call to action and opens the menu.
  let mode: 'idle' | 'busy' | 'result' = 'idle'
  let fieldCount = options.fieldCount
  let result = { written: 0, needLook: 0 }

  const render = () => {
    if (mode === 'busy') {
      launcher.dataset.busy = 'true'
      return
    }
    if (mode === 'result') {
      launcher.dataset.busy = 'false'
      launcher.innerHTML = `${GLYPH.check}<span>${result.written} filled${
        result.needLook > 0 ? ` · ${result.needLook} need a look` : ''
      }</span>`
      return
    }
    launcher.dataset.busy = 'false'
    launcher.innerHTML = `${GLYPH.sparkle}<span>Fill ${fieldCount} ${
      fieldCount === 1 ? 'field' : 'fields'
    }</span>`
  }

  render()

  // ── Position ─────────────────────────────────────────────────────────────
  // The position is held in `pos` — the single source of truth — and mirrored onto the
  // standalone `translate` property, which the entrance animation's `scale` never touches.
  // Reading the position back out of the style string (as a previous version did) never
  // matched and silently snapped the pill to the bottom-right on every drag.
  let pos = {
    x: window.innerWidth - launcher.offsetWidth - EDGE,
    y: window.innerHeight - launcher.offsetHeight - EDGE,
  }

  const clampX = (x: number) =>
    Math.min(Math.max(EDGE, x), window.innerWidth - launcher.offsetWidth - EDGE)
  const clampY = (y: number) =>
    Math.min(Math.max(EDGE, y), window.innerHeight - launcher.offsetHeight - EDGE)

  const applyPosition = (x: number, y: number) => {
    pos = { x, y }
    launcher.style.translate = `${Math.round(x)}px ${Math.round(y)}px`
  }

  applyPosition(pos.x, pos.y)

  // ── Drag + click ─────────────────────────────────────────────────────────
  // The pill is both draggable and clickable. A click opens the menu; a drag moves it. The
  // threshold decides which happened.
  let dragState: {
    startX: number
    startY: number
    origX: number
    origY: number
    dragging: boolean
  } | null = null

  launcher.addEventListener('pointerdown', (event) => {
    if (mode === 'busy') return
    launcher.setPointerCapture(event.pointerId)
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      origX: pos.x,
      origY: pos.y,
      dragging: false,
    }
  })

  launcher.addEventListener('pointermove', (event) => {
    if (!dragState || mode === 'busy') return
    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY
    if (!dragState.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    dragState.dragging = true
    applyPosition(clampX(dragState.origX + dx), clampY(dragState.origY + dy))
  })

  launcher.addEventListener('pointerup', () => {
    if (!dragState) return
    const wasDrag = dragState.dragging
    if (wasDrag) void chrome.storage.local.set({ [POSITION_KEY]: pos })
    dragState = null

    if (wasDrag) return
    if (mode === 'result') options.onReview()
    else if (mode === 'idle') options.onOpen()
  })

  // Restore the remembered position, or stay bottom-right.
  void chrome.storage.local.get(POSITION_KEY).then((stored) => {
    const saved = (stored as Record<string, { x: number; y: number } | undefined>)[POSITION_KEY]
    if (saved) applyPosition(clampX(saved.x), clampY(saved.y))
  })

  // Keep it on screen when the window resizes underneath it.
  const onResize = () => applyPosition(clampX(pos.x), clampY(pos.y))
  window.addEventListener('resize', onResize)

  const anchorRect = (): Rect => {
    const rect = launcher.getBoundingClientRect()
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
  }

  return {
    element: launcher,
    anchorRect,
    setBusy: (done, total) => {
      mode = 'busy'
      launcher.dataset.busy = 'true'
      launcher.innerHTML = `<span class="launcher-ring"></span><span>${done}/${total}</span>`
    },
    setResult: (written, needLook) => {
      mode = 'result'
      result = { written, needLook }
      render()
    },
    setFieldCount: (count) => {
      fieldCount = count
      if (mode === 'idle') render()
    },
    reset: () => {
      mode = 'idle'
      render()
    },
    destroy: () => {
      window.removeEventListener('resize', onResize)
      launcher.remove()
    },
  }
}
