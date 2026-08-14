import type { FeedbackRequest } from '@aff/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFeedbackCapture, readFieldValue } from './feedback.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

function capture() {
  const sent: FeedbackRequest[] = []
  const feedback = createFeedbackCapture('https://jobs.example.com', (p) => sent.push(p))
  return { feedback, sent }
}

describe('createFeedbackCapture', () => {
  it('sends nothing when the user changed nothing', () => {
    // An answer kept exactly as proposed restates what memory already holds. Storing one per
    // field per form would bury the corrections that actually carry signal.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: 'Because of the compiler work.' }],
      () => 'Because of the compiler work.',
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent).toHaveLength(0)
  })

  it('learns a field we left blank that the user filled in themselves', () => {
    // The phone-number case: we had no value, they typed one. Exactly as informative as a
    // correction, and invisible while only written fields were watched.
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Phone', proposed: '' }], () => '+1 555 0100')

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
    feedback.arm(many, (id) => 'x'.repeat(Number(id.slice(1)) + 1))

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent[0]?.entries).toHaveLength(12)
    expect(sent[0]?.entries[0]?.accepted).toHaveLength(30)
  })

  it('flags a corrected answer as edited — the highest-signal case', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: 'Generic answer.' }],
      () => 'The answer I actually wanted.',
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent[0]?.entries[0]?.edited).toBe(true)
    expect(sent[0]?.entries[0]?.accepted).toBe('The answer I actually wanted.')
  })

  it('ignores whitespace-only differences', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'answer' }], () => '  answer  ')

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('drops a field the user cleared — a rejection is not an answer to learn from', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'something' }], () => '')

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('reports once per fill, even if the form is submitted twice', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'corrected')

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    document.dispatchEvent(new Event('submit', { bubbles: true }))

    // A retried submission must not double-count the same answers into the bank.
    expect(sent).toHaveLength(1)
  })

  it('catches a form that submits by navigating away rather than firing submit', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'corrected')

    // Many real forms post via fetch and redirect, firing no submit event at all.
    window.dispatchEvent(new Event('pagehide'))
    expect(sent).toHaveLength(1)
  })

  it('sends nothing after disarm', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'corrected')
    feedback.disarm()

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('carries the origin so answers can be attributed to a site', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'corrected')

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent[0]?.origin).toBe('https://jobs.example.com')
  })
})

describe('readFieldValue', () => {
  it('reads a text input', () => {
    document.body.innerHTML = '<input value="hello" />'
    expect(readFieldValue(document.querySelector('input')!)).toBe('hello')
  })

  it('reads a textarea', () => {
    document.body.innerHTML = '<textarea>long answer</textarea>'
    expect(readFieldValue(document.querySelector('textarea')!)).toBe('long answer')
  })

  it('reads the visible label of a select, not the opaque value', () => {
    // "opt_1" carries no meaning into the answer bank; "United States" does.
    document.body.innerHTML = `
      <select><option value="opt_1" selected>United States</option></select>`
    expect(readFieldValue(document.querySelector('select')!)).toBe('United States')
  })

  it('reads a checked checkbox and returns null for an unchecked one', () => {
    document.body.innerHTML = '<input type="checkbox" value="yes" checked />'
    expect(readFieldValue(document.querySelector('input')!)).toBe('yes')

    document.body.innerHTML = '<input type="checkbox" value="yes" />'
    expect(readFieldValue(document.querySelector('input')!)).toBeNull()
  })

  it('reads contenteditable text', () => {
    document.body.innerHTML = '<div contenteditable="true">a cover letter</div>'
    const el = document.querySelector('div') as HTMLElement
    vi.spyOn(el, 'isContentEditable', 'get').mockReturnValue(true)
    expect(readFieldValue(el)).toBe('a cover letter')
    vi.restoreAllMocks()
  })

  it('returns null for an element it cannot read', () => {
    document.body.innerHTML = '<span>not a field</span>'
    expect(readFieldValue(document.querySelector('span')!)).toBeNull()
  })
})
