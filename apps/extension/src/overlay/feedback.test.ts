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
  it('reports an untouched answer as accepted, not edited', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: 'Because of the compiler work.' }],
      () => 'Because of the compiler work.',
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent[0]?.entries[0]).toEqual({
      label: 'Why us?',
      proposed: 'Because of the compiler work.',
      accepted: 'Because of the compiler work.',
      edited: false,
    })
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
    expect(sent[0]?.entries[0]?.edited).toBe(false)
  })

  it('drops a field the user cleared — a rejection is not an answer to learn from', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'something' }], () => '')

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('reports once per fill, even if the form is submitted twice', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'a')

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    document.dispatchEvent(new Event('submit', { bubbles: true }))

    // A retried submission must not double-count the same answers into the bank.
    expect(sent).toHaveLength(1)
  })

  it('catches a form that submits by navigating away rather than firing submit', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'a')

    // Many real forms post via fetch and redirect, firing no submit event at all.
    window.dispatchEvent(new Event('pagehide'))
    expect(sent).toHaveLength(1)
  })

  it('sends nothing after disarm', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'a')
    feedback.disarm()

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('carries the origin so answers can be attributed to a site', () => {
    const { feedback, sent } = capture()
    feedback.arm([{ fieldId: 'f1', label: 'Q', proposed: 'a' }], () => 'a')

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
