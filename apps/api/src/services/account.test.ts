import { describe, expect, it } from 'vitest'
import { currentPeriod, periodResetsAt } from './account.js'

describe('currentPeriod', () => {
  it('zero-pads single-digit months so keys sort lexicographically', () => {
    expect(currentPeriod(new Date('2026-08-13T00:00:00Z'))).toBe('2026-08')
    // Without padding, '2026-9' would sort after '2026-10'.
    expect(currentPeriod(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09')
  })

  it('uses UTC, so a late-evening local time does not roll the period early', () => {
    // 2026-08-31T23:30Z is still August everywhere UTC-based, but would be September
    // in UTC+1 if this used local getMonth().
    expect(currentPeriod(new Date('2026-08-31T23:30:00Z'))).toBe('2026-08')
  })
})

describe('periodResetsAt', () => {
  it('returns midnight UTC on the first of next month', () => {
    expect(periodResetsAt(new Date('2026-08-13T12:00:00Z'))).toBe('2026-09-01T00:00:00.000Z')
  })

  it('rolls the year over from December', () => {
    // Date.UTC(2026, 12, 1) normalises to 2027-01-01 rather than throwing or clamping.
    expect(periodResetsAt(new Date('2026-12-25T12:00:00Z'))).toBe('2027-01-01T00:00:00.000Z')
  })

  it('handles the final instant of a month without skipping ahead', () => {
    expect(periodResetsAt(new Date('2026-01-31T23:59:59Z'))).toBe('2026-02-01T00:00:00.000Z')
  })

  it('lands on March 1 from a leap-year February', () => {
    expect(periodResetsAt(new Date('2028-02-29T00:00:00Z'))).toBe('2028-03-01T00:00:00.000Z')
  })
})
