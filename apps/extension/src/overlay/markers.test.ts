import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOverlayHost } from './host.js'
import { mountFieldMark, placeTab, TAB_GAP, TAB_HEIGHT, TAB_MARGIN } from './markers.js'
import { positionScheduler, type Rect } from './scheduler.js'

/**
 * The bug this file exists for, and why it is a file rather than a line.
 *
 * The provenance label used to be placed by one expression inlined into a style write:
 *
 * ```ts
 * pill.style.translate = `calc(${box.left + box.width - 8}px - 100%) ${box.top - 8}px`
 * ```
 *
 * The `- 100%` applies to the **x** axis only. Vertically the pill sat at `top - 8` and was
 * 24px tall, so sixteen of its pixels covered the first line of the user's own answer. Nothing
 * about that expression made the mistake visible and nothing could fail because of it — it was
 * reported by a person looking at a form, which is the only way it could have been.
 *
 * `placeTab` returns numbers instead, so the property can simply be asserted.
 *
 * Fixing it also moved the collision rather than removing it, which only looking at a real form
 * revealed: the strip above a field's border belongs to its `<label>`. Hence the gutter-first
 * placement these tests pin.
 */

const VIEWPORT = { width: 1280, height: 800 }
const TAB = { width: 74, height: TAB_HEIGHT }

function field(over: Partial<Rect> = {}): Rect {
  return { top: 300, left: 200, width: 320, height: 38, ...over }
}

describe('the tab never covers the field, or its label', () => {
  it('sits in the gutter beside the field, level with its top', () => {
    // Outside the input, and off the label's line — the only strip that is reliably nobody's.
    const box = field()
    const placed = placeTab(box, TAB, VIEWPORT, null)

    expect(placed.place).toBe('beside')
    expect(placed.left).toBe(box.left + box.width + TAB_GAP)
    expect(placed.top).toBe(box.top)
  })

  it('never overlaps the input, wherever it ends up', () => {
    /**
     * The reported bug as one property, over every shape a field takes. Either the tab is left
     * of the field's leading edge, right of its trailing edge, fully above its top, or fully
     * below its bottom — never inside the box.
     */
    for (const top of [80, 200, 640]) {
      for (const height of [24, 38, 120, 600]) {
        for (const width of [90, 180, 320, 1240]) {
          const box = field({ top, height, width })
          const placed = placeTab(box, TAB, VIEWPORT, null)
          if (!placed.visible) continue

          const clearsHorizontally =
            placed.left + TAB.width <= box.left || placed.left >= box.left + box.width
          const clearsVertically =
            placed.top + TAB_HEIGHT <= box.top || placed.top >= box.top + box.height

          expect(clearsHorizontally || clearsVertically).toBe(true)
        }
      }
    }
  })

  it('falls back to above the border when the field fills the column', () => {
    // No gutter to use. Safe here for the complementary reason: a field spanning the column is
    // almost always wider than its own label.
    const box = field({ left: 20, width: 1240 })
    const placed = placeTab(box, TAB, VIEWPORT, null)

    expect(placed.place).toBe('above')
    expect(placed.top + TAB_HEIGHT).toBe(box.top - TAB_GAP)
    // Right-aligned, because labels start on the left.
    expect(placed.left).toBe(box.left + box.width - TAB.width)
  })
})

