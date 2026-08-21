import type { FieldSchema, Identity } from '@aff/shared'
import { matchFact } from '@aff/shared/facts'
import { describe, expect, it } from 'vitest'
import { classifyField, classifyForm, identitySlotFor } from './classify.js'
import { resolveSlot, resolveTier0 } from './tier0.js'

function field(overrides: Partial<FieldSchema> & { label: string }): FieldSchema {
  return { id: 'f1', kind: 'text', required: false, ...overrides }
}

const tierOf = (f: FieldSchema) => classifyField(f).tier

describe('tier 0 — identity detection', () => {
  it('prefers the autocomplete token over label text', () => {
    // The author declared it; that beats guessing from a placeholder.
    expect(identitySlotFor(field({ label: 'Contact', autocomplete: 'email' }))).toBe('email')
  })

  it('handles a sectioned autocomplete token', () => {
    expect(identitySlotFor(field({ label: 'x', autocomplete: 'shipping email' }))).toBe('email')
  })

  it.each([
    ['First name', 'firstName'],
    ['Given name', 'firstName'],
    ['Last name', 'lastName'],
    ['Surname', 'lastName'],
    ['Full name', 'fullName'],
    ['Email address', 'email'],
    ['Mobile number', 'phone'],
    ['LinkedIn profile', 'linkedin'],
    ['GitHub username', 'github'],
    ['Personal website', 'website'],
    ['Pronouns', 'pronouns'],
    ['Do you require visa sponsorship?', 'workAuthorization'],
    ['City', 'location'],
  ])('recognises %s as %s', (label, slot) => {
    expect(identitySlotFor(field({ label }))).toBe(slot)
  })

  it('matches the specific name pattern before the catch-all', () => {
    // /name/ would otherwise swallow "First name" and answer it with the full name.
    expect(identitySlotFor(field({ label: 'First name' }))).toBe('firstName')
    expect(identitySlotFor(field({ label: 'Name' }))).toBe('fullName')
  })

  it.each([
    'Company name',
    'Current employer',
    'Reference name',
    'Emergency contact name',
    'University name',
    'Manager email',
  ])('refuses to auto-fill %s — it is not about the applicant', (label) => {
    expect(identitySlotFor(field({ label }))).toBeUndefined()
  })

  it('uses the input type as a weak fallback when the label is useless', () => {
    expect(identitySlotFor(field({ label: '', kind: 'email' }))).toBe('email')
    expect(identitySlotFor(field({ label: '???', kind: 'tel' }))).toBe('phone')
  })

  it('does not treat a section heading as the field itself', () => {
    // A text field inside "Contact details" is not necessarily the email field.
    expect(
      identitySlotFor(field({ label: 'Line 2', section: 'Contact details — email' })),
    ).toBeUndefined()
  })
})

describe('tier assignment', () => {
  it('routes an identity field to tier 0', () => {
    expect(tierOf(field({ label: 'Email address' }))).toBe(0)
  })

  it('routes choice fields to tier 1 even when the answer is known', () => {
    // We may know the country, but picking the matching option is still a matching problem.
    expect(tierOf(field({ label: 'Country', kind: 'select', options: [] }))).toBe(1)
    expect(tierOf(field({ label: 'Sponsorship?', kind: 'radio', options: [] }))).toBe(1)
    expect(tierOf(field({ label: 'Agree to terms', kind: 'checkbox' }))).toBe(1)
  })

  it('routes a textarea to tier 3', () => {
    expect(tierOf(field({ label: 'Anything else?', kind: 'longtext' }))).toBe(3)
  })

  it.each([
    'Why do you want to work here?',
    'Describe a challenging project',
    'Tell us about yourself',
    'What makes you a good fit?',
    'Cover letter',
  ])('routes essay prompt "%s" to tier 3', (label) => {
    expect(tierOf(field({ label }))).toBe(3)
  })

  it('keeps a short-capped essay-sounding field at tier 2', () => {
    // maxLength=100 means it cannot be prose no matter how the question is phrased.
    expect(tierOf(field({ label: 'Why this role?', maxLength: 100 }))).toBe(2)
  })

  it('routes ordinary short text to tier 2', () => {
    expect(tierOf(field({ label: 'Years of experience' }))).toBe(2)
  })
})

