import { describe, expect, it } from 'vitest'
import { resolveOnboarding } from './onboarding.js'

/**
 * What this file is defending.
 *
 * The first-run flow takes over the whole panel, so "is this a new account?" is the same question as
 * "does this person see eight setup screens instead of their own data?". There are two ways to get
 * that wrong and both are bad: showing the tour to somebody with twelve sources on file, and showing
 * it again to somebody who skipped it and has not added anything yet. The decision is a pure
 * function precisely so it can be pinned here.
 */
describe('resolveOnboarding', () => {
  it('waits while storage is still being read', () => {
    expect(resolveOnboarding(undefined, false)).toEqual({ status: 'loading', step: 0 })
  })

  it('waits while the profile is still loading, rather than guessing', () => {
    // The guess that matters: assuming "empty" here would flash the tour at an existing user
    // every time the panel opens before their profile arrives.
    expect(resolveOnboarding(null, undefined)).toEqual({ status: 'loading', step: 0 })
  })

  it('runs for an account with nothing in it, and writes that down', () => {
    expect(resolveOnboarding(null, false)).toEqual({
      status: 'running',
      step: 0,
      write: { done: false, step: 0 },
    })
  })

  it('is already done for an account that has content, and writes that down too', () => {
    // Written rather than re-derived, so somebody who later deletes everything is not onboarded
    // a second time.
    expect(resolveOnboarding(null, true)).toEqual({
      status: 'done',
      step: 0,
      write: { done: true, step: 0 },
    })
  })

  it('resumes an unfinished flow at the step it was left on', () => {
    expect(resolveOnboarding({ done: false, step: 5 }, false)).toEqual({
      status: 'running',
      step: 5,
    })
  })

  it('stays finished on an empty account, so a skip is honoured', () => {
    expect(resolveOnboarding({ done: true, step: 0 }, false)).toEqual({ status: 'done', step: 0 })
  })

  it('never resumes before the first screen', () => {
    // Storage can hold anything a previous version wrote, and a negative index would render
    // nothing at all.
    expect(resolveOnboarding({ done: false, step: -3 }, false)).toEqual({
      status: 'running',
      step: 0,
    })
  })

  it('writes nothing once a record exists', () => {
    expect(resolveOnboarding({ done: false, step: 2 }, true).write).toBeUndefined()
    expect(resolveOnboarding({ done: true, step: 0 }, false).write).toBeUndefined()
  })
})
