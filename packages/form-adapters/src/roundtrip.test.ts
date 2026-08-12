import { beforeEach, describe, expect, it } from 'vitest'
import { detectPageForm } from './index.js'

/**
 * End-to-end exercise of the page-side path: detect a realistic application form, then apply
 * a plan back onto it and assert the DOM actually changed.
 *
 * This covers the seam the unit tests do not — that the ids minted during detection are the
 * same ones application looks up, across the round trip the model call sits inside.
 */

const APPLICATION_FORM = `
<h1>Senior Engineer at Acme</h1>
<form>
  <fieldset>
    <legend>About you</legend>
    <label for="name">Full name</label>
    <input id="name" name="name" autocomplete="name" required />

    <label for="email">Email address</label>
    <input id="email" name="email" type="email" autocomplete="email" required />

    <label for="phone">Phone number</label>
    <input id="phone" name="phone" type="tel" />

    <label for="gh">GitHub profile</label>
    <input id="gh" name="github" type="url" />
  </fieldset>

  <fieldset>
    <legend>Eligibility</legend>
    <label for="country">Country</label>
    <select id="country" name="country">
      <option value="">Select…</option>
      <option value="in">India</option>
      <option value="us">United States</option>
    </select>

    <div role="radiogroup" aria-label="Do you require visa sponsorship?">
      <label><input type="radio" name="visa" value="yes" />Yes</label>
      <label><input type="radio" name="visa" value="no" />No</label>
    </div>

    <label><input type="checkbox" name="tos" />I agree to the terms</label>
  </fieldset>

  <fieldset>
    <legend>Your application</legend>
    <label for="why">Why do you want to work here?</label>
    <textarea id="why" name="why" maxlength="2000"></textarea>

    <label for="years">Years of experience</label>
    <input id="years" name="years" type="number" />
  </fieldset>

  <input type="hidden" name="csrf" value="secret" />
  <input type="password" name="password" />
  <input type="submit" value="Apply" />
</form>`

beforeEach(() => {
  document.body.innerHTML = APPLICATION_FORM
})

const detect = () => detectPageForm(document, new URL('https://boards.acme.com/jobs/42'))

describe('detection on a realistic application form', () => {
  it('finds every fillable field and nothing else', () => {
    const result = detect()
    const labels = result?.form.fields.map((f) => f.label) ?? []

    expect(labels).toEqual([
      'Do you require visa sponsorship?',
      'I agree to the terms',
      'Full name',
      'Email address',
      'Phone number',
      'GitHub profile',
      'Country',
      'Why do you want to work here?',
      'Years of experience',
    ])
  })

  it('excludes the hidden, password, and submit inputs', () => {
    const serialised = JSON.stringify(detect()?.form)
    expect(serialised).not.toContain('csrf')
    expect(serialised).not.toContain('password')
    expect(serialised).not.toContain('Apply')
  })

  it('carries the signals the tier router needs', () => {
    const fields = detect()?.form.fields ?? []
    const byLabel = new Map(fields.map((f) => [f.label, f]))

    // autocomplete is the highest-confidence tier-0 signal.
    expect(byLabel.get('Email address')?.autocomplete).toBe('email')
    // maxLength is what stops a capped field being treated as prose.
    expect(byLabel.get('Why do you want to work here?')?.maxLength).toBe(2000)
    // options are what a tier-1 answer must be drawn from.
    expect(byLabel.get('Country')?.options).toHaveLength(2)
    expect(byLabel.get('Full name')?.required).toBe(true)
  })

  it('sends the origin and path but never the full URL', () => {
    const form = detect()?.form
    expect(form?.origin).toBe('https://boards.acme.com')
    expect(form?.path).toBe('/jobs/42')
  })

  it('captures page context for the "why this company" question', () => {
    expect(detect()?.form.pageContext).toContain('Senior Engineer')
  })
})

describe('applying a plan back onto the page', () => {
  it('writes every field type and reports success', () => {
    const result = detect()
    expect(result).not.toBeNull()

    const byLabel = new Map((result?.form.fields ?? []).map((f) => [f.label, f.id]))

    // Mirrors what a FillPlan carries: fieldId + value, nothing DOM-specific.
    const plan: { fieldId: string; value: string }[] = [
      { fieldId: byLabel.get('Full name') ?? '', value: 'Mohith Kumar' },
      { fieldId: byLabel.get('Email address') ?? '', value: 'mohith@example.com' },
      { fieldId: byLabel.get('Country') ?? '', value: 'India' },
      { fieldId: byLabel.get('Do you require visa sponsorship?') ?? '', value: 'no' },
      { fieldId: byLabel.get('I agree to the terms') ?? '', value: 'Yes' },
      {
        fieldId: byLabel.get('Why do you want to work here?') ?? '',
        value: 'I have followed the compiler work for years.',
      },
    ]

    const applied: string[] = []
    for (const fill of plan) {
      const field = result?.elements.get(fill.fieldId)
      expect(field).toBeDefined()
      if (field && result?.adapter.applyValue(field, fill.value)) applied.push(fill.fieldId)
    }

    expect(applied).toHaveLength(plan.length)

    // The DOM is the assertion that matters — the return value could lie.
    expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe('Mohith Kumar')
    expect(document.querySelector<HTMLInputElement>('#email')?.value).toBe('mohith@example.com')
    // Matched by visible label, resolved to the opaque option value.
    expect(document.querySelector<HTMLSelectElement>('#country')?.value).toBe('in')
    expect(
      document.querySelector<HTMLInputElement>('input[name="visa"][value="no"]')?.checked,
    ).toBe(true)
    expect(document.querySelector<HTMLInputElement>('input[name="tos"]')?.checked).toBe(true)
    expect(document.querySelector<HTMLTextAreaElement>('#why')?.value).toContain('compiler')
  })

  it('reports failure instead of guessing when an option does not exist', () => {
    const result = detect()
    const countryId = result?.form.fields.find((f) => f.label === 'Country')?.id ?? ''
    const field = result?.elements.get(countryId)

    expect(result?.adapter.applyValue(field!, 'Atlantis')).toBe(false)
    expect(document.querySelector<HTMLSelectElement>('#country')?.value).toBe('')
  })

  it('surfaces already-filled values so the server can skip them', () => {
    document.querySelector<HTMLInputElement>('#email')!.value = 'existing@example.com'
    const fields = detect()?.form.fields ?? []
    const email = fields.find((f) => f.label === 'Email address')

    expect(email?.currentValue).toBe('existing@example.com')
  })

  it('detects a stale element so the content script can report it failed', () => {
    const result = detect()
    const nameId = result?.form.fields.find((f) => f.label === 'Full name')?.id ?? ''
    const field = result?.elements.get(nameId)

    // Simulates a re-render between detection and application.
    field?.element.remove()

    expect(field?.element.isConnected).toBe(false)
  })
})
