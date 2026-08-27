import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStageWalk, FILL_STAGES, STAGE_FLOOR_MS, stageIndex } from './stage-walk.js'

/**
 * The pacing, tested against the sequence that caused the bug: the pipeline reports three stages
 * inside one tick, because two of them really are that fast.
 */
describe('createStageWalk', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const record = () => {
    const seen: string[] = []
    return { seen, walk: createStageWalk((stage) => seen.push(stage)) }
  }

  it('shows the first stage at once — a floor is a dwell, not a delay', () => {
    const { seen, walk } = record()
    walk.report('detecting')
    expect(seen).toEqual(['detecting'])
  })

  it('walks through stages reported in the same tick instead of jumping to the last', () => {
    const { seen, walk } = record()

    // What actually happens: detect and scrape both finish before a frame is drawn.
    walk.report('detecting')
    walk.report('reading')
    walk.report('generating')

    expect(seen).toEqual(['detecting'])

    vi.advanceTimersByTime(STAGE_FLOOR_MS)
    expect(seen).toEqual(['detecting', 'reading'])

    vi.advanceTimersByTime(STAGE_FLOOR_MS)
    expect(seen).toEqual(['detecting', 'reading', 'generating'])
  })

  it('never shows a stage that was not reported', () => {
    const { seen, walk } = record()

    // A single-field refill: no page read happens, so none may be claimed.
    walk.report('detecting')
    walk.report('generating')
    vi.advanceTimersByTime(STAGE_FLOOR_MS * 4)

    expect(seen).toEqual(['detecting', 'generating'])
  })

  it('adds no wait once a stage has outlasted its own floor', () => {
    const { seen, walk } = record()
    walk.report('detecting')

    // `generating` runs for many seconds; the next stage must not be held back again.
    vi.advanceTimersByTime(STAGE_FLOOR_MS * 3)
    walk.report('reading')

    expect(seen).toEqual(['detecting', 'reading'])
  })

  it('ignores a stage repeated by every progress event', () => {
    const { seen, walk } = record()
    walk.report('applying')
    walk.report('applying')
    walk.report('applying')
    vi.advanceTimersByTime(STAGE_FLOOR_MS * 3)

    expect(seen).toEqual(['applying'])
  })

  it('drains to the last reported stage when the fill ends', () => {
    const { seen, walk } = record()
    walk.report('detecting')
    walk.report('reading')
    walk.report('generating')
    walk.report('applying')

    walk.drain()

    // The intermediate labels are dropped rather than played out over two more seconds.
    expect(seen).toEqual(['detecting', 'applying'])
  })

  it('drains to nothing when the displayed stage is already the last', () => {
    const { seen, walk } = record()
    walk.report('detecting')
    walk.drain()
    expect(seen).toEqual(['detecting'])
  })

  it('stops without emitting, and stays safe when stopped twice', () => {
    const { seen, walk } = record()
    walk.report('detecting')
    walk.report('reading')

    walk.stop()
    walk.stop()
    vi.advanceTimersByTime(STAGE_FLOOR_MS * 4)

    expect(seen).toEqual(['detecting'])
  })
})

describe('stageIndex', () => {
  it('orders the stages as the pipeline reports them', () => {
    expect(FILL_STAGES).toEqual(['detecting', 'reading', 'generating', 'applying'])
    expect(stageIndex('detecting')).toBe(0)
    expect(stageIndex('applying')).toBe(3)
  })

  it('returns -1 for anything it does not know, including nothing', () => {
    expect(stageIndex('routing')).toBe(-1)
    expect(stageIndex(undefined)).toBe(-1)
  })
})
