import { beforeEach, describe, expect, it } from 'vitest'
import { AtsAdapter } from './ats.js'
import { GoogleFormsAdapter } from './google-forms.js'
import { selectAdapter } from './index.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('adapter selection', () => {
  it.each([
    ['https://docs.google.com/forms/d/e/abc/viewform', 'google-forms'],
    ['https://boards.greenhouse.io/acme/jobs/1', 'ats-standard'],
    ['https://job-boards.greenhouse.io/acme/jobs/1', 'ats-standard'],
    ['https://jobs.lever.co/acme/abc', 'ats-standard'],
    ['https://jobs.ashbyhq.com/acme/abc', 'ats-standard'],
    ['https://example.com/careers/apply', 'generic'],
    // Google Docs is not Google Forms; the path check is what separates them.
    ['https://docs.google.com/document/d/abc', 'generic'],
  ])('routes %s to the %s adapter', (url, expected) => {
    expect(selectAdapter(new URL(url)).name).toBe(expected)
  })
})

/**
 * Google Forms renders its own widget layer: no `<form>`, and radios/checkboxes/dropdowns
 * are divs with ARIA roles. This fixture mirrors that structure.
 */
const GOOGLE_FORM = `
<div role="list">
  <div role="listitem">
    <div role="heading">What is your name? *</div>
    <div>Please use your legal name.</div>
    <input type="text" />
    <div aria-label="Required question"></div>
  </div>

  <div role="listitem">
    <div role="heading">Tell us about yourself</div>
    <textarea></textarea>
  </div>

  <div role="listitem">
    <div role="heading">Do you need sponsorship?</div>
    <div role="radio" data-value="Yes" aria-label="Yes"></div>
    <div role="radio" data-value="No" aria-label="No" aria-checked="false"></div>
  </div>

  <div role="listitem">
    <div role="heading">Which languages do you speak?</div>
    <div role="checkbox" data-value="English" aria-label="English"></div>
    <div role="checkbox" data-value="Hindi" aria-label="Hindi"></div>
    <div role="checkbox" data-value="Tamil" aria-label="Tamil"></div>
  </div>

  <div role="listitem">
    <div role="heading">Country</div>
    <div role="listbox">
      <div role="option" data-value="" aria-label="Choose"></div>
      <div role="option" data-value="India" aria-label="India"></div>
      <div role="option" data-value="United States" aria-label="United States"></div>
    </div>
  </div>

  <div role="listitem">
    <div role="heading">A section header with no answer widget</div>
  </div>
</div>`

