import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AnswerCardSpec, mountAnswerCard } from './card.js'
import { getOverlayHost } from './host.js'
import { mountFieldMark } from './markers.js'
import { positionScheduler, type Rect } from './scheduler.js'

/**
 * What `Keep` promises, and the two halves of it that live in different files.
 *
 * Pressing Keep on the answer card is the one gesture that has to do two things at once: put the
 * text the person is looking at into the page, and take the "I guessed" tab off the field, because
 * they have now looked at the answer and said it is fine. The write lives in `card.ts`, the tab
 * lives in `markers.ts`, and the wiring that makes one imply the other lives in `content.ts` —
 * three files, no test, and a failure in any of them looks the same from the outside: you edit an
 * answer, press Keep, and the form still shows the old text with the label still on it.
 *
 * Neither half was covered. `overlay.test.ts` tests placement and the fill animation; nothing
 * asserted that Keep writes at all. So the contract is pinned here.
 */

const RECT: Rect = { top: 200, left: 100, width: 400, height: 60 }

/** The card's spec with the fields a test does not care about filled in. */
function spec(over: Partial<AnswerCardSpec> = {}): AnswerCardSpec {
  return {
    kind: 'answer',
    anchor: RECT,
    anchorElement: document.body,
    question: 'Why do you want this role?',
    value: 'Because it is interesting.',
    reason: 'inferred',
    mode: 'prose',
    onWrite: () => Promise.resolve(true),
    onRewrite: () => Promise.resolve(''),
    onKeep: () => undefined,
    onClear: () => undefined,
    onClose: () => undefined,
    ...over,
  }
}

