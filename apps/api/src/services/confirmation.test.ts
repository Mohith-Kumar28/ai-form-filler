import { FeedbackRequest } from '@aff/shared'
import { describe, expect, it } from 'vitest'

/**
 * A confirmation is its own signal.
 *
 * An inference the model got right was previously discarded — the next form re-derived it
 * from scratch and could land somewhere else. There is deliberately no "incorrect"
 * counterpart: a rejection says an answer was wrong without saying what is right, and
 * storing that in the index the next answer is retrieved from degrades later answers.
 */
describe('the confirmation signal', () => {
  it('is carried distinctly from an edit', () => {
    const parsed = FeedbackRequest.parse({
      origin: 'https://docs.google.com',
      entries: [{ label: 'How frustrating?', accepted: '9', edited: false, confirmed: true }],
    })

    expect(parsed.entries[0]?.confirmed).toBe(true)
    expect(parsed.entries[0]?.edited).toBe(false)
  })

  it('stays optional, so the submit path is unchanged', () => {
    const parsed = FeedbackRequest.parse({
      origin: 'https://docs.google.com',
      entries: [{ label: 'Phone', accepted: '+1 555 0100', edited: true }],
    })

    expect(parsed.entries[0]?.confirmed).toBeUndefined()
  })

  it('caps how much one form can teach', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      label: `Q${i}`,
      accepted: 'x',
      edited: true,
    }))

    expect(() => FeedbackRequest.parse({ origin: 'https://example.com', entries })).toThrow()
  })
})
