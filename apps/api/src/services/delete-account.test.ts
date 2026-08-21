import { describe, expect, it } from 'vitest'
import { billingStatusFor, confirmationMatches, documentIdsFor } from './delete-account.js'

/**
 * The confirmation is the server's only evidence that the user meant it. Both halves of that
 * matter: it has to accept the address the account actually has, typed by a human into a text
 * field, and it has to reject everything else — including the near-misses that a "close enough"
 * comparison would let through.
 */
describe('confirmationMatches', () => {
  it('accepts the exact address', () => {
    expect(confirmationMatches('ife@example.com', 'ife@example.com')).toBe(true)
  })

  it('forgives case, because email addresses are not case-sensitive to their owners', () => {
    expect(confirmationMatches('Ife@Example.COM', 'ife@example.com')).toBe(true)
  })

  it('forgives surrounding whitespace, which is what pasting an address gives you', () => {
    expect(confirmationMatches('  ife@example.com\n', 'ife@example.com')).toBe(true)
  })

  it('rejects a different address', () => {
    expect(confirmationMatches('someone@example.com', 'ife@example.com')).toBe(false)
  })

  it('rejects a prefix, so a half-typed address cannot delete an account', () => {
    expect(confirmationMatches('ife@example', 'ife@example.com')).toBe(false)
  })

  it('rejects internal whitespace — only the edges are trimmed', () => {
    expect(confirmationMatches('ife @example.com', 'ife@example.com')).toBe(false)
  })

  it('rejects empty input against a real address', () => {
    expect(confirmationMatches('', 'ife@example.com')).toBe(false)
    expect(confirmationMatches('   ', 'ife@example.com')).toBe(false)
  })
})

/**
 * A document id missed here is a document that survives the deletion with nothing left pointing
 * at it — so the interesting cases are all about what gets dropped on the floor.
 */
describe('documentIdsFor', () => {
  it('collects ids from both tables', () => {
    const ids = documentIdsFor([{ memoryId: 'doc_a' }], [{ memoryId: 'doc_b' }])
    expect(new Set(ids)).toEqual(new Set(['doc_a', 'doc_b']))
  })

  it('skips rows with no document, which is the ordinary failed-ingest case', () => {
    expect(documentIdsFor([{ memoryId: null }, { memoryId: 'doc_a' }])).toEqual(['doc_a'])
  })

  it('deduplicates, so one document is not counted twice in the report', () => {
    expect(documentIdsFor([{ memoryId: 'doc_a' }], [{ memoryId: 'doc_a' }])).toEqual(['doc_a'])
  })

  it('returns nothing for an account that never stored anything', () => {
    expect(documentIdsFor([], [])).toEqual([])
  })

  it('treats the second argument as optional', () => {
    expect(documentIdsFor([{ memoryId: 'doc_a' }])).toEqual(['doc_a'])
  })
})

/**
 * This function exists because of a bug that was not a crash.
 *
 * Deletion used to refuse to run when Dodo would not confirm a cancellation, and told the user to
 * go and cancel it themselves in the billing portal first — our integration problem, presented as
 * their homework, to somebody who had just asked to be forgotten. These cases pin down the two
 * decisions that replaced it: a departing user is never shown billing mechanics, and no billing
 * outcome maps to anything they have to act on.
 */
describe('billingStatusFor', () => {
  it('says nothing about billing for an account that never subscribed', () => {
    expect(billingStatusFor('none')).toBe('none')
  })

  it('reports an already-ended subscription the same as one cancelled just now', () => {
    // The user asked to leave, not for an audit of our billing bookkeeping. Both mean the same
    // thing to them: no further charge.
    expect(billingStatusFor('already')).toBe('cancelled')
    expect(billingStatusFor('cancelled')).toBe('cancelled')
  })

  it('turns a failed cancellation into a promise, never an error', () => {
    // `pending` — the deletion still happened, and finishing the cancellation is our job. The one
    // thing this must never produce is a state the panel renders as "go and do this yourself".
    expect(billingStatusFor('failed')).toBe('pending')
  })

  it('never returns a state that asks the user to do anything', () => {
    const actionable: string[] = ['none', 'cancelled', 'pending']
    for (const outcome of ['none', 'already', 'cancelled', 'failed'] as const) {
      expect(actionable).toContain(billingStatusFor(outcome))
    }
  })
})
