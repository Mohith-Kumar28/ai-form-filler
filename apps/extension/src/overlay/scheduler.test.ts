import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { positionScheduler } from './scheduler.js'

/**
 * The regression this file exists for.
 *
 * `visible` used to start `false` and only ever become `true` from an IntersectionObserver
 * callback. So the very first measurement reported hidden and returned before writing a
 * position, and the cull rule then skipped the target for good — anything mounted on an
 * element the observer had not yet spoken about sat unpositioned at the overlay's origin,
 * which is the page's top-left corner. Transient markers masked it for a year; a seal anchored
 * inside the field you are typing in does not.
 */
describe('positionScheduler', () => {
  let element: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()

    element = document.createElement('input')
    document.body.appendChild(element)
    element.getBoundingClientRect = () =>
      ({ top: 120, left: 40, width: 320, height: 38, bottom: 158, right: 360 }) as DOMRect

    // happy-dom has no IntersectionObserver, which is precisely the condition being tested:
    // nothing will ever flip `visible` from the outside.
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
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    positionScheduler.clear()
    element.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('positions a target on the first frame, without waiting on the observer', () => {
    const moves: { visible: boolean; top: number }[] = []

    positionScheduler.track({
      element,
      onMove: (rect, visible) => moves.push({ visible, top: rect.top }),
    })

    expect(moves).toHaveLength(1)
    expect(moves[0]?.visible).toBe(true)
    expect(moves[0]?.top).toBe(120)
  })

  it('reports a target outside the viewport as not visible', () => {
    element.getBoundingClientRect = () =>
      ({ top: -400, left: 40, width: 320, height: 38, bottom: -362, right: 360 }) as DOMRect

    const moves: boolean[] = []
    positionScheduler.track({ element, onMove: (_rect, visible) => moves.push(visible) })

    expect(moves).toEqual([false])
  })

  it('stops tracking when untracked', () => {
    const untrack = positionScheduler.track({ element, onMove: () => undefined })
    expect(positionScheduler.size).toBe(1)
    untrack()
    expect(positionScheduler.size).toBe(0)
  })

  it('does not keep reporting a target that has not moved', () => {
    const moves: number[] = []
    positionScheduler.track({ element, onMove: (rect) => moves.push(rect.top) })

    positionScheduler.requestMeasure()
    positionScheduler.requestMeasure()

    // One report for the initial placement, and nothing after: a rect that has not changed is
    // a repaint nobody asked for, on every frame, on somebody else's page.
    expect(moves).toEqual([120])
  })
})

/**
 * The stale-marker regression.
 *
 * A mark is drawn at viewport coordinates and only ever moved by `onMove`. So the moment the
 * scheduler stops reporting a target, whatever is mounted on it freezes exactly where it was —
 * and a ring frozen over the wrong part of the page is worse than no ring, because it points
 * confidently at a field that is not there.
 *
 * Two ways that used to happen, both reproduced here.
 */
/**
 * The stale-marker regression.
 *
 * A mark is drawn at viewport coordinates and only ever moved by `onMove`. So the moment the
 * scheduler stops reporting a target, whatever is mounted on it freezes exactly where it was —
 * and a ring frozen over the wrong part of the page is worse than no ring, because it points
 * confidently at a field that is not there.
 *
 * These use a **queued** rAF rather than the synchronous stub above, because the thing under
 * test is what the second measure pass does, and a synchronous stub cannot produce one: the
 * scheduler assigns its frame handle after `requestAnimationFrame` returns, so a stub that
 * runs the callback inline leaves the handle set and every later `requestMeasure` coalesces
 * into a frame that has already been and gone.
 */
describe('positionScheduler staleness', () => {
  let element: HTMLElement
  let intersect: ((entries: { target: Element; isIntersecting: boolean }[]) => void) | null = null
  let frames: FrameRequestCallback[] = []

  const flush = () => {
    const queued = frames
    frames = []
    for (const frame of queued) frame(0)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    frames = []
    element = document.createElement('input')
    document.body.appendChild(element)
    element.getBoundingClientRect = () =>
      ({ top: 120, left: 40, width: 320, height: 38, bottom: 158, right: 360 }) as DOMRect

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
          intersect = callback
        }
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
    intersect = null
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reports a target hidden before it stops measuring it', () => {
    const moves: boolean[] = []
    positionScheduler.track({ element, onMove: (_rect, visible) => moves.push(visible) })
    flush()
    expect(moves).toEqual([true])

    // The anchor leaves the viewport. The cull rule used to skip it *before* anything was
    // reported, so the mark was never told to hide and stayed painted at its last position.
    intersect?.([{ target: element, isIntersecting: false }])
    flush()

    expect(moves).toEqual([true, false])
  })

  it('says it once, not on every frame', () => {
    const moves: boolean[] = []
    positionScheduler.track({ element, onMove: (_rect, visible) => moves.push(visible) })
    flush()

    intersect?.([{ target: element, isIntersecting: false }])
    flush()
    positionScheduler.requestMeasure()
    flush()
    positionScheduler.requestMeasure()
    flush()

    // Hidden is a state, not an event. Repeating it is a write per frame on somebody else's page.
    expect(moves).toEqual([true, false])
  })

  it('re-measures a culled target on invalidate', () => {
    const moves: { top: number; visible: boolean }[] = []
    positionScheduler.track({
      element,
      onMove: (rect, visible) => moves.push({ top: rect.top, visible }),
    })
    flush()

    intersect?.([{ target: element, isIntersecting: false }])
    flush()
    expect(moves.at(-1)?.visible).toBe(false)

    /**
     * The side panel opening or closing reflows the page: every rect changes at once, and a
     * culled target has no event that would ever tell it so. `requestMeasure` alone cannot fix
     * this — culled targets are skipped by design — which is why invalidation is separate.
     */
    element.getBoundingClientRect = () =>
      ({ top: 300, left: 40, width: 320, height: 38, bottom: 338, right: 360 }) as DOMRect
    positionScheduler.invalidate()
    flush()

    expect(moves.at(-1)).toEqual({ top: 300, visible: true })
  })
})
