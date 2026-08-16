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
  setResult: (written: number, worthChecking: number) => void
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
  // summary and routes a click to review; `idle` renders the field count and opens the menu.
  let mode: 'idle' | 'busy' | 'result' = 'idle'
  let fieldCount = options.fieldCount
  let result = { written: 0, worthChecking: 0 }

  const render = () => {
    if (mode === 'busy') {
      launcher.dataset.busy = 'true'
      return
    }
    if (mode === 'result') {
      launcher.dataset.busy = 'false'
      launcher.innerHTML = `${GLYPH.check}<span>${result.written} filled${
        result.worthChecking > 0 ? ` · ${result.worthChecking} to check` : ''
      }</span>`
      return
    }
    launcher.dataset.busy = 'false'
    launcher.innerHTML = `${GLYPH.sparkle}<span>${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}</span>`
  }

  render()

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

  const clampX = (x: number) =>
    Math.min(Math.max(EDGE, x), window.innerWidth - launcher.offsetWidth - EDGE)
  const clampY = (y: number) =>
    Math.min(Math.max(EDGE, y), window.innerHeight - launcher.offsetHeight - EDGE)

  const setPosition = (x: number, y: number) => {
    launcher.style.translate = `${Math.round(x)}px ${Math.round(y)}px`
  }

  const parsePosition = (): { x: number; y: number } | null => {
    const match = /translate\s*:\s*([\d.-]+)px ([\d.-]+)px/.exec(launcher.style.translate)
    const x = match?.[1]
    const y = match?.[2]
    if (x === undefined || y === undefined) return null
    return { x: Number.parseFloat(x), y: Number.parseFloat(y) }
  }

  launcher.addEventListener('pointerdown', (event) => {
    if (mode === 'busy') return
    launcher.setPointerCapture(event.pointerId)
    const current = parsePosition()
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      origX: current?.x ?? window.innerWidth - launcher.offsetWidth - EDGE,
      origY: current?.y ?? window.innerHeight - launcher.offsetHeight - EDGE,
      dragging: false,
    }
  })

  launcher.addEventListener('pointermove', (event) => {
    if (!dragState || mode === 'busy') return
    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY
    if (!dragState.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    dragState.dragging = true
    setPosition(clampX(dragState.origX + dx), clampY(dragState.origY + dy))
  })

  launcher.addEventListener('pointerup', () => {
    if (!dragState) return
    const wasDrag = dragState.dragging
    if (wasDrag) {
      const current = parsePosition()
      if (current) void chrome.storage.local.set({ [POSITION_KEY]: current })
    }
    dragState = null

    if (wasDrag) return
    if (mode === 'result') options.onReview()
    else if (mode === 'idle') options.onOpen()
  })

  // Place at the remembered position, or bottom-right.
  void chrome.storage.local.get(POSITION_KEY).then((stored) => {
    const saved = (stored as Record<string, { x: number; y: number } | undefined>)[POSITION_KEY]
    if (saved) {
      setPosition(clampX(saved.x), clampY(saved.y))
    } else {
      setPosition(
        window.innerWidth - launcher.offsetWidth - EDGE,
        window.innerHeight - launcher.offsetHeight - EDGE,
      )
    }
  })

  const anchorRect = (): Rect => {
    const current = parsePosition()
    return {
      top: current?.y ?? window.innerHeight - launcher.offsetHeight - EDGE,
      left: current?.x ?? EDGE,
      width: launcher.offsetWidth,
      height: launcher.offsetHeight,
    }
  }

  return {
    element: launcher,
    anchorRect,
    setBusy: (done, total) => {
      mode = 'busy'
      launcher.dataset.busy = 'true'
      launcher.innerHTML = `<span class="launcher-ring"></span><span>${done}/${total}</span>`
    },
    setResult: (written, worthChecking) => {
      mode = 'result'
      result = { written, worthChecking }
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
    destroy: () => launcher.remove(),
  }
}
