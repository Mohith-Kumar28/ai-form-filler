import { beforeEach, describe, expect, it } from 'vitest'
import { AtsAdapter } from './ats.js'
import { GenericAdapter } from './generic.js'
import { GoogleFormsAdapter } from './google-forms.js'
import type { DetectedField } from './types.js'

/**
 * `readValue` — the half of the adapter contract that did not exist.
 *
 * Writing a widget was always the adapter's job; reading one back was a helper in the
 * extension that understood native controls only. It returned `null` for every ARIA widget on
 * Google Forms and read only the *first* control of a native radio group, so the learning loop
 * saw typed answers and nothing else: a phone number was learned, a dropdown never was.
 *
 * These tests are the guarantee that what an adapter can write, it can read — every one of
 * them fails against the old DOM-sniffing reader.
 */

beforeEach(() => {
  document.body.innerHTML = ''
})

function only(fields: DetectedField[], label: string): DetectedField {
  const field = fields.find((f) => f.schema.label === label)
  if (!field)
    throw new Error(
      `no field labelled "${label}" — got ${fields.map((f) => f.schema.label).join(', ')}`,
    )
  return field
}

describe('GenericAdapter.readValue', () => {
  const adapter = new GenericAdapter()

  function detect(html: string) {
    document.body.innerHTML = html
    return adapter.detectForms(document)[0]?.fields ?? []
  }

  it('reads the selected radio, not the first one', () => {
    // The bug in one line: reading `groupElements[0].checked` meant every answer other than
    // the first option read as "nothing selected", and was silently never learned.
    const fields = detect(`
      <fieldset>
        <legend>Which device do you use?</legend>
        <label><input type="radio" name="d" value="android" />Android</label>
        <label><input type="radio" name="d" value="ios" checked />iOS</label>
        <label><input type="radio" name="d" value="web" />Browser</label>
      </fieldset>`)

    expect(adapter.readValue(only(fields, 'Which device do you use?'))).toBe('iOS')
  })

  it('returns null when no radio in the group is selected', () => {
    const fields = detect(`
      <fieldset>
        <legend>Which device do you use?</legend>
        <label><input type="radio" name="d" value="ios" />iOS</label>
        <label><input type="radio" name="d" value="web" />Browser</label>
      </fieldset>`)

    expect(adapter.readValue(only(fields, 'Which device do you use?'))).toBeNull()
  })

  it('reads every box of a multi-select, not just one', () => {
    const fields = detect(`
      <fieldset>
        <legend>Which tools do you use?</legend>
        <label><input type="checkbox" name="t" value="notion" checked />Notion</label>
        <label><input type="checkbox" name="t" value="coda" />Coda</label>
        <label><input type="checkbox" name="t" value="linear" checked />Linear</label>
      </fieldset>`)

    expect(adapter.readValue(only(fields, 'Which tools do you use?'))).toBe('Notion, Linear')
  })

  it('reads a lone checkbox as intent, the same vocabulary applyValue accepts', () => {
    const fields = detect('<label><input type="checkbox" name="tos" checked />I agree</label>')
    expect(adapter.readValue(only(fields, 'I agree'))).toBe('yes')
  })

  it('reads the visible label of a select, not the opaque value', () => {
    // "opt_1" carries no meaning into a prompt; "United States" does.
    const fields = detect(`
      <label for="c">Country</label>
      <select id="c"><option value="opt_1" selected>United States</option></select>`)

    expect(adapter.readValue(only(fields, 'Country'))).toBe('United States')
  })

  it('treats a placeholder option as unanswered', () => {
    const fields = detect(`
      <label for="c">Country</label>
      <select id="c"><option value="" selected>Select one…</option><option value="in">India</option></select>`)

    expect(adapter.readValue(only(fields, 'Country'))).toBeNull()
  })

  it('reads text and textarea answers', () => {
    const fields = detect(`
      <label for="p">Phone</label><input id="p" value="+1 555 0100" />
      <label for="w">Why us?</label><textarea id="w">Because of the compiler work.</textarea>`)

    expect(adapter.readValue(only(fields, 'Phone'))).toBe('+1 555 0100')
    expect(adapter.readValue(only(fields, 'Why us?'))).toBe('Because of the compiler work.')
  })

  it('returns null for an empty field rather than an empty answer', () => {
    const fields = detect('<label for="p">Phone</label><input id="p" />')
    expect(adapter.readValue(only(fields, 'Phone'))).toBeNull()
  })
})

/**
 * Google renders divs with ARIA roles and no native inputs at all — the case the old reader
 * could not see. State lives in `aria-checked` / `aria-selected`.
 */