describe('classifyForm', () => {
  const fields = [
    field({ id: 'a', label: 'Email address' }),
    field({ id: 'b', label: 'Country', kind: 'select', options: [] }),
    field({ id: 'c', label: 'Years of experience' }),
    field({ id: 'd', label: 'Why us?', kind: 'longtext' }),
  ]

  it('assigns one tier per field and counts them', () => {
    const { classifications, counts } = classifyForm(fields)
    expect(classifications.map((c) => c.tier)).toEqual([0, 1, 2, 3])
    expect(counts).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1 })
  })

  it('never escalates a field past the tier its kind earns', () => {
    /**
     * There was a "take more care with written answers" toggle that pushed every generative
     * field to tier 3. Tier 3 is Gemini 2.5 Pro at four times Flash's price, so one checkbox
     * quadrupled the cost of a form on our own key — and a short text answer is not better for
     * it. Essays reach tier 3 on their own, which is the only case that ever wanted it.
     */
    const { counts } = classifyForm(fields)
    expect(counts[3]).toBe(1)
    expect(counts[2]).toBe(1)
  })
})

describe('resolveTier0', () => {
  const identity: Identity = {
    fullName: 'Mohith Kumar',
    email: 'mohith@example.com',
    phone: '+91 98765 43210',
    links: { github: 'https://github.com/mohithk' },
  }

  it('fills from stored identity at full confidence, never marked inferred', () => {
    const { fills } = resolveTier0(
      identity,
      [{ fieldId: 'f1', tier: 0, slot: 'email' }],
      new Map([['f1', field({ label: 'Email address', kind: 'email' })]]),
    )
    // A direct lookup of the user's own stored value is the one case that is definitionally
    // not a judgement call, so it must never surface for review.
    expect(fills).toEqual([
      {
        fieldId: 'f1',
        // The question travels with the answer so the panel can review it without the form.
        label: 'Email address',
        value: 'mohith@example.com',
        confidence: 1,
        tier: 0,
        inferred: false,
        // Identity fields are typed inputs, so there are no options to have chosen among.
        options: [],
      },
    ])
  })

  it('splits a full name into first and last', () => {
    expect(resolveSlot(identity, 'firstName')).toBe('Mohith')
    expect(resolveSlot(identity, 'lastName')).toBe('Kumar')
  })

  it('treats a single-token name as having no surname', () => {
    expect(resolveSlot({ fullName: 'Prince', links: {} }, 'lastName')).toBeUndefined()
    expect(resolveSlot({ fullName: 'Prince', links: {} }, 'firstName')).toBe('Prince')
  })

  it('keeps every token after the first as the surname', () => {
    expect(resolveSlot({ fullName: 'Ada King Lovelace', links: {} }, 'lastName')).toBe(
      'King Lovelace',
    )
  })

  it('falls back to the full name when no preferred name is set', () => {
    expect(resolveSlot(identity, 'preferredName')).toBe('Mohith Kumar')
  })

  it('skips rather than inventing when the profile has no value', () => {
    const { fills, skipped } = resolveTier0(identity, [
      { fieldId: 'f2', tier: 0, slot: 'pronouns' },
    ])
    expect(fills).toHaveLength(0)
    expect(skipped[0]?.reason).toBe('no_matching_knowledge')
  })

  it('passes non-tier-0 classifications through untouched', () => {
    const { unresolved } = resolveTier0(identity, [
      { fieldId: 'f3', tier: 2 },
      { fieldId: 'f4', tier: 3 },
    ])
    expect(unresolved.map((c) => c.fieldId)).toEqual(['f3', 'f4'])
  })

  it('reads links out of the identity link map', () => {
    const { fills } = resolveTier0(identity, [{ fieldId: 'f5', tier: 0, slot: 'github' }])
    expect(fills[0]?.value).toBe('https://github.com/mohithk')
  })
})

/**
 * The asymmetry that let the panel fill a field the fill button could not.
 *
 * The extension's inline suggester reads the whole fact catalogue — `custom` included — so
 * focusing "Address Line" offered the stored value instantly. `resolveTier0` read only the
 * twelve `identity` slots, classified the same field as tier 0 with slot `location`, found
 * `identity.location` empty, and dropped it as unanswerable. Same profile, same field, two
 * different answers depending on which code path you happened to be in.
 */