describe('the fallbacks', () => {
  const wide = (over: Partial<Rect> = {}) => field({ left: 20, width: 1240, ...over })

  it('flips below a full-width field at the very top of the viewport', () => {
    const box = wide({ top: 4 })
    const placed = placeTab(box, TAB, VIEWPORT, null)

    expect(placed.place).toBe('below')
    expect(placed.top).toBe(box.top + box.height + TAB_GAP)
  })

  it('stays on screen when the field runs past the right edge', () => {
    expect(placeTab(field({ left: 1270, width: 320 }), TAB, VIEWPORT, null).left).toBe(
      VIEWPORT.width - TAB.width - TAB_MARGIN,
    )
  })

  it('pins a tall full-width field whose top has scrolled away', () => {
    // A 600px cover letter would otherwise lose its label at exactly the moment the user
    // scrolls into the answer they are reading.
    const placed = placeTab(wide({ top: -220, height: 600 }), TAB, VIEWPORT, null)

    expect(placed.place).toBe('pinned')
    expect(placed.top).toBe(TAB_MARGIN)
  })

  it('keeps out of a scroll container it would escape', () => {
    // Better absent than floating over unrelated content while still claiming to describe a
    // field nobody can see.
    const box = { top: 100, left: 20, width: 1240, height: 20 }
    const clip: Rect = { top: 400, left: 0, width: 1280, height: 200 }

    expect(placeTab(box, TAB, VIEWPORT, clip).visible).toBe(false)
  })

  it('does not use a gutter that belongs to the scroll container', () => {
    // The space to the right of the field is outside the modal, where the tab would sit on the
    // page behind it.
    const box = { top: 300, left: 40, width: 300, height: 38 }
    const clip: Rect = { top: 200, left: 20, width: 340, height: 400 }

    expect(placeTab(box, TAB, VIEWPORT, clip).place).not.toBe('beside')
  })
})

/**
 * The frozen-mark regression.
 *
 * A mark is drawn at viewport coordinates in a fixed overlay and moves only when the scheduler
 * reports a new rect. So a mark whose anchor the page has thrown away has no way to be right
 * ever again — and it was being left on screen anyway, at the last coordinates its field
 * happened to have. On a Google Form that re-renders a question mid-fill, that is a pink ring
 * and an "I guessed" tab floating between two unrelated questions, describing neither.
 *
 * Detach used to remove the tab and keep the ring. Worse, the handle stayed live, so the fill
 * animation's closing `setState('judged')` grew a *new* tab against the stale rect — the mark
 * was capable of getting louder after its field had gone.
 */
describe('a mark whose field the page threw away', () => {
  let element: HTMLElement
  let frames: FrameRequestCallback[] = []

  const flush = () => {
    const queued = frames
    frames = []
    for (const frame of queued) frame(0)
  }

  beforeEach(() => {
    frames = []
    element = document.createElement('textarea')
    document.body.appendChild(element)
    element.getBoundingClientRect = () =>
      ({ top: 200, left: 100, width: 400, height: 60, bottom: 260, right: 500 }) as DOMRect

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    positionScheduler.clear()
    element.remove()
    getOverlayHost().destroy()
    vi.unstubAllGlobals()
  })

  it('takes the ring with it, not only the label', () => {
    const { root } = getOverlayHost()
    const mark = mountFieldMark(element, { reason: 'inferred', onOpen: () => undefined })
    flush()
    mark.setState('judged')

    expect(root.querySelectorAll('.mark')).toHaveLength(1)
    expect(root.querySelectorAll('.answer-tab')).toHaveLength(1)

    element.remove()
    positionScheduler.requestMeasure()
    flush()

    expect(root.querySelectorAll('.mark')).toHaveLength(0)
    expect(root.querySelectorAll('.answer-tab')).toHaveLength(0)
  })

  it('tells its owner, so a dead handle is not left in the map', () => {
    const detached = vi.fn()
    mountFieldMark(element, { onOpen: () => undefined, onDetach: detached })
    flush()

    element.remove()
    positionScheduler.requestMeasure()
    flush()

    expect(detached).toHaveBeenCalledTimes(1)
  })

  it('cannot be made to draw again afterwards', () => {
    // The fill animation ends with setState('judged'), which used to mount a fresh tab at the
    // stale rect — a label appearing *after* the question it describes had gone.
    const { root } = getOverlayHost()
    const mark = mountFieldMark(element, { reason: 'inferred', onOpen: () => undefined })
    flush()

    element.remove()
    positionScheduler.requestMeasure()
    flush()

    mark.setState('judged')
    mark.flash()

    expect(root.querySelectorAll('.answer-tab')).toHaveLength(0)
    expect(root.querySelectorAll('.mark')).toHaveLength(0)
    expect(mark.tabRect()).toBeNull()
  })
})
