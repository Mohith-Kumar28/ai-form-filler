import type { FeedbackRequest } from '@aff/shared'
import {
  LEARN_MAX_ANSWER_CHARS,
  LEARN_MIN_REPORT_INTERVAL_MS,
  LEARN_SETTLE_DELAY_MS,
  LEARN_SETTLE_MAX_WAIT_MS,
} from '@aff/shared/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFeedbackCapture,
  displayValueOf,
  feedbackEntryFor,
  type PageReader,
} from './feedback.js'

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
  const reportedFields: string[][] = []
  const feedback = createFeedbackCapture('https://jobs.example.com', (payload, fieldIds) => {
    sent.push(payload)
    reportedFields.push(fieldIds)
  })
  return { feedback, sent, reportedFields }
}

/**
 * A page whose fields are all still present — the ordinary case.
 *
 * `fieldIdAt` answers null, i.e. "the event was not in a watched field". Every test that needs
 * the settle path to identify a field passes its own.
 */
function live(read: (fieldId: string) => string | null) {
  return { read, isAlive: () => true, fieldIdAt: () => null }
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
      { label: 'Phone', proposed: '', accepted: '+1 555 0100', edited: true, trigger: 'submit' },
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

  /**
   * This test used to assert the opposite, and the reasoning was half right.
   *
   * A rejection does say an answer was wrong without saying what is right, and storing that as
   * a retrievable passage really would drag the next answer toward the thing it was warning
   * about. What did not follow is that the signal was worthless: dropping it meant the next
   * form confidently offered the same wrong answer again, indefinitely. So it is reported as a
   * rejection and stored where retrieval cannot reach it.
   */
  it('teaches nothing at all for a field the user cleared', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: 'something' }],
      live(() => ''),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    // Not a rejection, not an empty answer, not a request at all.
    expect(sent).toHaveLength(0)
  })

  it('does not call an empty field we never filled a rejection', () => {
    // Nobody rejected anything here. There is no signal in a field that was always blank, and
    // reporting one would teach "avoid nothing" against every question on every skipped field.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: '' }],
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
      fieldIdAt: () => null,
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
      fieldIdAt: () => null,
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
      fieldIdAt: () => null,
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

/**
 * The gap this whole mechanism exists to close.
 *
 * Capture used to arm once and report once, on submit. Everything else was lost: an answer
 * edited and not submitted, a form abandoned on page three, a tab closed on an application
 * somebody decided against. The product forgot exactly the sessions where the user had done
 * the most work.
 */
describe('an answer that settles without the form being submitted', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** A real element, so an event has a target the reader can resolve to a field. */
  function fieldEl(id: string): HTMLInputElement {
    const element = document.createElement('input')
    element.dataset.fid = id
    document.body.appendChild(element)
    return element
  }

  function pageFor(
    read: (fieldId: string) => string | null,
    options: { alive?: boolean } = {},
  ): PageReader {
    return {
      read,
      isAlive: () => options.alive ?? true,
      fieldIdAt: (node) => (node instanceof HTMLElement ? (node.dataset.fid ?? null) : null),
    }
  }

  function settle(element: HTMLElement) {
    element.dispatchEvent(new Event('focusout', { bubbles: true }))
    vi.advanceTimersByTime(LEARN_SETTLE_DELAY_MS + 10)
  }

  it('teaches on blur, with no submit anywhere', () => {
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    feedback.arm(
      [{ fieldId: 'f1', label: 'Phone', proposed: '' }],
      pageFor(() => '+1 555 0100'),
    )

    settle(element)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.entries[0]).toMatchObject({
      label: 'Phone',
      accepted: '+1 555 0100',
      trigger: 'settle',
    })
  })

  it('does not teach text that is still being typed', () => {
    /**
     * The rule the original design was built around, and it still holds: mid-typing text is not
     * an answer. Two guards, and this exercises the second — nothing is ever read on `input`,
     * and a field the caret is still inside goes back in the queue rather than being read.
     */
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: '' }],
      pageFor(() => 'I am halfway'),
    )

    element.focus()
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    vi.advanceTimersByTime(LEARN_SETTLE_DELAY_MS + 10)

    expect(sent).toHaveLength(0)

    // ...and once they leave the field, the finished answer is taught.
    element.blur()
    settle(element)
    expect(sent[0]?.entries[0]?.accepted).toBe('I am halfway')
  })

  it('teaches the same field once, however often it settles', () => {
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    let answer = 'iOS'
    feedback.arm(
      [{ fieldId: 'f1', label: 'Platform', proposed: '' }],
      pageFor(() => answer),
    )

    settle(element)
    vi.advanceTimersByTime(LEARN_MIN_REPORT_INTERVAL_MS)
    settle(element)
    expect(sent).toHaveLength(1)

    // A genuinely different answer is a second lesson, not a duplicate.
    answer = 'Android'
    vi.advanceTimersByTime(LEARN_MIN_REPORT_INTERVAL_MS)
    settle(element)
    expect(sent).toHaveLength(2)
    expect(sent[1]?.entries[0]?.accepted).toBe('Android')
  })

  it('waits out a widget that is still committing, and teaches the value it settles on', () => {
    /**
     * react-select drives its own value over roughly a second and a half, so it reads empty for
     * a moment after being touched. This used to need an explicit "one empty read is a maybe,
     * two is a decision" counter, because an empty read became a rejection. Now that empty
     * teaches nothing either way, the only thing left to prove is that the *late* value still
     * arrives — the field goes back in the queue the moment it changes.
     */
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    let answer: string | null = null
    feedback.arm(
      [{ fieldId: 'f1', label: 'Country', proposed: 'India' }],
      pageFor(() => answer),
    )

    settle(element)
    expect(sent).toHaveLength(0)

    answer = 'Ireland'
    vi.advanceTimersByTime(LEARN_MIN_REPORT_INTERVAL_MS + LEARN_SETTLE_DELAY_MS + 10)

    expect(sent[0]?.entries[0]).toMatchObject({ accepted: 'Ireland' })
    expect(sent[0]?.entries[0]?.rejected).toBeUndefined()
  })

  it('stays silent for a field that is still empty on a second look', () => {
    // Previously a rejection on the second empty read. An empty box is not a verdict, however
    // many times it is looked at.
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    feedback.arm(
      [{ fieldId: 'f1', label: 'Country', proposed: 'India' }],
      pageFor(() => null),
    )

    settle(element)
    vi.advanceTimersByTime(LEARN_MIN_REPORT_INTERVAL_MS + LEARN_SETTLE_DELAY_MS + 10)

    expect(sent).toHaveLength(0)
  })

  /**
   * The checkbox bug, from the capture side.
   *
   * An unchecked box reads null, null read as empty, and empty was dropped — so "No" was
   * unlearnable. It is now readable, which introduces the opposite hazard: a page of consent
   * boxes nobody touched would teach "No" a dozen times over, and a pre-ticked marketing box
   * would teach "Yes". Neither is something the user told us.
   */
  it('learns an unticked checkbox the user actually touched', () => {
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    feedback.arm(
      [{ fieldId: 'f1', label: 'Send me event emails?', kind: 'checkbox', proposed: '' }],
      pageFor(() => null),
    )

    element.dispatchEvent(new Event('click', { bubbles: true }))
    settle(element)

    expect(sent[0]?.entries[0]).toMatchObject({ kind: 'checkbox', accepted: 'no' })
  })

  it('says nothing about a checkbox nobody touched', () => {
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Send me event emails?', kind: 'checkbox', proposed: '' }],
      pageFor(() => null),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))
    expect(sent).toHaveLength(0)
  })

  it('sends one message when the tab is closed mid-answer, not two', () => {
    /**
     * A pending settle and the final sweep both want to report. On a page being torn down the
     * second `sendMessage` is the one that dies, so the timer is cleared and `collect` — which
     * sweeps every proposal anyway — carries everything.
     */
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    feedback.arm(
      [{ fieldId: 'f1', label: 'Q', proposed: '' }],
      pageFor(() => 'typed'),
    )

    element.dispatchEvent(new Event('focusout', { bubbles: true }))
    // No timer advance: the settle is still pending when the tab goes away.
    window.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(LEARN_SETTLE_MAX_WAIT_MS)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.entries[0]).toMatchObject({ accepted: 'typed', trigger: 'submit' })
  })

  it('clamps a long essay instead of losing the batch it travels in', () => {
    // The wire schema caps `accepted`, and zod rejects the whole batch on one over-length
    // entry — so an unclamped essay would silently discard every answer sent with it.
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    feedback.arm(
      [{ fieldId: 'f1', label: 'Cover letter', proposed: '' }],
      pageFor(() => `${'word '.repeat(1200)}end`),
    )

    settle(element)

    const accepted = sent[0]?.entries[0]?.accepted ?? ''
    expect(accepted.length).toBeLessThanOrEqual(LEARN_MAX_ANSWER_CHARS)
    expect(accepted.endsWith(' ')).toBe(false)
  })

  it('does not re-teach the same answers when the page is filled a second time', () => {
    const { feedback, sent } = capture()
    const element = fieldEl('f1')
    const page = pageFor(() => 'iOS')

    feedback.arm([{ fieldId: 'f1', label: 'Platform', proposed: '' }], page)
    settle(element)
    expect(sent).toHaveLength(1)

    feedback.arm([{ fieldId: 'f1', label: 'Platform', proposed: '' }], page)
    vi.advanceTimersByTime(LEARN_MIN_REPORT_INTERVAL_MS)
    settle(element)

    expect(sent).toHaveLength(1)
  })
})

