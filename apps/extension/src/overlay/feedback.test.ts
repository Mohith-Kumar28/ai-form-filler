import type { FeedbackRequest } from '@aff/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createFeedbackCapture, displayValueOf } from './feedback.js'

/**
 * Reading the page is no longer tested here, because it no longer happens here — see
 * `FormAdapter.readValue` and `read.test.ts` in form-adapters. A local helper that understood
 * native controls only was why a Google Forms dropdown could never be learned.
 */

beforeEach(() => {
  document.body.innerHTML = ''
})

function capture() {
  const sent: FeedbackRequest[] = []
  const feedback = createFeedbackCapture('https://jobs.example.com', (p) => sent.push(p))
  return { feedback, sent }
}

/** A page whose fields are all still present — the ordinary case. */
function live(read: (fieldId: string) => string | null) {
  return { read, isAlive: () => true }
}

describe('createFeedbackCapture', () => {
  it('sends nothing when the user changed nothing', () => {
    // An answer kept exactly as proposed restates what memory already holds. Storing one per
    // field per form would bury the corrections that actually carry signal.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: 'Because of the compiler work.' }],
      live(() => 'Because of the compiler work.'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent).toHaveLength(0)
  })

  it('learns a field we left blank that the user filled in themselves', () => {
    // The phone-number case: we had no value, they typed one. Exactly as informative as a
    // correction, and invisible while only written fields were watched.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Phone', proposed: '' }],
      live(() => '+1 555 0100'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent[0]?.entries).toEqual([
      { label: 'Phone', proposed: '', accepted: '+1 555 0100', edited: true },
    ])
  })

  it('caps how much one submission may teach', () => {
    const { feedback, sent } = capture()
    const many = Array.from({ length: 30 }, (_, i) => ({
      fieldId: `f${i}`,
      label: `Q${i}`,
      proposed: '',
    }))
    // Longer answers survive the cap: a corrected essay carries more reusable voice than a
    // corrected postcode.
    feedback.arm(
      many,
      live((id) => 'x'.repeat(Number(id.slice(1)) + 1)),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent[0]?.entries).toHaveLength(12)
    expect(sent[0]?.entries[0]?.accepted).toHaveLength(30)
  })

  it('flags a corrected answer as edited — the highest-signal case', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: 'Generic answer.' }],
      live(() => 'The answer I actually wanted.'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent[0]?.entries[0]?.edited).toBe(true)
    expect(sent[0]?.entries[0]?.accepted).toBe('The answer I actually wanted.')
  })

  it('ignores whitespace-only differences', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'answer' }],
      live(() => '  answer  '),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('drops a field the user cleared — a rejection is not an answer to learn from', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'something' }],
      live(() => ''),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('reports once per fill, even if the form is submitted twice', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'a' }],
      live(() => 'corrected'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    document.dispatchEvent(new Event('submit', { bubbles: true }))

    // A retried submission must not double-count the same answers into the bank.
    expect(sent).toHaveLength(1)
  })

  it('catches a form that submits by navigating away rather than firing submit', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'a' }],
      live(() => 'corrected'),
    )

    // Many real forms post via fetch and redirect, firing no submit event at all.
    window.dispatchEvent(new Event('pagehide'))
    expect(sent).toHaveLength(1)
  })

  it('sends nothing after disarm', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'a' }],
      live(() => 'corrected'),
    )
    feedback.disarm()

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('carries the origin so answers can be attributed to a site', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'a' }],
      live(() => 'corrected'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent[0]?.origin).toBe('https://jobs.example.com')
  })
})

describe('a form that replaces its questions before submitting', () => {
  it('still reports answers the page has since torn down', () => {
    // Page one of a multi-page Google Form is gone by the time anything submits. Reading only
    // the live DOM meant most of a long form taught nothing at all.
    const { feedback, sent } = capture()
    let present = true

    feedback.arm([{ fieldId: 'f1', label: 'Which device do you use?', proposed: '' }], {
      read: () => (present ? 'iOS' : null),
      isAlive: () => present,
    })

    // The user commits an answer, then "Next" replaces the question.
    document.dispatchEvent(new Event('change', { bubbles: true }))
    present = false

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent[0]?.entries[0]?.accepted).toBe('iOS')
  })

  it('captures an ARIA widget, which fires no change event at all', () => {
    // Google's radios and checkboxes are divs: a click is the only evidence they were touched.
    const { feedback, sent } = capture()
    let present = true

    feedback.arm([{ fieldId: 'f1', label: 'Which device do you use?', proposed: '' }], {
      read: () => (present ? 'iOS' : null),
      isAlive: () => present,
    })

    document.dispatchEvent(new Event('click', { bubbles: true }))
    present = false

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent[0]?.entries[0]?.accepted).toBe('iOS')
  })

  it('does not resurrect an answer the user deliberately cleared', () => {
    // Empty *and* still on the page is a rejection. Falling back to the snapshot here would
    // teach the very answer the user just deleted.
    const { feedback, sent } = capture()
    let value: string | null = 'iOS'

    feedback.arm([{ fieldId: 'f1', label: 'Which device do you use?', proposed: '' }], {
      read: () => value,
      isAlive: () => true,
    })

    document.dispatchEvent(new Event('change', { bubbles: true }))
    value = null

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })
})

describe('a choice the user did not touch is not an edit', () => {
  const options = [
    { value: 'opt_1', label: 'United States' },
    { value: 'opt_2', label: 'India' },
  ]

  it('compares what the page shows against what the page shows', () => {
    // The model answers with an option's value; every widget reads back its label. Comparing
    // the two directly reported an edit on every untouched dropdown, and taught the answer to
    // itself on every submit.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Country', proposed: displayValueOf({ options }, 'opt_1') }],
      live(() => 'United States'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('still reports a real change to a different option', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [
        {
          fieldId: 'f1',
          label: 'Country',
          kind: 'select',
          proposed: displayValueOf({ options }, 'opt_1'),
        },
      ],
      live(() => 'India'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent[0]?.entries[0]).toMatchObject({ accepted: 'India', kind: 'select', edited: true })
  })

  it('treats a multi-select as a set, not an ordered list', () => {
    // Re-ordering the same two selections is not a correction, and reporting it as one would rewrite
    // the same answer on every submit.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Tools', kind: 'multiselect', proposed: 'Notion, Coda' }],
      live(() => 'Coda, Notion'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('reports an added selection', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Tools', kind: 'multiselect', proposed: 'Notion' }],
      live(() => 'Notion, Coda'),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent[0]?.entries[0]?.accepted).toBe('Notion, Coda')
  })
})

describe('displayValueOf', () => {
  const options = [
    { value: 'opt_1', label: 'United States' },
    { value: 'opt_2', label: 'India' },
  ]

  it('maps an option value to the label the page displays', () => {
    expect(displayValueOf({ options }, 'opt_1')).toBe('United States')
  })

  it('maps every value in a multi-selection', () => {
    expect(displayValueOf({ options }, 'opt_2, opt_1')).toBe('India, United States')
  })

  it('leaves a label alone when the model already answered with one', () => {
    expect(displayValueOf({ options }, 'India')).toBe('India')
  })

  it('prefers the whole answer over splitting it — option labels contain commas', () => {
    const withComma = [{ value: 'y', label: 'Yes, I agree' }]
    expect(displayValueOf({ options: withComma }, 'y')).toBe('Yes, I agree')
  })

  it('passes free text through untouched', () => {
    expect(displayValueOf({}, 'a long written answer')).toBe('a long written answer')
  })
})
