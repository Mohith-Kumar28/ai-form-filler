import type { FillTier } from '@aff/shared'
import { describe, expect, it } from 'vitest'
import { budgetFills } from './fill.js'

/** `f7:3` — field 7, tier 3. Terse because these cases are mostly about ordering. */
const fields = (spec: string) =>
  spec.split(' ').map((entry, index) => {
    const [, tier] = entry.split(':')
    return { fieldId: `f${index}`, tier: Number(tier) as FillTier }
  })

describe('budgetFills', () => {
  it('affords everything when the allowance is ample', () => {
    const { affordable, unaffordable } = budgetFills(fields('a:1 b:2 c:3'), 600, 150)
    expect(affordable).toHaveLength(3)
    expect(unaffordable).toEqual([])
  })

  it('trims to the action budget and keeps document order', () => {
    // The fields kept are the first three, not the three cheapest. A form answered down to
    // question three is legible; the same form with holes scattered through it is not.
    const { affordable, unaffordable } = budgetFills(fields('a:1 b:1 c:1 d:1 e:1'), 3, 150)
    expect(affordable.map((f) => f.fieldId)).toEqual(['f0', 'f1', 'f2'])
    expect(unaffordable.map((s) => s.fieldId)).toEqual(['f3', 'f4'])
  })

  it('marks everything unaffordable for an account with no subscription', () => {
    // A limit of zero is what makes filling the paywall. `enforceQuota` refuses first, so this is
    // the belt to that braces — but it must not silently fill anything.
    const { affordable, unaffordable } = budgetFills(fields('a:1 b:3'), 0, 0)
    expect(affordable).toEqual([])
    expect(unaffordable).toHaveLength(2)
    expect(unaffordable.every((s) => s.reason === 'quota_exhausted')).toBe(true)
  })

  it('stops essays at the long-answer ceiling while short answers continue', () => {
    // The point of a second meter: one long answer costs about a hundred times a dropdown, so
    // running out of essays must not end the fill.
    const { affordable, unaffordable } = budgetFills(fields('a:3 b:3 c:1 d:3 e:2'), 600, 2)
    expect(affordable.map((f) => f.fieldId)).toEqual(['f0', 'f1', 'f2', 'f4'])
    expect(unaffordable.map((s) => s.fieldId)).toEqual(['f3'])
  })

  it('says which ceiling was hit', () => {
    // Two ways to run out, needing different remedies: one waits for the month, the other is
    // specifically about essays and rewrites.
    const longOnly = budgetFills(fields('a:3 b:3'), 600, 1)
    expect(longOnly.unaffordable[0]?.detail).toBe('long answer')

    const bothGone = budgetFills(fields('a:3 b:3'), 1, 1)
    expect(bothGone.unaffordable[0]?.detail).toBeUndefined()
  })

  it('does not spend long budget on fields that are not long', () => {
    const { affordable } = budgetFills(fields('a:1 b:2 c:1'), 600, 0)
    expect(affordable).toHaveLength(3)
  })

  it('treats a negative allowance as none rather than as credit', () => {
    // `limit - used` can go negative: the pre-check and the charge are not one transaction, so two
    // concurrent fills can both pass. Arithmetic must not turn that into free work.
    const { affordable, unaffordable } = budgetFills(fields('a:1'), -5, -5)
    expect(affordable).toEqual([])
    expect(unaffordable).toHaveLength(1)
  })

  it('never rations tier 0, even on a spent allowance', () => {
    // A tier-0 resolution is a lookup against saved information: no model call, no cost. `runFill`
    // happens never to pass one, but the rule belongs in the function that does the rationing
    // rather than in an invariant of a single caller.
    const { affordable, unaffordable } = budgetFills(fields('a:0 b:1 c:0'), 0, 0)
    expect(affordable.map((f) => f.fieldId)).toEqual(['f0', 'f2'])
    expect(unaffordable.map((s) => s.fieldId)).toEqual(['f1'])
  })
})
