import type { FieldSchema, Identity } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { classifyField, identitySlotFor } from '../router/classify.js'
import { resolveTier0 } from '../router/tier0.js'
import { foldLearned, isDurableFact } from './answer-bank.js'

/**
 * The loop that was broken: a phone number typed on one form was still missing on the next.
 *
 * Learning wrote every correction to memory, but phone, email, and name are answered by
 * **tier 0** — a direct lookup in the structured profile with no model call and no retrieval.
 * Tier 0 never searches memory, so a value learned there was unreachable by the one path
 * that answers those fields. These tests pin the routing rather than the storage call.
 */

function field(label: string, kind: FieldSchema['kind'] = 'text'): FieldSchema {
  return { id: 'f1', label, kind, required: false }
}

describe('a learned identity value reaches the path that answers it', () => {
  it('recognises the fields that tier 0 owns', () => {
    // If these stop mapping to a slot, the value goes to memory instead and the field stays
    // blank forever — silently, because memory ingestion always reports success.
    expect(identitySlotFor(field('Phone number'))).toBe('phone')
    expect(identitySlotFor(field('Mobile'))).toBe('phone')
    expect(identitySlotFor(field('Email address'))).toBe('email')
  })

  it('answers the next form from the profile, with no model call', () => {
    const identity: Identity = { links: {}, phone: '+1 555 0100' }
    const classifications = [classifyField(field('Phone number', 'tel'))]
    const labels = new Map([['f1', 'Phone number']])

    const { fills, unresolved } = resolveTier0(identity, classifications, labels)

    expect(fills[0]?.value).toBe('+1 555 0100')
    expect(fills[0]?.tier).toBe(0)
    // Nothing left for a paid tier: this is the whole point of storing it here.
    expect(unresolved).toHaveLength(0)
  })

  it('leaves the field unresolved when the profile has no phone', () => {
    const identity: Identity = { links: {} }
    const classifications = [classifyField(field('Phone number', 'tel'))]

    const { fills, skipped } = resolveTier0(identity, classifications, new Map())

    expect(fills).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})

/**
 * The second half of the same bug, and the larger half.
 *
 * Identity routing was fixed; everything else still went to memory as prose. A dropdown answer
 * — "iOS", "Social Media", "9" — is a chunk far too small to be retrieved against a whole
 * form's worth of labels, so it was stored, reported as learned, and never read again. The user
 * picked iOS on every single form.
 *
 * `isDurableFact` is the routing decision that fixes it, so these tests pin the decision rather
 * than the storage call.
 */
describe('a learned answer reaches the store that answers it', () => {
  it('sends every constrained choice to the profile, however short', () => {
    // Length is not the signal for a choice field: "9" and "iOS" are complete answers.
    expect(isDurableFact({ kind: 'radio', accepted: 'iOS' })).toBe(true)
    expect(isDurableFact({ kind: 'select', accepted: 'Social Media' })).toBe(true)
    expect(isDurableFact({ kind: 'multiselect', accepted: 'Notion, Linear' })).toBe(true)
    expect(isDurableFact({ kind: 'checkbox', accepted: 'yes' })).toBe(true)
  })

  it('sends a short typed answer to the profile too', () => {
    // Same class of fact, and it was equally lost: too short to retrieve, not an identity slot.
    expect(isDurableFact({ kind: 'number', accepted: '9' })).toBe(true)
    expect(isDurableFact({ kind: 'text', accepted: '3 weeks' })).toBe(true)
    // The review panel reports answers with no widget in hand.
    expect(isDurableFact({ accepted: 'Bengaluru' })).toBe(true)
  })

  it('keeps a long multi-select, which a prose length limit was throwing away', () => {
    /**
     * The case that made a real answer vanish. Three of this form's feature options is 162
     * characters — over the prose threshold, and not remotely prose. Judged by that limit it
     * went to semantic memory, where a list of checkbox labels is the one thing retrieval
     * cannot use, so the answer was learned and then unreachable.
     */
    const long = [
      "AI-powered search (e.g., 'What was that red shoe I saved?')",
      'Smart reminders autoset based on your memories',
      'Automatic smart grouping/collections of similar items',
    ].join(', ')

    expect(long.length).toBeGreaterThan(160)
    expect(isDurableFact({ kind: 'multiselect', accepted: long })).toBe(true)
    // Still bounded — the profile rides in every prompt.
    expect(isDurableFact({ kind: 'multiselect', accepted: 'x'.repeat(500) })).toBe(false)
  })

  it('leaves prose to memory, where voice and semantics are the point', () => {
    expect(isDurableFact({ kind: 'longtext', accepted: 'Short.' })).toBe(false)
    expect(isDurableFact({ kind: 'text', accepted: 'x'.repeat(400) })).toBe(false)
    // A newline is a paragraph, whatever the widget claimed to be.
    expect(isDurableFact({ kind: 'text', accepted: 'line one\nline two' })).toBe(false)
  })
})

describe('folding an answer into what is already remembered', () => {
  it('replaces the old answer to the same question', () => {
    // The opposite of the identity rule, deliberately: a preference the user has now answered
    // twice is a preference that changed, and a stale "Android" would be unfixable.
    const folded = foldLearned(
      [{ question: 'Which device do you use?', answer: 'Android' }],
      [{ question: 'which device do you use?', answer: 'iOS' }],
    )

    expect(folded).toHaveLength(1)
    expect(folded[0]?.answer).toBe('iOS')
  })

  it('keeps unrelated answers', () => {
    const folded = foldLearned(
      [{ question: 'Device', answer: 'iOS' }],
      [{ question: 'City', answer: 'Bengaluru' }],
    )

    expect(folded.map((row) => row.question)).toEqual(['Device', 'City'])
  })

  it('drops the oldest once the prompt budget is full', () => {
    const existing = Array.from({ length: 80 }, (_, i) => ({
      question: `Q${i}`,
      answer: 'a',
    }))

    const folded = foldLearned(existing, [{ question: 'newest', answer: 'a' }])

    expect(folded).toHaveLength(80)
    expect(folded.some((row) => row.question === 'Q0')).toBe(false)
    expect(folded.at(-1)?.question).toBe('newest')
  })

  it('moves a re-answered question to the end, so confirming it keeps it alive', () => {
    const folded = foldLearned(
      [
        { question: 'first', answer: 'a' },
        { question: 'second', answer: 'b' },
      ],
      [{ question: 'first', answer: 'c' }],
    )

    expect(folded.map((row) => row.question)).toEqual(['second', 'first'])
  })
})