describe('GoogleFormsAdapter.readValue', () => {
  const adapter = new GoogleFormsAdapter()

  function detect(html: string) {
    document.body.innerHTML = html
    return adapter.detectForms(document)[0]?.fields ?? []
  }

  it('reads the chosen radio option', () => {
    const fields = detect(`
      <div role="listitem">
        <div role="heading">Which device do you use? *</div>
        <div role="radio" data-value="Android" aria-checked="false"><span>Android</span></div>
        <div role="radio" data-value="iOS" aria-checked="true"><span>iOS</span></div>
        <div role="radio" data-value="Browser" aria-checked="false"><span>Browser</span></div>
      </div>`)

    expect(adapter.readValue(only(fields, 'Which device do you use?'))).toBe('iOS')
  })

  it('reads every checked box of a multi-select', () => {
    const fields = detect(`
      <div role="listitem">
        <div role="heading">Which tools do you use?</div>
        <div role="checkbox" aria-label="Notion" aria-checked="true"></div>
        <div role="checkbox" aria-label="Coda" aria-checked="false"></div>
        <div role="checkbox" aria-label="Linear" aria-checked="true"></div>
      </div>`)

    expect(adapter.readValue(only(fields, 'Which tools do you use?'))).toBe('Notion, Linear')
  })

  it('reads the selected dropdown option and ignores the placeholder', () => {
    const fields = detect(`
      <div role="listitem">
        <div role="heading">Country</div>
        <div role="listbox" aria-expanded="false">
          <div role="option" data-value="Choose" aria-selected="false">Choose</div>
          <div role="option" data-value="India" aria-selected="true">India</div>
        </div>
      </div>`)

    expect(adapter.readValue(only(fields, 'Country'))).toBe('India')
  })

  it('treats a dropdown still showing "Choose" as unanswered', () => {
    const fields = detect(`
      <div role="listitem">
        <div role="heading">Country</div>
        <div role="listbox" aria-expanded="false">
          <div role="option" data-value="Choose" aria-selected="true">Choose</div>
          <div role="option" data-value="India" aria-selected="false">India</div>
        </div>
      </div>`)

    expect(adapter.readValue(only(fields, 'Country'))).toBeNull()
  })

  it('reads an "Other" choice as its typed text, in the shape applyValue parses back', () => {
    const fields = detect(`
      <div role="listitem">
        <div role="heading">How did you hear about us?</div>
        <div role="radio" data-value="Twitter" aria-checked="false"></div>
        <div role="radio" data-value="__other_option__" aria-label="Other:" aria-checked="true"></div>
        <input type="text" aria-label="Other response" value="a friend at the company" />
      </div>`)

    expect(adapter.readValue(only(fields, 'How did you hear about us?'))).toBe(
      'Other: a friend at the company',
    )
  })

  it('survives the option nodes being replaced after a selection', () => {
    // Google re-renders on choose, detaching the nodes captured at detection time. Reading
    // through `groupElements` would report nothing on a question the user can see is answered.
    const fields = detect(`
      <div role="listitem">
        <div role="heading">Which device do you use?</div>
        <div role="radio" data-value="iOS" aria-checked="false"></div>
      </div>`)
    const field = only(fields, 'Which device do you use?')

    const item = document.querySelector('[role="listitem"]') as HTMLElement
    item.querySelector('[role="radio"]')?.remove()
    const fresh = document.createElement('div')
    fresh.setAttribute('role', 'radio')
    fresh.setAttribute('data-value', 'iOS')
    fresh.setAttribute('aria-checked', 'true')
    item.append(fresh)

    expect(adapter.readValue(field)).toBe('iOS')
  })

  it('round-trips a multi-select whose labels contain commas', async () => {
    // Write two options, read them back, and get both — the loop that silently lost one.
    const features = [
      "AI-powered search (e.g., 'What was that red shoe I saved?')",
      'Smart reminders autoset based on your memories',
      'Link/image/doc scraping and summarisation',
    ]

    const fields = detect(`
      <div role="listitem">
        <div role="heading">Which feature of Memorie excites you the most?</div>
        ${features
          .map(
            (f) =>
              `<div role="checkbox" aria-label="${f.replace(/"/g, '&quot;')}" aria-checked="false"></div>`,
          )
          .join('\n')}
      </div>`)

    // Google's widgets toggle aria-checked on click; the real page does this, so the fixture must.
    for (const node of document.querySelectorAll<HTMLElement>('[role="checkbox"]')) {
      node.addEventListener('click', () =>
        node.setAttribute(
          'aria-checked',
          node.getAttribute('aria-checked') === 'true' ? 'false' : 'true',
        ),
      )
    }

    const field = only(fields, 'Which feature of Memorie excites you the most?')
    const applied = await adapter.applyValue(field, `${features[0]}, ${features[1]}`)

    expect(applied).toBe(true)
    expect(adapter.readValue(field)).toBe(`${features[0]}, ${features[1]}`)
  })

  it('reads a text answer', () => {
    const fields = detect(`
      <div role="listitem">
        <div role="heading">What is your name?</div>
        <input type="text" value="Ada Lovelace" />
      </div>`)

    expect(adapter.readValue(only(fields, 'What is your name?'))).toBe('Ada Lovelace')
  })
})

describe('AtsAdapter.readValue', () => {
  const adapter = new AtsAdapter()

  it('reads react-select from the value it displays, not its search input', () => {
    // The backing input holds the *search text*, which react-select clears after a selection —
    // so the generic reader saw "" on a field the user had plainly answered.
    document.body.innerHTML = `
      <div>
        <label for="s">Are you legally authorized to work?</label>
        <div class="select__control">
          <div class="select__single-value">Yes</div>
          <input id="s" role="combobox" class="select__input" value="" />
        </div>
      </div>`

    const fields = adapter.detectForms(document)[0]?.fields ?? []
    expect(adapter.readValue(only(fields, 'Are you legally authorized to work?'))).toBe('Yes')
  })

  it('falls back to the generic reader for an ordinary input', () => {
    document.body.innerHTML = '<label for="p">Phone</label><input id="p" value="+1 555 0100" />'
    const fields = adapter.detectForms(document)[0]?.fields ?? []
    expect(adapter.readValue(only(fields, 'Phone'))).toBe('+1 555 0100')
  })
})