describe('feedbackEntryFor', () => {
  const fill = { label: 'Why us?', value: 'Because of the compiler team.' }

  it('marks an untouched answer the user kept as confirmed, not edited', () => {
    // An inference the model got right is otherwise thrown away, and the next form re-derives
    // it from scratch and may land somewhere else.
    expect(feedbackEntryFor(fill, {}, 'accepted', fill.value)).toMatchObject({
      edited: false,
      confirmed: true,
    })
  })

  it('marks a correction as edited and nothing more', () => {
    const entry = feedbackEntryFor(fill, {}, 'edited', 'Because of the runtime team.')
    expect(entry).toMatchObject({ edited: true, accepted: 'Because of the runtime team.' })
    expect(entry.confirmed).toBeUndefined()
  })

  it('marks a rewrite the user kept as both', () => {
    // We wrote the words; they chose them. Recording only the edit loses the sign-off.
    expect(feedbackEntryFor(fill, {}, 'edited', 'Rewritten.', { rewritten: true })).toMatchObject({
      edited: true,
      confirmed: true,
    })
  })

  it('never turns a clear into an answer', () => {
    const entry = feedbackEntryFor(fill, {}, 'cleared', '')
    expect(entry).toMatchObject({ accepted: '', rejected: true, edited: false })
    expect(entry.proposed).toBe(fill.value)
  })
})

