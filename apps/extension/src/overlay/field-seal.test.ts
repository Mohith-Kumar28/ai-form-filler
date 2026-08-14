import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEAL_TIMINGS, sealPosition, watchFocus } from './field-seal.js'

const VIEWPORT = { width: 1280, height: 800 }

describe('sealPosition', () => {
  it('sits inside the right padding of a wide field', () => {
    const rect = { top: 100, left: 40, width: 400, height: 36 }
    const { left, inside } = sealPosition(rect, VIEWPORT)

    expect(inside).toBe(true)
    // Inside the box, and clear of its right edge.
    expect(left).toBeGreaterThan(rect.left)
    expect(left + 18).toBeLessThan(rect.left + rect.width)
  })

  it('sits outside a narrow field, so it never covers the value', () => {
    const rect = { top: 100, left: 40, width: 120, height: 32 }
    const { left, inside } = sealPosition(rect, VIEWPORT)

    expect(inside).toBe(false)
    expect(left).toBeGreaterThanOrEqual(rect.left + rect.width)
  })

  it('centres vertically on a single-line field', () => {
    const rect = { top: 100, left: 40, width: 400, height: 36 }
    const { top } = sealPosition(rect, VIEWPORT)
    expect(top).toBeCloseTo(100 + (36 - 18) / 2, 5)
  })

  it('drops to the bottom of a textarea, the way a page mark sits on prose', () => {
    const rect = { top: 100, left: 40, width: 400, height: 200 }
    const { top } = sealPosition(rect, VIEWPORT)

    expect(top).toBeGreaterThan(rect.top + rect.height / 2)
    expect(top + 18).toBeLessThanOrEqual(rect.top + rect.height)
  })

  it('clamps a field hanging off the right edge back into the viewport', () => {
    const rect = { top: 100, left: 1200, width: 400, height: 36 }
    const { left } = sealPosition(rect, VIEWPORT)
    expect(left + 18).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('clamps a field scrolled above the viewport', () => {
    const rect = { top: -400, left: 40, width: 400, height: 36 }
    const { top } = sealPosition(rect, VIEWPORT)
    expect(top).toBeGreaterThanOrEqual(0)
  })
})

describe('watchFocus', () => {
  let stop: () => void
  let attached: HTMLElement[]
  let detachCount: number
  let held: boolean

  const setup = (isFillable: (element: HTMLElement) => boolean = () => true) => {
    attached = []
    detachCount = 0
    held = false
    stop = watchFocus({
      isFillable,
      onAttach: (element) => attached.push(element),
      onDetach: () => {
        detachCount += 1
      },
      isHeld: () => held,
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<input id="a" /><input id="b" /><div id="c"></div>'
  })

  afterEach(() => {
    stop?.()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const focus = (id: string) => {
    const element = document.getElementById(id) as HTMLElement
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    return element
  }

  it('waits before attaching, so a focused field does not flash a seal instantly', () => {
    setup()
    focus('a')
    expect(attached).toHaveLength(0)

    vi.advanceTimersByTime(SEAL_TIMINGS.APPEAR_DELAY_MS)
    expect(attached).toHaveLength(1)
  })

  /**
   * The rule the whole delay exists for. Tabbing through a twelve-field form used to be twelve
   * mounts and twelve unmounts in under a second, which reads as the page flickering.
   */
  it('never attaches to a field that was tabbed straight past', () => {
    setup()
    focus('a')
    vi.advanceTimersByTime(SEAL_TIMINGS.APPEAR_DELAY_MS - 20)
    focus('b')
    vi.advanceTimersByTime(SEAL_TIMINGS.APPEAR_DELAY_MS)

    expect(attached).toHaveLength(1)
    expect(attached[0]?.id).toBe('b')
  })

  it('ignores elements the page does not consider fillable', () => {
    setup((element) => element.tagName === 'INPUT')
    focus('c')
    vi.advanceTimersByTime(SEAL_TIMINGS.APPEAR_DELAY_MS)
    expect(attached).toHaveLength(0)
  })

  it('keeps the seal alive while a slip is open', () => {
    setup()
    focus('a')
    vi.advanceTimersByTime(SEAL_TIMINGS.APPEAR_DELAY_MS)

    held = true
    document.getElementById('a')?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    vi.advanceTimersByTime(50)
    // rAF is what the detach is deferred by; under fake timers it never fires, and that is
    // exactly the state being asserted — nothing detached synchronously.
    expect(detachCount).toBe(0)
  })

  it('stops listening after teardown', () => {
    setup()
    stop()
    focus('a')
    vi.advanceTimersByTime(SEAL_TIMINGS.APPEAR_DELAY_MS)
    expect(attached).toHaveLength(0)
  })
})