describe('tier 0 — facts the user typed', () => {
  const empty: Identity = { links: {} }
  const f = (id: string, label: string, kind: FieldSchema['kind'] = 'text'): FieldSchema => ({
    id,
    kind,
    label,
    required: false,
  })

  it('answers a field whose label is the name the user gave the fact', () => {
    const { fills } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 0, slot: 'location' }],
      new Map([['f1', f('f1', 'Address Line')]]),
      { 'Address line': 'Brigade Omega C1008' },
    )
    expect(fills[0]?.value).toBe('Brigade Omega C1008')
    expect(fills[0]?.tier).toBe(0)
    expect(fills[0]?.confidence).toBe(1)
  })

  it('matches regardless of case and punctuation in either name', () => {
    const { fills } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 2 }],
      new Map([['f1', f('f1', 'PAN number')]]),
      { pan_number: 'ABCDE1234F' },
    )
    expect(fills[0]?.value).toBe('ABCDE1234F')
  })

  it('answers a city field from the location fact', () => {
    const { fills } = resolveTier0(
      { links: {}, location: 'Bengaluru' },
      [{ fieldId: 'f1', tier: 0, slot: 'location' }],
      new Map([['f1', f('f1', 'Town or city')]]),
      {},
    )
    expect(fills[0]?.value).toBe('Bengaluru')
  })

  /**
   * The regression this whole shared-matcher move exists for.
   *
   * "Address Line" was answered with the user's *country*. `identity.location` was empty, so an
   * alias table for the `location` slot walked city → location → address → addressline →
   * address1 → town → state → country and took the first key that happened to be present. The
   * catalogue has ranked rules precisely so that this cannot happen: the address rule is rank
   * 40 and matches the keyword "address", and the country rule is rank 45 and never runs.
   */
  it('answers an address field with the address, not with whatever else is stored', () => {
    const { fills } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 0, slot: 'location' }],
      new Map([['f1', f('f1', 'Address Line')]]),
      {
        'Address line 1': 'Brigade Omega C1008',
        City: 'Bengaluru',
        Country: 'India',
        'Postal code': '560062',
      },
    )
    expect(fills[0]?.value).toBe('Brigade Omega C1008')
  })

  it('gives the panel and the fill button the same answer for the same field', () => {
    // The two paths now call one function, so this is a tautology by construction — which is
    // the point, and worth a test that fails loudly if they are ever forked again.
    const facts = { 'Address line 1': 'Brigade Omega C1008', Country: 'India' }
    const field = f('f1', 'Address Line')

    const { fills } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 0, slot: 'location' }],
      new Map([['f1', field]]),
      facts,
    )
    const inline = matchFact(
      { label: field.label, kind: field.kind },
      { identity: empty, custom: facts },
    )

    expect(fills[0]?.value).toBe(inline?.value)
  })

  it('promotes a tier-2 field, which would otherwise have cost a model call', () => {
    const { fills, unresolved } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 2 }],
      new Map([['f1', f('f1', 'Notice period')]]),
      { 'Notice period': '30 days' },
    )
    expect(fills[0]?.value).toBe('30 days')
    expect(unresolved).toEqual([])
  })

  it('leaves choice fields to the matching tiers, stored fact or not', () => {
    // The answer has to be one of the given options; a raw string is not a selection.
    const { fills, unresolved } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 1 }],
      new Map([['f1', f('f1', 'Country', 'select')]]),
      { Country: 'India' },
    )
    expect(fills).toEqual([])
    expect(unresolved).toHaveLength(1)
  })

  it('leaves essays alone — a one-line fact is not three paragraphs', () => {
    const { fills, unresolved } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 3 }],
      new Map([['f1', f('f1', 'Why us?', 'longtext')]]),
      { 'Why us?': 'Because.' },
    )
    expect(fills).toEqual([])
    expect(unresolved).toHaveLength(1)
  })

  it('never answers a field that is about somebody else', () => {
    const { fills } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 2 }],
      new Map([['f1', f('f1', 'Emergency contact phone')]]),
      { Phone: '+91 98765 43210' },
    )
    expect(fills).toEqual([])
  })

  it('prefers the identity slot when both hold a value', () => {
    // `identity` is the typed, validated half; `custom` is free-form. On a genuine collision
    // the structured one wins, and the label match is what gets there first only when it is
    // an exact name match the user chose.
    const { fills } = resolveTier0(
      { links: {}, email: 'me@identity.test' },
      [{ fieldId: 'f1', tier: 0, slot: 'email' }],
      new Map([['f1', f('f1', 'Work email', 'email')]]),
      { 'Personal email': 'me@custom.test' },
    )
    expect(fills[0]?.value).toBe('me@identity.test')
  })

  it('ignores a stored fact that is only whitespace', () => {
    const { skipped } = resolveTier0(
      empty,
      [{ fieldId: 'f1', tier: 0, slot: 'location' }],
      new Map([['f1', f('f1', 'City')]]),
      { City: '   ' },
    )
    expect(skipped[0]?.reason).toBe('no_matching_knowledge')
  })
})
