import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getOverlayHost } from './host.js'
import { clearLearningNotes, mountLearningNote, noteLearning } from './learning.js'
import { positionScheduler } from './scheduler.js'

/**
 * The receipt for the one interaction the product is built around.
 *
 * What is actually being pinned here is honesty. The chip's whole reason to exist is that
 * learning used to be unobservable — a correction was captured, sent, and either stored or
 * silently lost, with nothing anywhere distinguishing the two. A chip that said "remembered"
 * whatever came back would recreate exactly that problem while looking like it had solved it.
 */
describe('the learning chip', () => {
  let element: HTMLElement
  let frames: FrameRequestCallback[] = []

  const flush = () => {
    const queued = frames
    frames = []
    for (const frame of queued) frame(0)
  }

  const chip = () => getOverlayHost().root.querySelector<HTMLElement>('.learn-chip')

  beforeEach(() => {
    vi.useFakeTimers()
    frames = []
    element = document.createElement('textarea')
    document.body.appendChild(element)
    element.getBoundingClientRect = () =>
      ({ top: 120, left: 60, width: 400, height: 80, bottom: 200, right: 460 }) as DOMRect

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
    clearLearningNotes()
    positionScheduler.clear()
    element.remove()
    getOverlayHost().destroy()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('claims nothing while the answer is still in flight', async () => {
    let settle: (value: { ok: true; value: { recorded: number } }) => void = () => undefined
    noteLearning(element, new Promise((resolve) => (settle = resolve)))
    flush()

    expect(chip()?.dataset.state).toBe('learning')
    expect(chip()?.textContent).toContain('Learning')

    settle({ ok: true, value: { recorded: 1 } })
    await vi.advanceTimersByTimeAsync(0)

    expect(chip()?.dataset.state).toBe('learned')
  })

  it('says it already knew, rather than claiming to have learned, when nothing was recorded', async () => {
    // The server holds this answer already. Saying "remembered" would be true only by accident,
    // and would make a no-op indistinguishable from a write.
    noteLearning(element, Promise.resolve({ ok: true, value: { recorded: 0 } }))
    flush()
    await vi.advanceTimersByTimeAsync(0)

    expect(chip()?.dataset.state).toBe('known')
  })

  it('says so when it did not land', async () => {
    // The reported bug: a dead session, or a batch rejected for one bad entry, used to be
    // indistinguishable from the product deciding the correction was not worth keeping.
    noteLearning(element, Promise.resolve({ ok: false }))
    flush()
    await vi.advanceTimersByTimeAsync(0)

    expect(chip()?.dataset.state).toBe('failed')
    expect(chip()?.textContent).toContain("Couldn't save")
  })

  it('leaves on its own once it has settled', async () => {
    noteLearning(element, Promise.resolve({ ok: true, value: { recorded: 2 } }))
    flush()
    await vi.advanceTimersByTimeAsync(0)
    expect(chip()).not.toBeNull()

    await vi.advanceTimersByTimeAsync(4000)

    expect(chip()).toBeNull()
  })

  it('stays while it is still learning, however long that takes', async () => {
    noteLearning(element, new Promise(() => undefined))
    flush()

    await vi.advanceTimersByTimeAsync(30_000)

    // A pending chip has no deadline of its own: the request it describes is what ends it.
    expect(chip()?.dataset.state).toBe('learning')
  })

  it('sits under the field, never over the answer it is about', () => {
    mountLearningNote(element, 'learned')
    flush()

    // Above a field is its own label, and the answer being acknowledged is directly above too.
    expect(chip()?.style.translate).toBe('60px 206px')
  })

  it('keeps one chip per field rather than stacking them', () => {
    // A field can settle twice in quick succession — a typed edit, then Keep on the card — and
    // two chips at the same coordinates render as one smeared chip.
    mountLearningNote(element, 'learning')
    mountLearningNote(element, 'learned')
    flush()

    expect(getOverlayHost().root.querySelectorAll('.learn-chip')).toHaveLength(1)
    expect(chip()?.dataset.state).toBe('learned')
  })

  it('goes when the page throws the field away', () => {
    mountLearningNote(element, 'learned')
    flush()

    element.remove()
    positionScheduler.requestMeasure()
    flush()

    expect(chip()).toBeNull()
  })
})