/**
 * Which fields a report was about.
 *
 * The wire schema carries no field id, deliberately — an id is a page-local token that means
 * nothing on the server. But the page needs exactly that to put the acknowledgement under the
 * field the user just corrected, so the ids travel beside the payload rather than in it. Wrong
 * ids would put "kept" under an unrelated question, which is worse than putting it nowhere.
 */
describe('what a report was about', () => {
  it('names the field each entry came from', () => {
    const { feedback, sent, reportedFields } = capture()
    feedback.arm(
      [
        { fieldId: 'f1', label: 'Why us?', proposed: 'Because of the compiler work.' },
        { fieldId: 'f2', label: 'Notice period', proposed: '30 days' },
      ],
      live((fieldId) => (fieldId === 'f2' ? '60 days' : 'Because of the compiler work.')),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent).toHaveLength(1)
    // Only f2 changed, so only f2 is taught — and only f2 may be pointed at.
    expect(sent[0]?.entries.map((entry) => entry.label)).toEqual(['Notice period'])
    expect(reportedFields[0]).toEqual(['f2'])
  })

  it('reports nothing, and names nothing, for a field left empty', () => {
    const { feedback, sent, reportedFields } = capture()
    feedback.arm(
      [{ fieldId: 'f9', label: 'Portfolio', proposed: 'https://example.com' }],
      live(() => ''),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent).toHaveLength(0)
    expect(reportedFields).toHaveLength(0)
  })
})

/**
 * Clearing a field the user has already answered themselves.
 *
 * The sequence behind "it wrote its own generic thing again": extend our paragraph with a
 * sentence you care about, then clear the form to watch it refill. The edit is taught, and the
 * clear then files *our* original text as a rejection — which, because their edit contains that
 * text almost word for word, leaves the next prompt saying both "reuse their answer" and "never
 * offer that again".
 */
describe('a clear that follows a correction', () => {
  it('does not reject an answer the user has already replaced', () => {
    const { feedback, sent } = capture()
    let value = "I'm building AI tools."

    feedback.arm(
      [{ fieldId: 'f1', label: 'What are you exploring?', proposed: "I'm building AI tools." }],
      live(() => value),
    )

    // The correction.
    value = "I'm building AI tools, and aiming for a thousand users."
    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent).toHaveLength(1)
    expect(sent[0]?.entries[0]?.accepted).toContain('thousand users')

    // Now the form is cleared, and armed again for the refill.
    value = ''
    feedback.arm(
      [{ fieldId: 'f1', label: 'What are you exploring?', proposed: "I'm building AI tools." }],
      live(() => value),
    )
    document.dispatchEvent(new Event('submit', { bubbles: true }))

    // Nothing new: the answer is known, and "avoid the text it was built from" is not a thing
    // worth telling the model.
    expect(sent).toHaveLength(1)
  })

  it('does not reject an answer the user cleared without replacing either', () => {
    // This asserted the opposite, and the case it protected — a proposal cleared and never
    // answered — is exactly the one that turned out to be unreadable. Retyping, a validator
    // refusing the format, and tabbing out of a half-finished form all look identical to it.
    const { feedback, sent } = capture()
    feedback.arm(
      [{ fieldId: 'f1', label: 'Portfolio', proposed: 'https://example.com' }],
      live(() => ''),
    )

    document.dispatchEvent(new Event('submit', { bubbles: true }))

    expect(sent).toHaveLength(0)
  })
})

