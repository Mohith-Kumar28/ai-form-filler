import { GLYPH, getOverlayHost } from './host.js'
import { positionScheduler, type Rect } from './scheduler.js'

/**
 * The seal: an 18px mark inside the field you are currently answering, and the extension's
 * entire on-page presence.
 *
 * What it replaces was a box pinned to the bottom-right of every page with three or more
 * inputs, mounted whether or not anyone had asked for it, carrying five hand-rolled states and
 * rotating a line of copy every 2.4 seconds while you waited. Nothing renders now until a
 * field takes focus.
 *
 * The rules are the ones every field-anchored assistant learns the hard way:
 *
 *   - **Never on hover.** Opening under an unintended cursor lands the popover on the field
 *     the person is typing into. Click, or the keyboard shortcut.
 *   - **Never over the text.** Inside the right padding on a wide field, outside the right
 *     edge on a narrow one, bottom-right on a textarea.
 *   - **Never instantly.** A 120ms delay, so tabbing through twelve fields does not strobe.
 *   - **Always dismissible**, per origin, permanently.
 */

/** Long enough that tab-through does not flicker, short enough to feel attached to the focus. */
const APPEAR_DELAY_MS = 120
const SEAL_SIZE = 18
/** Below this a seal inside the field would sit on top of the value. */
const MIN_INSIDE_WIDTH = 220
/** Above this the field is a prose box, and the seal belongs at the bottom like a page mark. */
const TEXTAREA_HEIGHT = 56

/**
 * Where the seal sits relative to its field. Pure, so the rules are testable without a layout
 * engine — these are the rules that decide whether the mark ever covers what someone typed.
 *
 *   wide field    inside the right padding, vertically centred
 *   narrow field  just outside the right edge, so it cannot sit on the value
 *   tall field    bottom-right, the way a page mark sits on prose
 */
export function sealPosition(
  rect: Rect,
  viewport: { width: number; height: number },
): { left: number; top: number; inside: boolean } {
  const tall = rect.height > TEXTAREA_HEIGHT
  const inside = rect.width >= MIN_INSIDE_WIDTH

  const left = inside ? rect.left + rect.width - SEAL_SIZE - 7 : rect.left + rect.width + 5
  const top = tall
    ? rect.top + rect.height - SEAL_SIZE - 7
    : rect.top + (rect.height - SEAL_SIZE) / 2

  return {
    left: Math.min(Math.max(2, left), viewport.width - SEAL_SIZE - 2),
    top: Math.min(Math.max(2, top), viewport.height - SEAL_SIZE - 2),
    inside,
  }
}

export interface SealHandle {
  element: HTMLButtonElement
  /** Viewport rect of the field it is attached to, for anchoring the slip. */
  anchorRect: () => Rect | null
  /**
   * `null` clears it, a number fills the ring clockwise, and `'sweeping'` is the honest state
   * for the model call — which reports nothing until it returns.
   */
  setProgress: (ratio: number | 'sweeping' | null) => void
  setExpanded: (expanded: boolean) => void
  destroy: () => void
}

export function mountSeal(element: HTMLElement, onOpen: () => void): SealHandle {
  const { root } = getOverlayHost()

  const seal = document.createElement('button')
  seal.type = 'button'
  seal.className = 'seal'
  seal.innerHTML = GLYPH.seal
  seal.setAttribute('aria-label', 'Fill this field')
  seal.setAttribute('aria-expanded', 'false')
  // Never in the page's tab order: tabbing between fields must not stop here. It is reachable
  // by the shortcut, and by clicking.
  seal.tabIndex = -1

  seal.addEventListener('mousedown', (event) => {
    // Without this the field blurs before the click lands, which unmounts the seal underneath
    // the pointer and the click hits the page instead.
    event.preventDefault()
  })

  seal.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onOpen()
  })

  root.appendChild(seal)

  let rect: Rect | null = null

  const untrack = positionScheduler.track({
    element,
    onMove: (next, visible) => {
      rect = next
      seal.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return

      const { left, top } = sealPosition(next, {
        width: window.innerWidth,
        height: window.innerHeight,
      })

      // `translate`, not `transform` — the entrance keyframes own `scale`, and sharing one
      // property between placement and animation is what parked every seal at the page origin.
      seal.style.translate = `${Math.round(left)}px ${Math.round(top)}px`
    },
  })

  return {
    element: seal,
    anchorRect: () => rect,
    setProgress: (ratio) => {
      if (ratio === null) {
        seal.removeAttribute('data-progress')
        seal.style.removeProperty('--progress')
        return
      }
      if (ratio === 'sweeping') {
        seal.setAttribute('data-progress', 'indeterminate')
        seal.style.removeProperty('--progress')
        return
      }
      seal.setAttribute('data-progress', 'determinate')
      seal.style.setProperty('--progress', String(Math.max(0, Math.min(1, ratio))))
    },
    setExpanded: (expanded) => seal.setAttribute('aria-expanded', String(expanded)),
    destroy: () => {
      untrack()
      seal.remove()
    },
  }
}

/**
 * Watches focus and decides when a seal should exist.
 *
 * Returns a teardown. The delay is cancelled rather than debounced on purpose: a person who
 * tabs straight past a field should never see a seal appear at all, not see one appear late.
 */
export function watchFocus(options: {
  isFillable: (element: HTMLElement) => boolean
  onAttach: (element: HTMLElement) => void
  onDetach: () => void
  /** True while a slip is open, which keeps the seal alive through the field losing focus. */
  isHeld: () => boolean
}): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const onFocusIn = (event: FocusEvent) => {
    const target = event.target as HTMLElement | null
    cancel()
    if (!target || !options.isFillable(target)) {
      if (!options.isHeld()) options.onDetach()
      return
    }
    timer = setTimeout(() => options.onAttach(target), APPEAR_DELAY_MS)
  }

  const onFocusOut = () => {
    cancel()
    // One frame, so focus moving *into* the slip does not read as leaving the field.
    requestAnimationFrame(() => {
      if (!options.isHeld()) options.onDetach()
    })
  }

  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)

  return () => {
    cancel()
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
  }
}

/** Per-origin, permanent, and the only thing the seal's slip offers that is about itself. */
const MUTED_KEY = 'aff:mutedOrigins'

export async function isMuted(origin: string): Promise<boolean> {
  const stored = (await chrome.storage.local.get(MUTED_KEY)) as Record<string, string[] | undefined>
  return (stored[MUTED_KEY] ?? []).includes(origin)
}

export async function mute(origin: string): Promise<void> {
  const stored = (await chrome.storage.local.get(MUTED_KEY)) as Record<string, string[] | undefined>
  const current = stored[MUTED_KEY] ?? []
  if (current.includes(origin)) return
  await chrome.storage.local.set({ [MUTED_KEY]: [...current, origin] })
}

export const SEAL_TIMINGS = { APPEAR_DELAY_MS, MIN_INSIDE_WIDTH, TEXTAREA_HEIGHT } as const
