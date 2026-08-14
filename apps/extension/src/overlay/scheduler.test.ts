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