/**
 * The bug behind "it only learns the first edit" and "it only learns one question".
 *
 * Two reports, one line. `collect` ended with `armed = false` — meant as "one final report per
 * fill" — and `collect` runs from `visibilitychange → hidden` as well as from submit. So
 * switching tabs disarmed the capture permanently: the first correction was learned, and after
 * that nothing on the page was, whichever field it happened in.
 *
 * Switching to another tab to check whether something was remembered is the single most likely
 * thing a person does after correcting an answer, which is why this presented as "learning only
 * works once".
 */
describe('learning survives the rest of the session', () => {
  const hide = () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('keeps learning after the user switches tab', () => {
    const { feedback, sent } = capture()
    const values: Record<string, string> = { f1: 'Ours.', f2: 'Ours too.' }

    feedback.arm(
      [
        { fieldId: 'f1', label: 'Why us?', proposed: 'Ours.' },
        { fieldId: 'f2', label: 'Notice period', proposed: 'Ours too.' },
      ],
      live((fieldId) => values[fieldId] ?? null),
    )

    // First correction, then a glance at another tab — which is what used to end learning.
    values.f1 = 'Because of the compiler work.'
    hide()
    expect(sent).toHaveLength(1)

    // A second edit to the *same* field.
    values.f1 = 'Because of the compiler work, and the people.'
    hide()

    // And a first edit to a *different* field.
    values.f2 = '60 days'
    hide()

    expect(sent).toHaveLength(3)
    expect(sent[1]?.entries[0]?.accepted).toContain('and the people')
    expect(sent[2]?.entries[0]?.label).toBe('Notice period')
  })

  it('does not re-report an answer that has not changed', () => {
    // The property the disarm was protecting, which the dedup maps already guarantee: sweeping
    // again with nothing new must send nothing.
    const { feedback, sent } = capture()
    let value = 'Ours.'
    feedback.arm(
      [{ fieldId: 'f1', label: 'Why us?', proposed: 'Ours.' }],
      live(() => value),
    )

    value = 'Mine.'
    hide()
    hide()
    hide()

    expect(sent).toHaveLength(1)
  })
})

/**
 * What the page ceiling is actually for.
 *
 * `LEARN_MAX_PER_PAGE` bounds how many *distinct answers* one form may write, so an unusual page
 * cannot dominate everything retrieved afterwards. Re-editing one field writes no new answer —
 * same question hash, same document, one PATCH — so charging it to that ceiling let a single
 * field somebody was iterating on starve every other field on the form.
 */
describe('re-editing one field does not consume the page budget', () => {
  it('still learns other fields after many edits to one', () => {
    const { feedback, sent } = capture()
    const values: Record<string, string> = {}
    const fields = Array.from({ length: 26 }, (_, index) => `f${index}`)

    for (const fieldId of fields) values[fieldId] = 'Ours.'

    feedback.arm(
      fields.map((fieldId) => ({ fieldId, label: `Question ${fieldId}`, proposed: 'Ours.' })),
      live((fieldId) => values[fieldId] ?? null),
    )

    // Thirty edits to one field. Each replaces the last; none is a new answer.
    for (let round = 0; round < 30; round++) {
      values.f0 = `Draft ${round}`
      document.dispatchEvent(new Event('submit', { bubbles: true }))
    }

    // A different field, edited after all of that, is still learned.
    values.f1 = 'A distinct answer.'
    document.dispatchEvent(new Event('submit', { bubbles: true }))

    const labels = sent.flatMap((payload) => payload.entries.map((entry) => entry.label))
    expect(labels).toContain('Question f1')
    // And the last draft of the iterated field is the one that survived.
    const drafts = sent.flatMap((payload) =>
      payload.entries.filter((entry) => entry.label === 'Question f0').map((e) => e.accepted),
    )
    expect(drafts.at(-1)).toBe('Draft 29')
  })
})
