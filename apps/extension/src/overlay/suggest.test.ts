import { describe, expect, it } from 'vitest'
import type { KnownFacts } from './suggest.js'
import { suggestForField } from './suggest.js'

const FACTS: KnownFacts = {
  identity: {
    fullName: 'Ifeoma Balogun',
    preferredName: 'Ife',
    email: 'ifeoma@example.com',
    phone: '+44 7911 248 630',
    location: 'Bristol, United Kingdom',
    pronouns: 'she/her',
    workAuthorization: 'British citizen — no sponsorship needed',
    links: {
      linkedin: 'https://linkedin.com/in/ifeomabalogun',
      github: 'https://github.com/ifeomab',
      website: 'https://ifeomabalogun.com',
    },
  },
  custom: {
    'Notice period': '6 weeks from signing',
    'Earliest start': '3 November 2026',
  },
}

describe('suggestForField', () => {
  it('returns null for unsupported field kinds', () => {
    expect(suggestForField({ label: 'Gender', kind: 'radio' }, FACTS)).toBeNull()
    expect(suggestForField({ label: 'Skills', kind: 'select' }, FACTS)).toBeNull()
    expect(suggestForField({ label: 'Resume', kind: 'file' }, FACTS)).toBeNull()
  })

  it('matches by autocomplete token', () => {
    expect(
      suggestForField({ label: 'Your email', autocomplete: 'email', kind: 'email' }, FACTS),
    ).toEqual({ label: 'Email', value: 'ifeoma@example.com' })

    expect(
      suggestForField({ label: 'Phone number', autocomplete: 'tel', kind: 'tel' }, FACTS),
    ).toEqual({ label: 'Phone', value: '+44 7911 248 630' })
  })

  it('matches by label keyword when no autocomplete token', () => {
    expect(suggestForField({ label: 'Email address', kind: 'text' }, FACTS)).toEqual({
      label: 'Email',
      value: 'ifeoma@example.com',
    })

    expect(suggestForField({ label: 'Mobile number', kind: 'tel' }, FACTS)).toEqual({
      label: 'Phone',
      value: '+44 7911 248 630',
    })
  })

  it('matches full name', () => {
    expect(suggestForField({ label: 'Full name', kind: 'text' }, FACTS)).toEqual({
      label: 'Full name',
      value: 'Ifeoma Balogun',
    })
  })

  it('matches location', () => {
    expect(suggestForField({ label: 'Where are you based?', kind: 'text' }, FACTS)).toEqual({
      label: 'Location',
      value: 'Bristol, United Kingdom',
    })
  })

  it('matches work authorization', () => {
    expect(
      suggestForField({ label: 'Do you require visa sponsorship?', kind: 'text' }, FACTS),
    ).toEqual({
      label: 'Work authorization',
      value: 'British citizen — no sponsorship needed',
    })
  })

  it('matches LinkedIn', () => {
    expect(suggestForField({ label: 'LinkedIn profile', kind: 'url' }, FACTS)).toEqual({
      label: 'LinkedIn',
      value: 'https://linkedin.com/in/ifeomabalogun',
    })
  })

  it('matches custom facts', () => {
    expect(suggestForField({ label: 'What is your notice period?', kind: 'text' }, FACTS)).toEqual({
      label: 'Notice period',
      value: '6 weeks from signing',
    })

    expect(suggestForField({ label: 'Earliest start date', kind: 'text' }, FACTS)).toEqual({
      label: 'Earliest start',
      value: '3 November 2026',
    })
  })

  it('returns null when the value is empty', () => {
    const emptyPhone: KnownFacts = { ...FACTS, identity: { ...FACTS.identity, phone: undefined } }
    expect(suggestForField({ label: 'Phone', kind: 'tel' }, emptyPhone)).toBeNull()
  })

  it('returns null when no facts are known', () => {
    const empty: KnownFacts = {
      identity: { links: {} },
      custom: {},
    }
    expect(suggestForField({ label: 'Email', kind: 'email' }, empty)).toBeNull()
  })

  it('returns null for a field label that does not match anything', () => {
    expect(
      suggestForField({ label: 'What is your favourite colour?', kind: 'text' }, FACTS),
    ).toBeNull()
  })

  it('returns null when autocomplete is off, even if the label matches', () => {
    expect(
      suggestForField({ label: 'Email address', autocomplete: 'off', kind: 'email' }, FACTS),
    ).toBeNull()
  })

  it('returns null when autocomplete is one-time-code', () => {
    expect(
      suggestForField(
        { label: 'Verification code', autocomplete: 'one-time-code', kind: 'text' },
        FACTS,
      ),
    ).toBeNull()
  })
})
