import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { GoogleFormsAdapter } from './google-forms.js'

/**
 * Detection against a real Google Form, saved verbatim.
 *
 * Every synthetic fixture in this suite was written from my own reading of Google's markup,
 * and twice that reading was wrong in the same direction — so the tests passed while the
 * product reported a eleven-question form as thirty-four fields. A saved page cannot agree
 * with a mistaken assumption, which is the entire reason it is here.
 *
 * The numbers below are the ones that matter: 35 `role="listitem"` nodes, 12 headings, and
 * exactly 11 answerable questions. Google reuses `listitem` for every option row, so any
 * approach that counts list items rather than headings fails this immediately.
 *
 * Scripts, stylesheets, and images were stripped when saving — nothing about detection reads
 * them, and leaving them makes the suite hit the network.
 */

// Resolved from the package root: happy-dom rewrites `import.meta.url` to a non-file scheme,
// so the usual URL-relative trick throws here.
const HTML = readFileSync(resolve(__dirname, '../fixtures/google-forms-waitlist.html'), 'utf8')

describe('a real Google Form', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = HTML
  })

  it('has far more list items than questions, which is the trap', () => {
    expect(document.querySelectorAll('[role="listitem"]').length).toBeGreaterThan(30)
    expect(document.querySelectorAll('[role="heading"]').length).toBeLessThan(15)
  })

  it('detects one field per question', () => {
    const fields = new GoogleFormsAdapter().detectForms(document)[0]?.fields ?? []
    expect(fields).toHaveLength(11)
  })

  it('gives every field a real question as its label', () => {
    const fields = new GoogleFormsAdapter().detectForms(document)[0]?.fields ?? []
    expect(fields.every((f) => f.schema.label.trim().length > 0)).toBe(true)
  })

  it('keeps a multi-option question whole instead of splitting it per option', () => {
    const fields = new GoogleFormsAdapter().detectForms(document)[0]?.fields ?? []
    const saved = fields.find((f) => f.schema.label.startsWith('Where do you currently save'))

    expect(saved?.schema.kind).toBe('multiselect')
    expect(saved?.schema.options).toHaveLength(8)
    // The eight options must not also exist as eight separate fields.
    expect(fields.filter((f) => (f.schema.options?.length ?? 0) === 1)).toHaveLength(0)
  })

  it('reads a 1-10 scale as one question with ten options', () => {
    const fields = new GoogleFormsAdapter().detectForms(document)[0]?.fields ?? []
    const scale = fields.find((f) => f.schema.label.includes('scale of 1 to 10'))

    expect(scale?.schema.kind).toBe('radio')
    expect(scale?.schema.options).toHaveLength(10)
  })

  it('classifies each widget as the right kind', () => {
    const fields = new GoogleFormsAdapter().detectForms(document)[0]?.fields ?? []
    const byLabel = new Map(fields.map((f) => [f.schema.label, f.schema.kind]))

    expect(byLabel.get('Phone number')).toBe('text')
    expect(byLabel.get('How did you hear about Memorie?')).toBe('select')
  })
})

describe('selecting from a real dropdown', () => {
  /**
   * Google keeps every option as a child of the listbox and flips `aria-selected` when one
   * is chosen — the listbox's own text is the concatenated option list and never changes.
   * This mirrors that exactly, which is what an invented fixture got wrong.
   */
  function wireGoogleBehaviour(listbox: HTMLElement) {
    listbox.setAttribute('aria-disabled', 'false')

    listbox.addEventListener('click', () => listbox.setAttribute('aria-expanded', 'true'))

    for (const option of listbox.querySelectorAll<HTMLElement>('[role="option"]')) {
      option.addEventListener('click', () => {
        for (const other of listbox.querySelectorAll('[role="option"]')) {
          other.setAttribute('aria-selected', 'false')
        }
        option.setAttribute('aria-selected', 'true')
        listbox.setAttribute('aria-expanded', 'false')
      })
    }
  }

  it('picks an option by its visible label', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.startsWith('How many things'))!

    expect(field.schema.kind).toBe('select')
    wireGoogleBehaviour(field.element)

    expect(await adapter.applyValue(field, '1 - 20')).toBe(true)
    expect(
      field.element.querySelector('[data-value="1 - 20"]')?.getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('does not report success when the widget never opens', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.startsWith('How many things'))!

    // Nothing wired: the listbox stays collapsed, exactly like a widget whose handler our
    // synthetic events fail to reach.
    expect(await adapter.applyValue(field, '1 - 20')).toBe(false)
  })

  it('leaves the placeholder alone rather than selecting "Choose"', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.startsWith('How many things'))!

    // "Choose" is dropped at detection; the model is never offered it as an answer.
    expect(field.schema.options?.some((o) => o.label === 'Choose')).toBe(false)
  })
})

