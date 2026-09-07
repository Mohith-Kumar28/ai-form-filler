import type { FillPlan, FormSchema } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { buildPreview, buildResult, expectedFact, isJudged } from './ledger.js'

const FORM: FormSchema = {
  origin: 'https://boards.greenhouse.io',
  path: '/acme/jobs/1',
  adapter: 'greenhouse',
  fields: [
    { id: 'f1', kind: 'text', label: 'Full name', required: true },
    { id: 'f2', kind: 'email', label: 'Email address', required: true },
    { id: 'f3', kind: 'tel', label: 'Phone', required: false, currentValue: '+44' },
    { id: 'f4', kind: 'text', label: 'Notice period', required: false },
    { id: 'f5', kind: 'longtext', label: 'Why do you want to work here?', required: false },
    { id: 'f6', kind: 'select', label: 'Country', required: false, currentValue: 'GB' },
  ],
}

const FACTS = {
  identity: { fullName: 'Ifeoma Okafor', email: 'ifeoma@fastmail.com', links: {} },
  custom: {},
}

describe('buildPreview', () => {
  it('groups every question by what Fill will do to it', () => {
    const preview = buildPreview(FORM, FACTS)

    expect(preview.total).toBe(6)
    expect(preview.known.map((row) => row.fieldId)).toEqual(['f1', 'f2'])
    expect(preview.known[0]?.value).toBe('Ifeoma Okafor')
    // A dial code alone is not an answer, so the phone field is still open.
    expect(preview.write.map((row) => row.fieldId)).toEqual(['f3', 'f4', 'f5'])
    expect(preview.answered.map((row) => row.fieldId)).toEqual(['f6'])
  })

  it('names the detail a question wants when nothing is saved under it', () => {
    const preview = buildPreview(FORM, FACTS)
    const notice = preview.write.find((row) => row.fieldId === 'f4')
    expect(notice?.expected?.key).toBe('Notice period')
    // An essay asks for nothing the catalogue holds.
    expect(preview.write.find((row) => row.fieldId === 'f5')?.expected).toBeUndefined()
  })

  it('treats no saved details as nothing known', () => {
    const preview = buildPreview(FORM, null)
    expect(preview.known).toEqual([])
    expect(preview.write).toHaveLength(5)
  })
})

describe('expectedFact', () => {
  it('prefers the autocomplete token over the label', () => {
    expect(expectedFact({ label: 'Your address', autocomplete: 'email', kind: 'text' })?.key).toBe(
      'email',
    )
  })

  it('refuses kinds a saved value cannot answer', () => {
    expect(expectedFact({ label: 'Country', kind: 'select' })).toBeNull()
  })
})

const PLAN: FillPlan = {
  fills: [
    {
      fieldId: 'f1',
      label: 'Full name',
      value: 'Ifeoma Okafor',
      confidence: 1,
      tier: 0,
      inferred: false,
      options: [],
    },
    {
      fieldId: 'f5',
      label: 'Why here?',
      value: 'Because…',
      confidence: 0.8,
      tier: 3,
      inferred: true,
      options: [],
    },
    {
      fieldId: 'f4',
      label: 'Notice period',
      value: '1 month',
      confidence: 0.5,
      tier: 2,
      inferred: false,
      options: [],
    },
  ],
  skipped: [{ fieldId: 'f3', reason: 'no_matching_knowledge' }],
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicroUsd: 0,
    latencyMs: 0,
    modelsUsed: [],
  },
  quotaRemaining: 10,
}

describe('buildResult', () => {
  it('separates judgement calls from stated answers, most doubtful inference first', () => {
    const result = buildResult(
      PLAN,
      { applied: ['f1', 'f5', 'f4'], failed: [] },
      { values: {}, verdicts: {} },
      FORM,
    )

    expect(result.written).toBe(3)
    expect(result.check.map((row) => row.fieldId)).toEqual(['f5', 'f4'])
    expect(result.stated.map((row) => row.fieldId)).toEqual(['f1'])
    expect(result.open).toHaveLength(2)
  })

  it('takes a verdict off the open list and shows its value', () => {
    const result = buildResult(
      PLAN,
      { applied: ['f1', 'f5', 'f4'], failed: [] },
      { values: { f4: '2 months' }, verdicts: { f4: 'edited' } },
      FORM,
    )
    expect(result.open.map((row) => row.fieldId)).toEqual(['f5'])
    expect(result.check.find((row) => row.fieldId === 'f4')?.value).toBe('2 months')
  })

  it('counts refusals against what was written and labels blanks from the form', () => {
    const result = buildResult(
      PLAN,
      { applied: ['f1', 'f5'], failed: ['f4'] },
      { values: {}, verdicts: {} },
      FORM,
    )
    expect(result.written).toBe(2)
    expect(result.refused).toBe(1)
    expect(result.blank).toEqual([
      { fieldId: 'f3', label: 'Phone', reason: 'Nothing on file answers this' },
    ])
  })
})

describe('isJudged', () => {
  it('is true for an inference however confident, and for doubt however direct', () => {
    expect(isJudged({ inferred: true, confidence: 0.99 })).toBe(true)
    expect(isJudged({ inferred: false, confidence: 0.5 })).toBe(true)
    expect(isJudged({ inferred: false, confidence: 0.9 })).toBe(false)
  })
})