describe('GoogleFormsAdapter', () => {
  const adapter = new GoogleFormsAdapter()

  function detect() {
    document.body.innerHTML = GOOGLE_FORM
    return adapter.detectForms(document)[0]?.fields ?? []
  }

  it('finds every question and skips the section header', () => {
    const fields = detect()
    expect(fields.map((f) => f.schema.label)).toEqual([
      'What is your name?',
      'Tell us about yourself',
      'Do you need sponsorship?',
      'Which languages do you speak?',
      'Country',
    ])
  })

  it('strips the required asterisk from the label', () => {
    // Left in, the model sometimes echoes the "*" back into its answer.
    const fields = detect()
    expect(fields[0]?.schema.label).toBe('What is your name?')
    expect(fields[0]?.schema.required).toBe(true)
  })

  it('captures the help text under a question', () => {
    expect(detect()[0]?.schema.hint).toBe('Please use your legal name.')
  })

  it('maps each widget onto the right behaviour', () => {
    expect(detect().map((f) => f.schema.kind)).toEqual([
      'text',
      'longtext',
      'radio',
      'multiselect',
      'select',
    ])
  })

  it('reads radio options from data-value and aria-label', () => {
    expect(detect()[2]?.schema.options).toEqual([
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ])
  })

  it('drops the "Choose" placeholder from a dropdown', () => {
    const options = detect()[4]?.schema.options ?? []
    expect(options.map((o) => o.value)).toEqual(['India', 'United States'])
  })

  it('exposes every option element so a click can target one', () => {
    expect(detect()[3]?.groupElements).toHaveLength(3)
  })

  it('selects a radio by clicking the matching div', async () => {
    const fields = detect()
    const radio = document.querySelectorAll<HTMLElement>('[role="radio"]')[1]!
    // Google flips aria-checked on click; simulate that so the return value is meaningful.
    radio.addEventListener('click', () => radio.setAttribute('aria-checked', 'true'))

    expect(await adapter.applyValue(fields[2]!, 'No')).toBe(true)
    expect(radio.getAttribute('aria-checked')).toBe('true')
  })

  it('toggles only the checkboxes whose state must change', async () => {
    const fields = detect()
    const boxes = [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')]
    const clicks: string[] = []
    for (const box of boxes) {
      box.addEventListener('click', () => clicks.push(box.getAttribute('data-value') ?? ''))
    }

    // Hindi is already checked, so asking for English + Hindi must not click Hindi off.
    boxes[1]?.setAttribute('aria-checked', 'true')
    await adapter.applyValue(fields[3]!, 'English, Hindi')

    expect(clicks).toEqual(['English'])
  })

  it('writes into a text input', async () => {
    const fields = detect()
    expect(await adapter.applyValue(fields[0]!, 'Mohith Kumar')).toBe(true)
    expect(document.querySelector<HTMLInputElement>('input')?.value).toBe('Mohith Kumar')
  })

  it('writes into a textarea', async () => {
    const fields = detect()
    await adapter.applyValue(fields[1]!, 'A long answer.')
    expect(document.querySelector('textarea')?.value).toBe('A long answer.')
  })
})

/**
 * react-select: the visible control is a div and the backing input has no writable value,
 * so it has to be driven the way a person drives it.
 */
const ATS_FORM = `
<form>
  <label for="name">Full name</label>
  <input id="name" name="name" />

  <label for="rs">Country</label>
  <div class="select__container">
    <div class="select__control">
      <input id="rs" role="combobox" />
      <div class="select__single-value">United Kingdom</div>
    </div>
    <div class="select__menu">
      <div class="select__option">India</div>
      <div class="select__option">United States</div>
      <div class="select__option">United Kingdom</div>
    </div>
  </div>
</form>`

describe('AtsAdapter', () => {
  const adapter = new AtsAdapter()

  function detect() {
    document.body.innerHTML = ATS_FORM
    return adapter.detectForms(document)[0]?.fields ?? []
  }

  it('still detects ordinary fields through the generic base', () => {
    expect(detect().some((f) => f.schema.label === 'Full name')).toBe(true)
  })

  it('re-marks a react-select as a choice field, not free text', () => {
    // Left as text, the model answers with prose the widget silently discards.
    const combobox = detect().find((f) => f.element.id === 'rs')
    expect(combobox?.schema.kind).toBe('select')
  })

  it('reads the currently selected value from the widget', () => {
    const combobox = detect().find((f) => f.element.id === 'rs')
    expect(combobox?.schema.currentValue).toBe('United Kingdom')
  })

  it('picks up options already rendered in the menu', () => {
    const combobox = detect().find((f) => f.element.id === 'rs')
    expect(combobox?.schema.options?.map((o) => o.value)).toEqual([
      'India',
      'United States',
      'United Kingdom',
    ])
  })

  it('types into the combobox so react-select filters its menu', async () => {
    const fields = detect()
    const combobox = fields.find((f) => f.element.id === 'rs')!
    const input = document.querySelector<HTMLInputElement>('#rs')!

    await adapter.applyValue(combobox, 'India')
    // Without the typed value react-select never narrows, and the right option may not
    // even be rendered on a long list.
    expect(input.value).toBe('India')
  })

  it('dispatches mousedown, which is what react-select actually listens for', async () => {
    const fields = detect()
    const combobox = fields.find((f) => f.element.id === 'rs')!
    const option = [...document.querySelectorAll('.select__option')].find(
      (o) => o.textContent === 'India',
    )!

    const events: string[] = []
    option.addEventListener('mousedown', () => events.push('mousedown'))
    option.addEventListener('click', () => events.push('click'))

    await adapter.applyValue(combobox, 'India')
    expect(events).toContain('mousedown')
  })

  it('prefers a prefix match over a substring one', async () => {
    document.body.innerHTML = `
      <div class="select__control"><input id="rs" role="combobox" /></div>
      <div class="select__menu">
        <div class="select__option">Emirates, United Arab</div>
        <div class="select__option">United States</div>
      </div>`

    const clicked: string[] = []
    for (const option of document.querySelectorAll('.select__option')) {
      option.addEventListener('mousedown', () => clicked.push(option.textContent ?? ''))
    }

    const fields = adapter.detectForms(document)[0]?.fields ?? []
    const combobox = fields.find((f) => f.element.id === 'rs')
    if (combobox) await adapter.applyValue(combobox, 'United')

    expect(clicked[0]).toBe('United States')
  })

  it('clears the typed text when nothing matches, leaving no half-filled combobox', async () => {
    const fields = detect()
    const combobox = fields.find((f) => f.element.id === 'rs')!
    const input = document.querySelector<HTMLInputElement>('#rs')!

    const applied = await adapter.applyValue(combobox, 'Atlantis')

    expect(applied).toBe(false)
    expect(input.value).toBe('')
  })
})

/**
 * Google Forms dropdowns.
 *
 * The previous implementation failed silently on real forms for three separate reasons, so
 * each gets its own test: it used a bare `.click()` where the widget listens for pointer
 * events, it never waited for the popup to open, and its "visible" filter matched
 * pre-rendered hidden options — clicking a dead node and reporting success.
 */
describe('GoogleFormsAdapter dropdowns', () => {
  const adapter = new GoogleFormsAdapter()

  /** A collapsed listbox whose options exist in the DOM but are not yet selectable. */
  function mountDropdown() {
    document.body.innerHTML = `
      <div role="listitem">
        <div role="heading">Country</div>
        <div role="listbox" aria-expanded="false">
          <div role="option" data-value="">Choose</div>
          <div role="option" data-value="in"><span>India</span></div>
          <div role="option" data-value="us"><span>United States</span></div>
        </div>
      </div>`

    const listbox = document.querySelector<HTMLElement>('[role="listbox"]')!
    // Open on mousedown, the way Google's widget does.
    listbox.addEventListener('mousedown', () => listbox.setAttribute('aria-expanded', 'true'))
    for (const option of document.querySelectorAll<HTMLElement>('[role="option"]')) {
      option.addEventListener('mousedown', () => {
        option.setAttribute('aria-selected', 'true')
        listbox.setAttribute('aria-expanded', 'false')
      })
    }

    const fields = adapter.detectForms(document)[0]?.fields ?? []
    return { field: fields[0]!, listbox }
  }

  it('opens the dropdown with pointer events, not a bare click', async () => {
    const { field, listbox } = mountDropdown()
    const seen: string[] = []
    listbox.addEventListener('pointerdown', () => seen.push('pointerdown'))
    listbox.addEventListener('mousedown', () => seen.push('mousedown'))

    await adapter.applyValue(field, 'India')
    expect(seen).toContain('mousedown')
  })

  it('selects by the visible label, which is what the model answers with', async () => {
    const { field } = mountDropdown()
    expect(await adapter.applyValue(field, 'India')).toBe(true)
    expect(document.querySelector('[data-value="in"]')?.getAttribute('aria-selected')).toBe('true')
  })

  it('selects by the underlying option value too', async () => {
    const { field } = mountDropdown()
    expect(await adapter.applyValue(field, 'us')).toBe(true)
    expect(document.querySelector('[data-value="us"]')?.getAttribute('aria-selected')).toBe('true')
  })

  it('matches case-insensitively', async () => {
    const { field } = mountDropdown()
    expect(await adapter.applyValue(field, 'united states')).toBe(true)
  })

  it('never picks an option while the listbox is still collapsed', async () => {
    // A pre-rendered option in a collapsed listbox is present but dead; clicking it does
    // nothing, and reporting success for it is how the old version lied.
    document.body.innerHTML = `
      <div role="listitem">
        <div role="heading">Country</div>
        <div role="listbox" aria-expanded="false">
          <div role="option" data-value="in">India</div>
        </div>
      </div>`
    const field = adapter.detectForms(document)[0]!.fields[0]!

    // No listener opens it, so it stays collapsed for the whole timeout.
    expect(await adapter.applyValue(field, 'India')).toBe(false)
  })

  it('reports failure and closes up when nothing matches', async () => {
    const { field, listbox } = mountDropdown()
    let escaped = false
    listbox.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') escaped = true
    })

    expect(await adapter.applyValue(field, 'Atlantis')).toBe(false)
    expect(escaped).toBe(true)
  })
})