describe('opening a dropdown that ignores mouse events', () => {
  /** A widget wired only to the keyboard — Google's `keydown:I481le` handler, nothing else. */
  function keyboardOnly(listbox: HTMLElement) {
    listbox.setAttribute('aria-disabled', 'false')
    listbox.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === 'ArrowDown') {
        listbox.setAttribute('aria-expanded', 'true')
      }
    })
    for (const option of listbox.querySelectorAll<HTMLElement>('[role="option"]')) {
      option.addEventListener('click', () => {
        for (const other of listbox.querySelectorAll('[role="option"]')) {
          other.setAttribute('aria-selected', 'false')
        }
        option.setAttribute('aria-selected', 'true')
      })
    }
  }

  it('falls through to the keyboard when clicking does nothing', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.startsWith('How did you hear'))!

    keyboardOnly(field.element)

    expect(await adapter.applyValue(field, 'Reddit')).toBe(true)
    expect(
      field.element.querySelector('[data-value="Reddit"]')?.getAttribute('aria-selected'),
    ).toBe('true')
  })
})

describe('a widget that re-renders when you choose', () => {
  /**
   * Google replaces option nodes after a selection. Verifying through the reference we
   * clicked therefore reports failure on a field the user can see is filled — which surfaced
   * as "answered but not accepted" next to a visibly-correct answer.
   */
  function rerenderOnChoose(listbox: HTMLElement) {
    listbox.setAttribute('aria-disabled', 'false')
    listbox.addEventListener('click', () => listbox.setAttribute('aria-expanded', 'true'))

    for (const option of [...listbox.querySelectorAll<HTMLElement>('[role="option"]')]) {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value') ?? ''
        // Swap the whole list for fresh nodes, exactly as a re-render would.
        for (const node of [...listbox.querySelectorAll('[role="option"]')]) {
          const fresh = node.cloneNode(true) as HTMLElement
          fresh.setAttribute(
            'aria-selected',
            fresh.getAttribute('data-value') === value ? 'true' : 'false',
          )
          node.replaceWith(fresh)
        }
        listbox.setAttribute('aria-expanded', 'false')
      })
    }
  }

  it('reports success when the selection landed on a replaced node', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.startsWith('How many things'))!

    rerenderOnChoose(field.element)

    expect(await adapter.applyValue(field, '100 +')).toBe(true)
    expect(field.element.querySelector('[data-value="100 +"]')?.getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('confirms a radio through the document, not the clicked node', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.includes('scale of 1 to 10'))!

    for (const radio of [...document.querySelectorAll<HTMLElement>('[role="radio"]')]) {
      radio.addEventListener('click', () => {
        const value = radio.getAttribute('data-value') ?? ''
        for (const node of [...document.querySelectorAll('[role="radio"]')]) {
          const fresh = node.cloneNode(true) as HTMLElement
          fresh.setAttribute(
            'aria-checked',
            fresh.getAttribute('data-value') === value ? 'true' : 'false',
          )
          node.replaceWith(fresh)
        }
      })
    }

    expect(await adapter.applyValue(field, '9')).toBe(true)
  })

  it('still reports failure when nothing was actually selected', async () => {
    document.documentElement.innerHTML = HTML
    const adapter = new GoogleFormsAdapter()
    const field = adapter
      .detectForms(document)[0]!
      .fields.find((f) => f.schema.label.startsWith('How many things'))!

    // Opens, but choosing does nothing — the failure this check exists to catch.
    field.element.setAttribute('aria-disabled', 'false')
    field.element.addEventListener('click', () =>
      field.element.setAttribute('aria-expanded', 'true'),
    )

    expect(await adapter.applyValue(field, '100 +')).toBe(false)
  })
})

describe('question hints', () => {
  it('invents no hint when the form has no descriptions', () => {
    document.documentElement.innerHTML = HTML
    const fields = new GoogleFormsAdapter().detectForms(document)[0]?.fields ?? []

    /**
     * None of this form's 11 questions has a description. The previous extractor returned
     * the first option instead — "Choose", "Not Concerned", "WhatsApp's own personal chat" —
     * handing the model an answer choice as if it were guidance.
     */
    const fabricated = fields.filter((f) => f.schema.hint)
    expect(fabricated.map((f) => `${f.schema.label} => ${f.schema.hint}`)).toEqual([])
  })
})

describe('question types that used to be dropped', () => {
  it('detects a date question', () => {
    document.body.innerHTML = `
      <div role="listitem">
        <div role="heading">When can you start?</div>
        <input type="date" />
      </div>`

    const field = new GoogleFormsAdapter().detectForms(document)[0]?.fields[0]
    expect(field?.schema.kind).toBe('date')
  })

  it('writes the companion box when the answer is "Other"', async () => {
    // A checked "Other:" with an empty box is rejected by Google at submit, so the fill
    // looks successful and the form cannot be sent.
    document.body.innerHTML = `
      <div role="listitem">
        <div role="heading">How did you hear about us?</div>
        <div role="list">
          <div role="listitem">
            <div role="radio" aria-checked="false" data-value="Other:" aria-label="Other:"></div>
          </div>
        </div>
        <input type="text" aria-label="Other response" />
      </div>`

    const adapter = new GoogleFormsAdapter()
    const field = adapter.detectForms(document)[0]!.fields[0]!
    for (const radio of document.querySelectorAll<HTMLElement>('[role="radio"]')) {
      radio.addEventListener('pointerdown', () => radio.setAttribute('aria-checked', 'true'))
    }

    await adapter.applyValue(field, 'Other: a friend at the company')

    expect(document.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe(
      'a friend at the company',
    )
  })
})
