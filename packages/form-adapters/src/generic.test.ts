import { beforeEach, describe, expect, it } from 'vitest'
import { GenericAdapter } from './generic.js'
import { detectPageForm } from './index.js'
import { resolveLabel, resolveSection } from './label.js'

const adapter = new GenericAdapter()

beforeEach(() => {
  document.body.innerHTML = ''
})

function detect(html: string) {
  document.body.innerHTML = html
  const forms = adapter.detectForms(document)
  return forms[0]?.fields ?? []
}

function labelsOf(html: string): string[] {
  return detect(html).map((f) => f.schema.label)
}

describe('label resolution precedence', () => {
  it('prefers an explicit label[for] over everything else', () => {
    expect(
      labelsOf(`
        <label for="e">Work email</label>
        <input id="e" aria-label="Ignore me" placeholder="Ignore me too" />`),
    ).toEqual(['Work email'])
  })

  it('uses a wrapping label', () => {
    expect(labelsOf('<label>Phone number<input type="tel" /></label>')).toEqual(['Phone number'])
  })

  it('excludes the input value from a wrapping label', () => {
    // Without stripping nested inputs the label would absorb the field's own value.
    expect(labelsOf('<label>City<input value="Bengaluru" /></label>')).toEqual(['City'])
  })

  it('falls back to aria-label', () => {
    expect(labelsOf('<input aria-label="Full name" />')).toEqual(['Full name'])
  })

  it('falls back to aria-labelledby', () => {
    expect(labelsOf('<span id="lbl">Portfolio URL</span><input aria-labelledby="lbl" />')).toEqual([
      'Portfolio URL',
    ])
  })

  it('falls back to placeholder, then to name', () => {
    expect(labelsOf('<input placeholder="you@example.com" />')).toEqual(['you@example.com'])
    expect(labelsOf('<input name="workAuthStatus" />')).toEqual(['workAuthStatus'])
  })

  it('uses ancestor text only when the ancestor holds exactly one input', () => {
    // A container wrapping one field describes that field.
    expect(labelsOf('<div>Years of experience<input /></div>')).toEqual(['Years of experience'])
  })

  it('does not label sibling fields with a shared section heading', () => {
    // The dangerous case: a container with several inputs describes the *section*.
    // Reusing it would give every field the same plausible-looking wrong label.
    const labels = labelsOf(`
      <div>
        Personal details
        <input name="first" />
        <input name="last" />
      </div>`)
    expect(labels).toEqual(['first', 'last'])
  })
})

describe('field kinds', () => {
  it('maps input types onto behaviours', () => {
    const fields = detect(`
      <input type="email" aria-label="Email" />
      <input type="tel" aria-label="Phone" />
      <input type="url" aria-label="Site" />
      <input type="number" aria-label="Years" />
      <input type="date" aria-label="Start" />
      <textarea aria-label="Why us"></textarea>`)
    expect(fields.map((f) => f.schema.kind)).toEqual([
      'email',
      'tel',
      'url',
      'number',
      'date',
      'longtext',
    ])
  })

  it('treats contenteditable as long text', () => {
    const fields = detect('<div contenteditable="true" aria-label="Cover letter"></div>')
    expect(fields[0]?.schema.kind).toBe('longtext')
  })

  it('captures select options and drops the placeholder option', () => {
    const fields = detect(`
      <select aria-label="Country">
        <option value="">Select…</option>
        <option value="in">India</option>
        <option value="us">United States</option>
      </select>`)
    expect(fields[0]?.schema.options).toEqual([
      { value: 'in', label: 'India' },
      { value: 'us', label: 'United States' },
    ])
  })
})

describe('grouped controls', () => {
  it('collapses a radio group into one field with options', () => {
    const fields = detect(`
      <fieldset>
        <legend>Do you require visa sponsorship?</legend>
        <label><input type="radio" name="visa" value="yes" />Yes</label>
        <label><input type="radio" name="visa" value="no" />No</label>
      </fieldset>`)

    expect(fields).toHaveLength(1)
    expect(fields[0]?.schema.kind).toBe('radio')
    expect(fields[0]?.schema.label).toBe('Do you require visa sponsorship?')
    expect(fields[0]?.schema.options).toEqual([
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ])
  })

  it('exposes every member of the group for writing', () => {
    const fields = detect(`
      <label><input type="radio" name="r" value="a" />A</label>
      <label><input type="radio" name="r" value="b" />B</label>`)
    expect(fields[0]?.groupElements).toHaveLength(2)
  })

  it('treats several same-named checkboxes as multiselect', () => {
    const fields = detect(`
      <fieldset>
        <legend>Languages</legend>
        <label><input type="checkbox" name="lang" value="en" />English</label>
        <label><input type="checkbox" name="lang" value="hi" />Hindi</label>
      </fieldset>`)
    expect(fields[0]?.schema.kind).toBe('multiselect')
  })

  it('treats a lone checkbox as a yes/no question', () => {
    const fields = detect('<label><input type="checkbox" name="tos" />I agree</label>')
    expect(fields[0]?.schema.kind).toBe('checkbox')
  })

  it('reports the currently selected option', () => {
    const fields = detect(`
      <label><input type="radio" name="r" value="a" />A</label>
      <label><input type="radio" name="r" value="b" checked />B</label>`)
    expect(fields[0]?.schema.currentValue).toBe('b')
  })
})

