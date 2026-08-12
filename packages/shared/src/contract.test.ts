import { describe, expect, it } from 'vitest'
import { Account, PLAN_LIMITS } from './account.js'
import { ApiErrorResponse } from './api.js'
import { FillPlan, FillRequest, REVIEW_CONFIDENCE_THRESHOLD } from './fill.js'
import { FormSchema } from './form.js'
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

describe('FillRequest', () => {
  it('defaults to the auto tier router rather than force-escalating', () => {
    const parsed = FillRequest.parse({ form: minimalForm })
    expect(parsed.quality).toBe('auto')
    expect(parsed.overwriteExisting).toBe(false)
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
  it('accepts a free-tier account at the documented limit', () => {
    const parsed = Account.parse({
      id: 'u_1',
      email: 'a@b.com',
      quota: {
        plan: 'free',
        used: 0,
        limit: PLAN_LIMITS.free,
        resetsAt: new Date().toISOString(),
      },
      profileReady: false,
      profileVersion: 0,
    })
    expect(parsed.quota.limit).toBe(50)
  })
})

describe('ApiErrorResponse', () => {
  it('maps quota exhaustion to 402 so the client can show the upgrade prompt', () => {
    const err = new ApiErrorResponse('QUOTA_EXCEEDED', 'Out of forms', {
      quota: { used: 50, limit: 50, resetsAt: '2026-09-01T00:00:00.000Z' },
    })
    expect(err.status).toBe(402)
    expect(err.toJSON().quota?.used).toBe(50)
  })

  it('maps rate limiting to 429 and carries a retry hint', () => {
    const err = new ApiErrorResponse('RATE_LIMITED', 'Slow down', { retryAfter: 12 })
    expect(err.status).toBe(429)
    expect(err.toJSON().retryAfter).toBe(12)
  })
})
