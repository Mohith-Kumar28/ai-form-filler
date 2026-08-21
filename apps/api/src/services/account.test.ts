import { describe, expect, it } from 'vitest'
import { currentPeriod, effectivePlan, GRANT_PERIOD, periodFor, periodResetsAt } from './account.js'

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

describe('periodFor', () => {
  /*
    The one function that decides whether an allowance refills.

    Free is the one-time grant, so its usage is keyed to a constant and there is no month in it —
    that single fact is what makes the grant a lifetime counter inside a table designed for months.
    Paid plans get the calendar period they always had.
  */
  it('meters a free account against a fixed key, so its grant never rolls over', () => {
    expect(periodFor('free')).toBe(GRANT_PERIOD)
    // Same answer in a different month: that is the whole property.
    expect(periodFor('free')).toBe(periodFor('free'))
  })

  it('meters a paid account against the calendar month', () => {
    expect(periodFor('pro')).toBe(currentPeriod())
    expect(periodFor('ultra')).toBe(currentPeriod())
  })

  it('cannot collide with a real period key', () => {
    // `currentPeriod` only ever emits digits and a hyphen, so a non-numeric key is unreachable
    // by any date. If the grant key were ever changed to something like '0000-00', a user's
    // lifetime grant and some month's usage would share a row and silently pool.
    expect(GRANT_PERIOD).not.toMatch(/^[0-9-]+$/)
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

describe('effectivePlan', () => {
  /** Seconds, because that is the unit every timestamp on the subscriptions table is stored in. */
  const NOW = Date.UTC(2026, 7, 21, 12, 0, 0)
  const seconds = (ms: number) => Math.floor(ms / 1000)
  const DAY = 86_400

  const sub = (over: Partial<Parameters<typeof effectivePlan>[1] & object>) =>
    ({
      plan: 'pro',
      status: 'active',
      onHoldAt: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
      ...over,
    }) as NonNullable<Parameters<typeof effectivePlan>[1]>

  it('gives nothing to an account with no subscription row', () => {
    // The onboarding state: signed in, sources added, has never paid. Filling is the paywall.
    expect(effectivePlan('free', undefined, NOW)).toBe('free')
  })

  it('ignores a cached plan that no subscription supports', () => {
    // `users.plan` is written by whichever webhook arrived last, so on its own it is a claim about
    // the past. A row saying 'pro' with nothing behind it must not buy anything.
    expect(effectivePlan('pro', undefined, NOW)).toBe('free')
  })

  it('honours a live trial', () => {
    const s = sub({ status: 'trial', trialEndsAt: seconds(NOW) + 3 * DAY })
    expect(effectivePlan('pro', s, NOW)).toBe('pro')
  })

  it('keeps a just-ended trial alive through the webhook grace window', () => {
    // Dodo charges on the last day and sends `subscription.renewed`. Dropping access the instant
    // the clock passes would punish the user for our webhook being a minute late.
    const s = sub({ status: 'trial', trialEndsAt: seconds(NOW) - DAY })
    expect(effectivePlan('pro', s, NOW)).toBe('pro')
  })

  it('drops a trial that lapsed with no renewal', () => {
    // Past the grace window with the row still saying `trial`, the charge never succeeded.
    const s = sub({ status: 'trial', trialEndsAt: seconds(NOW) - 5 * DAY })
    expect(effectivePlan('pro', s, NOW)).toBe('free')
  })

  it('treats a trial with no recorded end date as live', () => {
    // We failed to record the date, which is our bug. Charging the user for it is not the fix.
    const s = sub({ status: 'trial', trialEndsAt: null })
    expect(effectivePlan('pro', s, NOW)).toBe('pro')
  })

  it('keeps an on-hold subscription working for three days', () => {
    const s = sub({ status: 'on_hold', onHoldAt: seconds(NOW) - 2 * DAY })
    expect(effectivePlan('pro', s, NOW)).toBe('pro')

    const stale = sub({ status: 'on_hold', onHoldAt: seconds(NOW) - 4 * DAY })
    expect(effectivePlan('pro', stale, NOW)).toBe('free')
  })

  it('lets a cancelled subscription run out the period it paid for', () => {
    const s = sub({ status: 'cancelled', currentPeriodEnd: seconds(NOW) + 10 * DAY })
    expect(effectivePlan('pro', s, NOW)).toBe('pro')

    const over = sub({ status: 'cancelled', currentPeriodEnd: seconds(NOW) - DAY })
    expect(effectivePlan('pro', over, NOW)).toBe('free')
  })

  it('gives nothing for pending, failed or expired', () => {
    // `pending` and `failed` were absent from the enum, which made an incomplete mandate
    // indistinguishable from a working subscription.
    for (const status of ['pending', 'failed', 'expired'] as const) {
      expect(effectivePlan('pro', sub({ status }), NOW)).toBe('free')
    }
  })

  it('does not confuse seconds with milliseconds', () => {
    // The function this replaced compared a seconds column against a millisecond `Date.now()`.
    // A trial ending in an hour, expressed in seconds, must not read as decades in the past.
    const s = sub({ status: 'trial', trialEndsAt: seconds(NOW) + 3600 })
    expect(effectivePlan('pro', s, NOW)).toBe('pro')
  })

  it('carries the subscription plan, not the cached one', () => {
    const s = sub({ plan: 'ultra', status: 'active' })
    expect(effectivePlan('pro', s, NOW)).toBe('ultra')
  })
})