describe('fields we refuse to touch', () => {
  it('never detects a password field', () => {
    expect(detect('<input type="password" aria-label="Password" />')).toHaveLength(0)
  })

  it('never detects a search input', () => {
    expect(detect('<input type="search" aria-label="Search" />')).toHaveLength(0)
  })

  it('never detects payment fields, however they are labelled', () => {
    expect(
      detect(`
        <input name="cardNumber" aria-label="Card number" />
        <input name="cvv" aria-label="CVV" />
        <input id="security_code" aria-label="Security code" />`),
    ).toHaveLength(0)
  })

  it('never detects captcha fields', () => {
    expect(detect('<input name="captcha" aria-label="Captcha" />')).toHaveLength(0)
    expect(detect('<input name="g-recaptcha-response" />')).toHaveLength(0)
    expect(detect('<div class="h-captcha"><input /></div>')).toHaveLength(0)
  })

  it('skips a field named like a social security number', () => {
    expect(detect('<input name="ssn" aria-label="SSN" />')).toHaveLength(0)
  })

  it('skips hidden, submit, and button inputs', () => {
    expect(
      detect(`
        <input type="hidden" name="csrf" />
        <input type="submit" value="Apply" />
        <button type="button">Cancel</button>`),
    ).toHaveLength(0)
  })

  it('skips disabled and readonly fields', () => {
    expect(
      detect('<input aria-label="A" disabled /><input aria-label="B" readonly />'),
    ).toHaveLength(0)
  })

  it('skips aria-hidden fields', () => {
    expect(detect('<input aria-label="Ghost" aria-hidden="true" />')).toHaveLength(0)
  })

  it('skips OTP inputs with maxlength=1 and numeric inputmode', () => {
    expect(detect('<input maxlength="1" inputmode="numeric" aria-label="Digit 1" />')).toHaveLength(
      0,
    )
    expect(detect('<input type="number" maxlength="1" aria-label="Pin" />')).toHaveLength(0)
    expect(detect('<input type="tel" maxlength="1" aria-label="Code" />')).toHaveLength(0)
  })

  it('skips inputs with autocomplete=one-time-code', () => {
    expect(detect('<input autocomplete="one-time-code" aria-label="Verification" />')).toHaveLength(
      0,
    )
  })

  it('skips inputs with OTP-related class names', () => {
    expect(detect('<input class="otp-input" aria-label="Digit" />')).toHaveLength(0)
    expect(detect('<input class="pin-code-field" aria-label="PIN" />')).toHaveLength(0)
    expect(detect('<input class="verification-code" aria-label="Code" />')).toHaveLength(0)
  })
})

