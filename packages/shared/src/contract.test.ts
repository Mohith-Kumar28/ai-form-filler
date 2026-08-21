import { describe, expect, it } from 'vitest'
import { Account, PLAN_LIMITS, PLAN_LONGFORM_LIMITS } from './account.js'
import { ApiErrorResponse } from './api.js'
import { offerFor } from './constants.js'
import { FillPlan, FillRequest, REVIEW_CONFIDENCE_THRESHOLD } from './fill.js'
import { FormSchema, hasAnswer } from './form.js'
import { Profile } from './profile.js'

const minimalForm = {
  origin: 'https://jobs.example.com',
  adapter: 'generic',
  fields: [{ id: 'f1', kind: 'email', label: 'Email address' }],
}

describe('FormSchema', () => {
  it('applies defaults so adapters can emit a minimal field', () => {
    const parsed = FormSchema.parse(minimalForm)
    expect(parsed.path).toBe('/')
    expect(parsed.fields[0]?.required).toBe(false)
  })

  it('rejects a full URL in origin, which would leak query-string PII', () => {
    expect(() => FormSchema.parse({ ...minimalForm, origin: 'not-a-url' })).toThrow()
  })

  it('refuses an empty field list — nothing to fill is a detection bug, not a valid form', () => {
    expect(() => FormSchema.parse({ ...minimalForm, fields: [] })).toThrow()
  })
})

/**
 * The dial-code prefix, which is the reason this function exists.
 *
 * A phone widget seeds its own input with the code of whatever country its flag is showing,
 * before anybody has typed. Reading that as "already answered" made the fill skip the field and
 * made the content script withhold the inline sparkle — one prefix, two symptoms.
 */
describe('hasAnswer', () => {
  it('treats a lone dial code in a tel field as unanswered', () => {
    for (const currentValue of ['+91', '+1', '+', '+91 ', '+44 ()', '+998']) {
      expect(hasAnswer({ kind: 'tel', currentValue })).toBe(false)
    }
  })

  it('treats a real phone number as answered', () => {
    expect(hasAnswer({ kind: 'tel', currentValue: '+91 98765 43210' })).toBe(true)
    expect(hasAnswer({ kind: 'tel', currentValue: '9876543210' })).toBe(true)
  })

  it('only forgives the prefix on tel — a "+91" typed into a text box is an answer', () => {
    expect(hasAnswer({ kind: 'text', currentValue: '+91' })).toBe(true)
  })

  it('is false for genuinely empty values, whatever the kind', () => {
    expect(hasAnswer({ kind: 'text', currentValue: '   ' })).toBe(false)
    expect(hasAnswer({ kind: 'tel' })).toBe(false)
    expect(hasAnswer({})).toBe(false)
  })

  it('does not forgive a national-format prefix, which is indistinguishable from a number', () => {
    // No "+", so "91" could be the first two digits of what somebody actually typed.
    expect(hasAnswer({ kind: 'tel', currentValue: '91' })).toBe(true)
  })
})

describe('FillRequest', () => {
  it('leaves existing values alone unless asked', () => {
    const parsed = FillRequest.parse({ form: minimalForm })
    expect(parsed.overwriteExisting).toBe(false)
  })

  it('carries no quality override — the tier router owns model choice', () => {
    // A "take more care" toggle used to push generative fields to a model costing 4× more, on
    // our key, for a judgement the user has no information to make.
    expect('quality' in FillRequest.parse({ form: minimalForm })).toBe(false)
  })
})

describe('FillPlan', () => {
  it('round-trips a tier-0 fill with no reasoning', () => {
    const plan = FillPlan.parse({
      fills: [{ fieldId: 'f1', value: 'a@b.com', confidence: 1, tier: 0 }],
      skipped: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costMicroUsd: 0,
        latencyMs: 3,
        modelsUsed: [],
      },
      quotaRemaining: 49,
    })
    expect(plan.fills[0]?.tier).toBe(0)
    expect(plan.fills[0]?.reasoning).toBeUndefined()
  })

  it('rejects a confidence outside 0..1', () => {
    expect(() =>
      FillPlan.parse({
        fills: [{ fieldId: 'f1', value: 'x', confidence: 1.4, tier: 2 }],
        skipped: [],
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costMicroUsd: 0,
          latencyMs: 0,
          modelsUsed: [],
        },
        quotaRemaining: 0,
      }),
    ).toThrow()
  })

  it('keeps the review threshold inside the range the UI branches on', () => {
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBeGreaterThan(0)
    expect(REVIEW_CONFIDENCE_THRESHOLD).toBeLessThan(1)
  })
})

describe('Profile', () => {
  it('parses an empty profile so a fresh account is representable', () => {
    const parsed = Profile.parse({ identity: {}, style: {} })
    expect(parsed.version).toBe(0)
    expect(parsed.identity.links).toEqual({})
    expect(parsed.sources).toEqual([])
  })
})

