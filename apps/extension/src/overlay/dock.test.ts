import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type DockHandle, mountDock } from './launcher.js'

/**
 * The dock's state machine.
 *
 * These exist because the previous version had no path back from `done` or `error` — a
 * finished fill left the button reading "Filled" until the page reloaded, and a failed one
 * left it spinning on "Filling…" forever. Both are exactly the kind of defect a render test
 * catches and a screenshot does not.
 */

/**
 * The overlay uses a **closed** shadow root, so its contents are unreachable from the host
 * element — that is the point, and production code must not weaken it for testability.
 * Capturing the root as it is created is the test seam instead.
 */
let shadow: ShadowRoot | null = null

/** Scoped to the dock element, not the whole root — the root also holds the <style> block,
 *  whose selectors contain words like "filled" and would satisfy any loose assertion. */
function text(): string {
  return shadow?.querySelector('.dock')?.textContent ?? ''
}

let dock: DockHandle
let onActivate: ReturnType<typeof vi.fn>
let onDismiss: ReturnType<typeof vi.fn>
let onReview: ReturnType<typeof vi.fn>
let onSignIn: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.documentElement.innerHTML = '<head></head><body></body>'
  shadow = null

  const attach = Element.prototype.attachShadow
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
    this: Element,
    init: ShadowRootInit,
  ) {
    // Force `open` only inside the test so the captured root stays inspectable.
    const root = attach.call(this, { ...init, mode: 'open' })
    shadow = root
    return root
  })

  onActivate = vi.fn()
  onDismiss = vi.fn()
  onReview = vi.fn()
  onSignIn = vi.fn()
  dock = mountDock({ onActivate, onDismiss, onReview, onSignIn })
})

describe('dock placement', () => {
  it('mounts a host attached to <html>, not <body>', () => {
    // Some sites replace body wholesale on client-side navigation, which would silently
    // remove an overlay parented to it.
    const host = document.getElementById('aff-overlay-host')
    expect(host?.parentElement?.tagName).toBe('HTML')
  })
})

describe('dock state machine', () => {
  it('shows the field count when idle', () => {
    dock.setState({ kind: 'idle', fieldCount: 34 })
    expect(text()).toContain('Fill 34 fields')
  })

  it('uses the singular for one field', () => {
    dock.setState({ kind: 'idle', fieldCount: 1 })
    expect(text()).toContain('Fill 1 field')
    expect(text()).not.toContain('1 fields')
  })

  it('reports the current stage while working', () => {
    dock.setState({ kind: 'working', stage: 'generating', done: 0, total: 34 })
    expect(text()).toContain('Writing your answers')
  })

  it('shows a running count once fields start landing', () => {
    dock.setState({ kind: 'working', stage: 'applying', done: 12, total: 34 })
    expect(text()).toContain('12/34')
  })

  it('reports the filled count when done', () => {
    dock.setState({ kind: 'done', applied: 24, answered: 24, total: 34, inferred: 0 })
    expect(text()).toContain('24')
    expect(text()).toContain('34')
    expect(text()).toContain('10 left blank')
  })

  it('surfaces judgement calls above the blank count when both exist', () => {
    // A judgement call is the thing the user must look at before submitting; a blank field
    // is merely absent and cannot be wrong.
    dock.setState({ kind: 'done', applied: 30, answered: 30, total: 34, inferred: 3 })
    expect(text()).toContain('3 judgement calls to check')
    expect(text()).not.toContain('left blank')
  })

  it('says so plainly when nothing needs attention', () => {
    dock.setState({ kind: 'done', applied: 34, answered: 34, total: 34, inferred: 0 })
    expect(text()).toContain('Everything answered')
  })

  it('recovers from done back to idle', () => {
    // The bug this file exists for: the old dock had no path out of `done`.
    dock.setState({ kind: 'done', applied: 5, answered: 5, total: 5, inferred: 0 })
    dock.setState({ kind: 'idle', fieldCount: 5 })
    expect(text()).toContain('Fill 5 fields')
    expect(text()).not.toContain('filled')
  })

  it('recovers from error back to idle', () => {
    dock.setState({ kind: 'error', message: 'AI Gateway has no credits.' })
    expect(text()).toContain('Could not fill')
    dock.setState({ kind: 'idle', fieldCount: 8 })
    expect(text()).toContain('Fill 8 fields')
    expect(text()).not.toContain('Could not fill')
  })

  it('offers a retry on error', () => {
    dock.setState({ kind: 'error', message: 'Network unreachable' })
    expect(text()).toContain('Try again')
    expect(text()).toContain('Network unreachable')
  })

  it('escapes error text rather than rendering it as markup', () => {
    // Error strings can carry provider output, which is untrusted.
    dock.setState({ kind: 'error', message: '<img src=x onerror=alert(1)>' })
    expect(shadow?.querySelector('img')).toBeNull()
    expect(text()).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('dock actions', () => {
  it('offers Review only when there is something to review', () => {
    dock.setState({ kind: 'done', applied: 10, answered: 10, total: 10, inferred: 0 })
    expect(text()).not.toContain('Review')

    dock.setState({ kind: 'done', applied: 10, answered: 10, total: 10, inferred: 2 })
    expect(text()).toContain('Review')
  })

  it('always offers a way out when finished', () => {
    dock.setState({ kind: 'done', applied: 10, answered: 10, total: 10, inferred: 0 })
    expect(text()).toContain('Done')
  })

  it('announces itself to assistive technology', () => {
    // A fill runs for 10-20s; without a live region a screen-reader user gets no signal
    // between clicking and completion.
    expect(shadow?.querySelector('.dock')?.getAttribute('aria-live')).toBe('polite')
  })
})

describe('an ended session', () => {
  it('offers sign-in instead of a retry that cannot succeed', () => {
    dock.setState({
      kind: 'error',
      message: 'Your session ended. Sign in again to continue.',
      needsAuth: true,
    })

    expect(text()).toContain('Sign in')
    // "Try again" would send the user in a loop: the request fails the same way every time
    // until they re-authenticate.
    expect(text()).not.toContain('Try again')
  })

  it('sends the user to the panel, where sign-in can actually happen', () => {
    dock.setState({ kind: 'error', message: 'Your session ended.', needsAuth: true })
    shadow?.querySelector<HTMLElement>('[data-action="signin"]')?.click()

    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('still offers a retry for ordinary failures', () => {
    dock.setState({ kind: 'error', message: 'The model timed out.' })

    expect(text()).toContain('Try again')
    expect(text()).not.toContain('Sign in')
  })

  it('names the state rather than blaming the fill', () => {
    dock.setState({ kind: 'error', message: 'Your session ended.', needsAuth: true })
    expect(text()).toContain('Signed out')
    expect(text()).not.toContain('Could not fill')
  })
})

describe('answers the page refused', () => {
  it('names the gap instead of leaving it to be inferred from two numbers', () => {
    // 10 answered, 6 written. The old copy said only "6 of 11 filled", which reads as
    // "it had no answer" when in fact it had four the page would not take.
    dock.setState({ kind: 'done', applied: 6, answered: 10, total: 11, inferred: 1 })

    expect(text()).toContain('6')
    expect(text()).toContain('4 answered but not accepted')
  })

  it('offers Review when answers were rejected, even with nothing to second-guess', () => {
    dock.setState({ kind: 'done', applied: 6, answered: 10, total: 11, inferred: 0 })
    expect(text()).toContain('Review')
  })

  it('says nothing about rejection when the page took everything', () => {
    dock.setState({ kind: 'done', applied: 10, answered: 10, total: 11, inferred: 0 })
    expect(text()).not.toContain('not accepted')
  })
})
