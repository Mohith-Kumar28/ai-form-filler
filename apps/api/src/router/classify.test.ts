import type { FieldSchema, Identity } from '@aff/shared'
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

describe('quality escalation', () => {
  const fields = [
    field({ id: 'a', label: 'Email address' }),
    field({ id: 'b', label: 'Country', kind: 'select', options: [] }),
    field({ id: 'c', label: 'Years of experience' }),
    field({ id: 'd', label: 'Why us?', kind: 'longtext' }),
  ]

  it('auto mode assigns one tier per field and counts them', () => {
    const { classifications, counts } = classifyForm(fields, 'auto')
    expect(classifications.map((c) => c.tier)).toEqual([0, 1, 2, 3])
    expect(counts).toEqual({ 0: 1, 1: 1, 2: 1, 3: 1 })
  })

  it('high mode escalates generative fields but never tier 0 or 1', () => {
    const { classifications, counts } = classifyForm(fields, 'high')
    // Tier 0 stays free; tier 1 stays constrained; only tier 2 climbs to 3.
    expect(classifications.map((c) => c.tier)).toEqual([0, 1, 3, 3])
    expect(counts[0]).toBe(1)
    expect(counts[1]).toBe(1)
    expect(counts[3]).toBe(2)
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
      new Map([['f1', 'Email address']]),
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