function type(text: string): void {
  const { root } = getOverlayHost()
  const textarea = root.querySelector('textarea')
  if (!textarea) throw new Error('the card has no textarea')
  textarea.value = text
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Presses a button and lets the settle finish.
 *
 * `Keep` awaits the write before it reports anything — see the handler — so a test that asserts
 * straight after the click is asserting one microtask too early.
 */
async function press(label: string): Promise<void> {
  const { root } = getOverlayHost()
  const button = [...root.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )
  if (!button) throw new Error(`no button reading "${label}"`)
  button.click()
  await vi.advanceTimersByTimeAsync(0)
}

describe('Keep, on an answer that was edited', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    for (const name of ['IntersectionObserver', 'ResizeObserver']) {
      vi.stubGlobal(
        name,
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      )
    }
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })

  afterEach(() => {
    positionScheduler.clear()
    getOverlayHost().destroy()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /**
   * The reported case, and the reason the flush in the Keep handler exists.
   *
   * Typing writes through on a 500ms debounce — there is no "save to the page" button, by design.
   * So somebody who types four words and immediately presses Keep is inside the debounce window,
   * and if Keep did not flush the pending write first it would report the new answer to the
   * learning loop while leaving the old one in the form. The card would be telling the truth and
   * the page would be wrong.
   */
  it('writes the pending edit to the page before it settles', async () => {
    const written: string[] = []
    const kept: string[] = []
    const card = mountAnswerCard(
      spec({
        onWrite: (value) => {
          written.push(value)
          return Promise.resolve(true)
        },
        onKeep: (value) => kept.push(value),
      }),
    )

    type('Because I have shipped this exact thing twice.')
    // Deliberately *inside* the debounce: nothing has reached the page yet.
    expect(written).toEqual([])

    await press('Keep')

    expect(written).toEqual(['Because I have shipped this exact thing twice.'])
    expect(kept).toEqual(['Because I have shipped this exact thing twice.'])
    card.close()
  })

  /** And it must not write it twice — the flush cancels the timer rather than racing it. */
  it('does not write the same edit again when the debounce would have fired', async () => {
    const written: string[] = []
    const card = mountAnswerCard(
      spec({
        onWrite: (value) => {
          written.push(value)
          return Promise.resolve(true)
        },
      }),
    )

    type('One sentence.')
    await press('Keep')
    await vi.advanceTimersByTimeAsync(5000)

    expect(written).toEqual(['One sentence.'])
    card.close()
  })

  /** `edited` is what turns the verdict into a correction rather than an approval. */
  it('reports the answer as edited, not accepted', async () => {
    const meta: { edited: boolean; rewritten: boolean }[] = []
    const card = mountAnswerCard(spec({ onKeep: (_value, m) => meta.push(m) }))

    type('Changed.')
    await press('Keep')

    expect(meta).toEqual([{ edited: true, rewritten: false }])
    card.close()
  })

  /** Keeping an answer nobody touched is an approval, and must not claim to be an edit. */
  it('reports an untouched answer as accepted', async () => {
    const meta: { edited: boolean; rewritten: boolean }[] = []
    const card = mountAnswerCard(spec({ onKeep: (_value, m) => meta.push(m) }))

    await press('Keep')

    expect(meta).toEqual([{ edited: false, rewritten: false }])
    card.close()
  })

  /**
   * The bug the flush was hiding.
   *
   * `onWrite` says no whenever the page will not hold the value — a masked input, a select with
   * no matching option, a React field that snaps back. Keep used to fire the write into the void
   * and settle on the next line regardless, so the card closed, the tab came off, and the answer
   * went to the learning loop while the form still held the old text. Every surface agreed the
   * correction had been made except the form.
   */
  it('does not report or settle an answer the page refused', async () => {
    const kept: string[] = []
    const card = mountAnswerCard(
      spec({ onWrite: () => Promise.resolve(false), onKeep: (value) => kept.push(value) }),
    )

    type('Something the field will not hold.')
    await press('Keep')

    expect(kept).toEqual([])
    expect(card.element.dataset.state).toBe('error')
    // And it says so, rather than closing on a silent failure.
    expect(card.element.textContent).toContain("wouldn't take that")
    card.close()
  })

  /** A second try after a refusal must reach the page, not be skipped as already written. */
  it('retries the write when the answer is changed after a refusal', async () => {
    let accept = false
    const written: string[] = []
    const kept: string[] = []
    const card = mountAnswerCard(
      spec({
        onWrite: (value) => {
          written.push(value)
          return Promise.resolve(accept)
        },
        onKeep: (value) => kept.push(value),
      }),
    )

    type('Rejected phrasing.')
    await press('Keep')
    expect(kept).toEqual([])

    accept = true
    type('Accepted phrasing.')
    await press('Keep')

    expect(written).toEqual(['Rejected phrasing.', 'Accepted phrasing.'])
    expect(kept).toEqual(['Accepted phrasing.'])
    card.close()
  })

  /**
   * The other half, from the field's side.
   *
   * `content.ts` wires Keep to `reportVerdict`, whose first act is to destroy the mark. This is
   * that wiring in miniature: the point is that the ring **and** the tab go, not just one of
   * them — a mark that keeps its ring after being approved is the same "nothing I do clears
   * this" complaint as one that keeps its label.
   */
  it('takes the "I guessed" tab and the ring off the field', async () => {
    const element = document.createElement('textarea')
    document.body.appendChild(element)
    element.getBoundingClientRect = () => ({ ...RECT, bottom: 260, right: 500 }) as DOMRect

    const { root } = getOverlayHost()
    const mark = mountFieldMark(element, { reason: 'inferred', onOpen: () => undefined })
    mark.setState('judged')

    expect(root.querySelectorAll('.answer-tab')).toHaveLength(1)
    expect(root.querySelectorAll('.mark')).toHaveLength(1)

    const card = mountAnswerCard(
      spec({
        anchorElement: element,
        // Exactly what `reportVerdict` does with the verdict, minus the teaching.
        onKeep: () => mark.destroy(),
      }),
    )

    type('Corrected by hand.')
    await press('Keep')

    expect(root.querySelectorAll('.answer-tab')).toHaveLength(0)
    expect(root.querySelectorAll('.mark')).toHaveLength(0)
    card.close()
    element.remove()
  })
})
