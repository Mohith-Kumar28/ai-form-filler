import { describe, expect, it, vi } from 'vitest'
import { ANIMATION_TIMINGS, type AnimatedFill, runFillAnimation } from './animate.js'
import { clampToViewport } from './scheduler.js'

const VIEWPORT = { width: 1000, height: 800 }
const PILL = { width: 150, height: 32 }

describe('clampToViewport', () => {
  it('prefers sitting above the anchor', () => {
    const { top } = clampToViewport({ top: 400, left: 100, width: 300, height: 40 }, PILL, VIEWPORT)
    // 400 - 32 - 8 = 360
    expect(top).toBe(360)
  })

  it('drops below when there is no room above', () => {
    const { top } = clampToViewport({ top: 10, left: 100, width: 300, height: 40 }, PILL, VIEWPORT)
    // Above would be negative, so it goes under: 10 + 40 + 8 = 58
    expect(top).toBe(58)
  })

  it('keeps the pill on screen when the anchor is near the right edge', () => {
    const { left } = clampToViewport({ top: 100, left: 960, width: 200, height: 40 }, PILL, VIEWPORT)
    expect(left).toBeLessThanOrEqual(VIEWPORT.width - PILL.width)
    expect(left).toBeGreaterThanOrEqual(0)
  })

  it('never goes off the left edge for an anchor positioned off-screen', () => {
    const { left } = clampToViewport({ top: 100, left: -500, width: 50, height: 40 }, PILL, VIEWPORT)
    expect(left).toBeGreaterThanOrEqual(0)
  })

  it('stays on screen for an anchor below the fold', () => {
    const { top } = clampToViewport({ top: 790, left: 100, width: 300, height: 40 }, PILL, VIEWPORT)
    expect(top + PILL.height).toBeLessThanOrEqual(VIEWPORT.height)
  })
})

function fill(overrides: Partial<AnimatedFill> & { fieldId: string }): AnimatedFill {
  const element = document.createElement('input')
  document.body.appendChild(element)
  return {
    element,
    value: 'x',
    needsReview: false,
    apply: () => true,
    ...overrides,
  }
}

describe('runFillAnimation', () => {
  it('applies every field and reports them', async () => {
    document.body.innerHTML = ''
    const result = await runFillAnimation([
      fill({ fieldId: 'a' }),
      fill({ fieldId: 'b' }),
    ])
    expect(result.applied.sort()).toEqual(['a', 'b'])
    expect(result.failed).toEqual([])
  })

  it('reports a field whose element rejected the value', async () => {
    document.body.innerHTML = ''
    const result = await runFillAnimation([fill({ fieldId: 'a', apply: () => false })])
    expect(result.applied).toEqual([])
    expect(result.failed).toEqual(['a'])
  })

  it('keeps going when one field throws', async () => {
    document.body.innerHTML = ''
    const result = await runFillAnimation([
      fill({
        fieldId: 'boom',
        apply: () => {
          throw new Error('a page listener exploded')
        },
      }),
      fill({ fieldId: 'ok' }),
    ])
    // One page listener throwing must not abort the rest of the form.
    expect(result.applied).toEqual(['ok'])
    expect(result.failed).toEqual(['boom'])
  })

  it('fails a field whose element left the DOM while the model was thinking', async () => {
    document.body.innerHTML = ''
    const detached = fill({ fieldId: 'gone' })
    detached.element.remove()

    const result = await runFillAnimation([detached])
    expect(result.failed).toEqual(['gone'])
  })

  it('awaits an adapter that applies asynchronously', async () => {
    document.body.innerHTML = ''
    const result = await runFillAnimation([
      fill({ fieldId: 'async', apply: async () => true }),
    ])
    expect(result.applied).toEqual(['async'])
  })

  it('fills in document order, not plan order', async () => {
    document.body.innerHTML = ''
    const first = fill({ fieldId: 'first' })
    const second = fill({ fieldId: 'second' })

    const order: string[] = []
    // Deliberately passed out of order — the eye follows down the page, so a model that
    // answered the last field first must not make the sequence jump around.
    await runFillAnimation([second, first], {
      onFieldStart: (id) => order.push(id),
    })

    expect(order).toEqual(['first', 'second'])
  })

  it('reports state per field through the hooks', async () => {
    document.body.innerHTML = ''
    const started: string[] = []
    const ended: [string, boolean][] = []

    await runFillAnimation(
      [fill({ fieldId: 'a' }), fill({ fieldId: 'b', apply: () => false })],
      {
        onFieldStart: (id) => started.push(id),
        onFieldEnd: (id, ok) => ended.push([id, ok]),
      },
    )

    expect(started).toEqual(['a', 'b'])
    expect(ended).toEqual([
      ['a', true],
      ['b', false],
    ])
  })
})

describe('reduced motion', () => {
  it('writes values immediately with no stagger or typing', async () => {
    document.body.innerHTML = ''
    // The OS-level request is honoured completely, not merely shortened.
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList)

    const started = performance.now()
    await runFillAnimation([fill({ fieldId: 'a' }), fill({ fieldId: 'b' }), fill({ fieldId: 'c' })])
    const elapsed = performance.now() - started

    // Three staggered fields would cost at least 3 × STAGGER_MS on top of any typing.
    expect(elapsed).toBeLessThan(ANIMATION_TIMINGS.STAGGER_MS * 3)
    vi.restoreAllMocks()
  })
})

describe('animation timings', () => {
  it('caps typing so a long cover letter does not take a minute', () => {
    const coverLetter = 2000
    const uncapped = coverLetter * ANIMATION_TIMINGS.TYPE_MS_PER_CHAR
    expect(uncapped).toBeGreaterThan(10_000)
    expect(ANIMATION_TIMINGS.MAX_TYPE_MS).toBeLessThanOrEqual(500)
  })

  it('keeps a 20-field form under a few seconds of stagger', () => {
    expect(ANIMATION_TIMINGS.STAGGER_MS * 20).toBeLessThan(2000)
  })
})