describe('Account', () => {
  it('accepts an account with no subscription, whose allowance is nothing', () => {
    // `free` is the one-time grant, not a monthly tier. It carries a real allowance, so the first
    // fill succeeds; `enforceQuota` refuses once the grant is spent, which is the paywall.
    const parsed = Account.parse({
      id: 'u_1',
      email: 'a@b.com',
      quota: {
        plan: 'free',
        used: 0,
        limit: PLAN_LIMITS.free,
        longUsed: 0,
        longLimit: PLAN_LONGFORM_LIMITS.free,
        resetsAt: new Date().toISOString(),
      },
      profileReady: false,
      profileVersion: 0,
    })
    expect(parsed.quota.limit).toBe(PLAN_LIMITS.free)
    expect(parsed.quota.longLimit).toBe(PLAN_LONGFORM_LIMITS.free)
    expect(parsed.subscription).toBeUndefined()
  })

  it('requires the long-answer meter rather than defaulting it', () => {
    /*
     * Deliberately not optional. An absent sub-meter would have to be read as either "no long
     * answers left" or "no limit", and both are wrong — so the server is made to say which.
     */
    expect(() =>
      Account.parse({
        id: 'u_1',
        email: 'a@b.com',
        quota: { plan: 'pro', used: 0, limit: 600, resetsAt: new Date().toISOString() },
        profileReady: false,
        profileVersion: 0,
      }),
    ).toThrow()
  })

  it('carries a trial with its conversion date', () => {
    // Dodo reports a trialing subscription as plain `active` and has no field for the trial, so
    // this date is ours — recorded at checkout and echoed back through webhook metadata.
    const trialEndsAt = Math.floor(Date.now() / 1000) + 14 * 86_400
    const parsed = Account.parse({
      id: 'u_1',
      email: 'a@b.com',
      quota: {
        plan: 'pro',
        used: 12,
        limit: PLAN_LIMITS.pro,
        longUsed: 2,
        longLimit: PLAN_LONGFORM_LIMITS.pro,
        resetsAt: new Date().toISOString(),
      },
      profileReady: true,
      profileVersion: 1,
      subscription: { plan: 'pro', status: 'trial', trialEndsAt },
    })
    expect(parsed.subscription?.status).toBe('trial')
    expect(parsed.subscription?.trialEndsAt).toBe(trialEndsAt)
  })

  it('accepts the Dodo states that were previously missing', () => {
    // `pending` and `failed` were absent from the enum, so an incomplete mandate was
    // indistinguishable from a working subscription.
    for (const status of ['pending', 'failed'] as const) {
      const parsed = Account.parse({
        id: 'u_1',
        email: 'a@b.com',
        quota: {
          plan: 'free',
          used: 0,
          limit: 0,
          longUsed: 0,
          longLimit: 0,
          resetsAt: new Date().toISOString(),
        },
        profileReady: true,
        profileVersion: 1,
        subscription: { plan: 'pro', status },
      })
      expect(parsed.subscription?.status).toBe(status)
    }
  })
})

describe('ApiErrorResponse', () => {
  it('maps quota exhaustion to 402 so the client can show the upgrade prompt', () => {
    const err = new ApiErrorResponse('QUOTA_EXCEEDED', 'Out of AI actions', {
      quota: { used: 600, limit: 600, resetsAt: '2026-09-01T00:00:00.000Z' },
    })
    expect(err.status).toBe(402)
    expect(err.toJSON().quota?.used).toBe(600)
  })

  it('maps rate limiting to 429 and carries a retry hint', () => {
    const err = new ApiErrorResponse('RATE_LIMITED', 'Slow down', { retryAfter: 12 })
    expect(err.status).toBe(429)
    expect(err.toJSON().retryAfter).toBe(12)
  })
})

describe('offerFor', () => {
  /*
    The rule three surfaces share.

    Home asks it when Fill is pressed, the content script asks it when the launcher is pressed with
    nothing left to spend, and both hand the answer to the same sheet. They used to compute it
    inline, which is two copies of the rule — and the day one of them drifted, the page would have
    offered a trial to somebody already paying for Ultra.
  */
  it('offers the trial to an account that has never subscribed', () => {
    expect(offerFor('free')).toBe('trial')
  })

  it('offers a plan comparison to anybody who has run out of a plan they pay for', () => {
    expect(offerFor('pro')).toBe('compare')
    expect(offerFor('ultra')).toBe('compare')
  })

  it('offers the trial for an unrecognised plan name', () => {
    // Belt and braces: the plan arrives over the wire, and a trial offer is the safe wrong answer
    // — it is the one that cannot show a paying user a comparison of plans they already have.
    expect(offerFor('')).toBe('trial')
  })

  /*
    The regression this signature exists to prevent.

    The rule used to be `limit <= 0`, which was a proxy for "free" that held only while
    `PLAN_LIMITS.free` was 0. Now that free carries a real grant, the proxy inverts: an exhausted
    free account would have been shown a comparison of plans it has never had. Asserting the two
    are no longer interchangeable is what stops the old shortcut coming back.
  */
  it('does not treat a free plan as a paid one now that its limit is non-zero', () => {
    expect(PLAN_LIMITS.free).toBeGreaterThan(0)
    expect(offerFor('free')).toBe('trial')
  })
})