describe('field metadata', () => {
  it('carries required, maxLength, autocomplete, and hint through', () => {
    const fields = detect(`
      <label for="a">Bio</label>
      <textarea id="a" required maxlength="280" autocomplete="off"
                aria-describedby="h"></textarea>
      <span id="h">Keep it under 280 characters.</span>`)

    const schema = fields[0]?.schema
    expect(schema?.required).toBe(true)
    expect(schema?.maxLength).toBe(280)
    expect(schema?.hint).toBe('Keep it under 280 characters.')
    // autocomplete="off" carries no signal, so it is dropped rather than sent.
    expect(schema?.autocomplete).toBeUndefined()
  })

  it('keeps a meaningful autocomplete token', () => {
    const fields = detect('<input autocomplete="email" aria-label="Email" />')
    expect(fields[0]?.schema.autocomplete).toBe('email')
  })

  it('records the section so repeated labels can be told apart', () => {
    const fields = detect(`
      <fieldset><legend>Education</legend>
        <label for="s1">Start date</label><input id="s1" />
      </fieldset>
      <fieldset><legend>Employment</legend>
        <label for="s2">Start date</label><input id="s2" />
      </fieldset>`)

    expect(fields.map((f) => f.schema.label)).toEqual(['Start date', 'Start date'])
    expect(fields.map((f) => f.schema.section)).toEqual(['Education', 'Employment'])
  })

  it('assigns unique ids within a pass', () => {
    const fields = detect('<input aria-label="A" /><input aria-label="B" />')
    const ids = fields.map((f) => f.schema.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('applyValue', () => {
  it('fills a text input', () => {
    const fields = detect('<input aria-label="Name" />')
    expect(adapter.applyValue(fields[0]!, 'Ada')).toBe(true)
    expect((fields[0]!.element as HTMLInputElement).value).toBe('Ada')
  })

  it('selects the right radio by option value', () => {
    const fields = detect(`
      <label><input type="radio" name="v" value="yes" />Yes</label>
      <label><input type="radio" name="v" value="no" />No</label>`)

    expect(adapter.applyValue(fields[0]!, 'no')).toBe(true)
    const [yes, no] = [...document.querySelectorAll<HTMLInputElement>('input')]
    expect(no!.checked).toBe(true)
    expect(yes!.checked).toBe(false)
  })

  it('selects a radio by its visible label', () => {
    const fields = detect(`
      <label><input type="radio" name="v" value="opt_1" />Yes</label>
      <label><input type="radio" name="v" value="opt_2" />No</label>`)

    expect(adapter.applyValue(fields[0]!, 'No')).toBe(true)
    expect(document.querySelectorAll<HTMLInputElement>('input')[1]!.checked).toBe(true)
  })

  it('checks several boxes for a multiselect answer', () => {
    const fields = detect(`
      <fieldset><legend>Languages</legend>
        <label><input type="checkbox" name="l" value="en" />English</label>
        <label><input type="checkbox" name="l" value="hi" />Hindi</label>
        <label><input type="checkbox" name="l" value="ta" />Tamil</label>
      </fieldset>`)

    expect(adapter.applyValue(fields[0]!, 'en, ta')).toBe(true)
    const boxes = [...document.querySelectorAll<HTMLInputElement>('input')]
    expect(boxes.map((b) => b.checked)).toEqual([true, false, true])
  })

  it('interprets an affirmative string for a lone checkbox', () => {
    const fields = detect('<label><input type="checkbox" name="tos" />I agree</label>')
    expect(adapter.applyValue(fields[0]!, 'Yes')).toBe(true)
    expect((fields[0]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('reports failure for an option that does not exist', () => {
    const fields = detect(`
      <select aria-label="Country"><option value="in">India</option></select>`)
    expect(adapter.applyValue(fields[0]!, 'Atlantis')).toBe(false)
  })
})

describe('detectPageForm', () => {
  it('returns null when there is nothing fillable', () => {
    document.body.innerHTML = '<p>Just an article.</p>'
    expect(detectPageForm(document, new URL('https://example.com/post'))).toBeNull()
  })

  it('sends origin and path but never the query string', () => {
    document.body.innerHTML = '<input aria-label="Email" />'
    const result = detectPageForm(
      document,
      // A query string is exactly where tracking ids and personal data hide.
      new URL('https://jobs.example.com/apply?token=secret&email=leak@example.com'),
    )

    expect(result?.form.origin).toBe('https://jobs.example.com')
    expect(result?.form.path).toBe('/apply')
    expect(JSON.stringify(result?.form)).not.toContain('secret')
    expect(JSON.stringify(result?.form)).not.toContain('leak@example.com')
  })

  it('builds a fieldId to element map covering every field', () => {
    document.body.innerHTML = '<input aria-label="A" /><textarea aria-label="B"></textarea>'
    const result = detectPageForm(document, new URL('https://example.com'))

    expect(result?.elements.size).toBe(result?.form.fields.length)
    for (const field of result?.form.fields ?? []) {
      expect(result?.elements.has(field.id)).toBe(true)
    }
  })

  it('collects page context for questions like "why this company"', () => {
    document.title = 'Senior Engineer at Acme'
    document.body.innerHTML = '<h1>Senior Engineer</h1><input aria-label="Name" />'
    const result = detectPageForm(document, new URL('https://acme.com/jobs/1'))

    expect(result?.form.pageContext).toContain('Senior Engineer')
  })
})

describe('resolveSection', () => {
  it('finds a preceding heading when there is no fieldset', () => {
    document.body.innerHTML = '<h2>References</h2><div><input id="x" /></div>'
    expect(resolveSection(document.getElementById('x')!)).toBe('References')
  })
})

describe('resolveLabel', () => {
  it('returns an empty string when a field has no identifying information', () => {
    document.body.innerHTML = '<input id="bare" />'
    expect(resolveLabel(document.getElementById('bare')!)).toBe('')
  })
})
