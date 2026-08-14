import type { FieldSchema } from '@aff/shared'
import { GenericAdapter } from './generic.js'
import { resolveLabel } from './label.js'
import type { DetectedField, DetectedForm } from './types.js'

/**
 * Greenhouse, Lever, and Ashby.
 *
 * These are mostly standard HTML, so this extends the generic adapter rather than replacing
 * it. What it adds is the one control the generic path genuinely cannot handle:
 * **react-select**, whose visible combobox is a div and whose backing input has no writable
 * value. Setting that input does nothing; the widget has to be driven the way a person
 * drives it — focus, type, wait for the menu, click the option.
 */

const ATS_HOSTS = [
  'greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'ashbyhq.com',
  'jobs.ashbyhq.com',
]

/**
 * react-select renders a `.<prefix>__control` wrapper containing a combobox input. The
 * class prefix is configurable, so match on the structural suffix rather than a fixed name.
 */
const REACT_SELECT_CONTROL = '[class*="__control"]'
const REACT_SELECT_INPUT = 'input[role="combobox"], input[id^="react-select"]'
const REACT_SELECT_MENU = '[class*="__menu"]'
const REACT_SELECT_OPTION = '[class*="__option"]'

function isReactSelect(element: Element): boolean {
  return element.closest(REACT_SELECT_CONTROL) !== null
}

export class AtsAdapter extends GenericAdapter {
  override readonly name = 'ats-standard'

  override matches(url: URL): boolean {
    return ATS_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  }

  override detectForms(root: Document | ShadowRoot): DetectedForm[] {
    const forms = super.detectForms(root)
    if (forms.length === 0) return forms

    const isDocument = root.nodeType === 9
    const container = (isDocument ? (root as Document).body : root) as HTMLElement | null
    if (!container) return forms

    for (const form of forms) {
      // The generic pass sees react-select's backing input as a plain text field, which
      // would make the model answer it with free text that the widget then discards.
      // Re-mark those as selects so they route to tier 1 and get a constrained answer.
      for (const field of form.fields) {
        if (!isReactSelect(field.element)) continue

        const control = field.element.closest(REACT_SELECT_CONTROL)
        const options = readPreloadedOptions(control)

        field.schema = {
          ...field.schema,
          kind: 'select',
          // Options are only in the DOM once the menu opens, so this is often empty. The
          // model then answers with a plain label, which `applyValue` matches by text.
          ...(options.length > 0 ? { options } : {}),
          ...(readSelectedValue(control) ? { currentValue: readSelectedValue(control) } : {}),
        } satisfies FieldSchema
      }
    }

    return forms
  }

  override async applyValue(field: DetectedField, value: string): Promise<boolean> {
    if (!isReactSelect(field.element)) {
      return super.applyValue(field, value)
    }

    const input = field.element.matches(REACT_SELECT_INPUT)
      ? (field.element as HTMLInputElement)
      : field.element
          .closest(REACT_SELECT_CONTROL)
          ?.querySelector<HTMLInputElement>(REACT_SELECT_INPUT)

    if (!input) return false
    return driveReactSelect(input, value)
  }
}

/** The label of the currently-selected option, if the widget already has one. */
function readSelectedValue(control: Element | null): string {
  const singleValue = control?.querySelector('[class*="__single-value"]')
  return singleValue?.textContent?.trim() ?? ''
}

/** Options are usually absent until the menu opens; read any that happen to be present. */
function readPreloadedOptions(control: Element | null): { value: string; label: string }[] {
  const menu = control?.parentElement?.querySelector(REACT_SELECT_MENU)
  if (!menu) return []

  return [...menu.querySelectorAll(REACT_SELECT_OPTION)]
    .map((node) => {
      const label = node.textContent?.trim() ?? ''
      return { value: label, label }
    })
    .filter((option) => option.label !== '')
}

/**
 * Drives a react-select the way a person does.
 *
 * Typing is what makes this work: react-select filters its menu on the input's value, so
 * without it the menu can hold hundreds of options and the right one may not even be
 * rendered. Each keystroke must go through the native setter, or React reverts it — the
 * same technique the generic writer uses, for the same reason.
 */
async function driveReactSelect(input: HTMLInputElement, value: string): Promise<boolean> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!setter) return false

  input.focus()
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))

  const option = await waitForOption(input, value)

  if (!option) {
    // Clear the typed text so a failed attempt leaves no half-filled combobox behind.
    setter.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.blur()
    return false
  }

  // A real click, not `.click()` on the option element alone: react-select listens for
  // mousedown, and a plain click event does not always trigger selection.
  option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  option.click()

  return true
}

async function waitForOption(
  input: HTMLInputElement,
  value: string,
  timeoutMs = 1500,
): Promise<HTMLElement | null> {
  const wanted = value.trim().toLowerCase()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const root = input.closest(REACT_SELECT_CONTROL)?.parentElement ?? document
    const options = [...root.querySelectorAll<HTMLElement>(REACT_SELECT_OPTION)]

    if (options.length > 0) {
      const exact = options.find((o) => o.textContent?.trim().toLowerCase() === wanted)
      if (exact) return exact

      // A prefix match beats a substring one: typing "United" should land on "United
      // States", not "Emirates, United Arab".
      const prefix = options.find((o) => o.textContent?.trim().toLowerCase().startsWith(wanted))
      if (prefix) return prefix

      // Only fall back to the first filtered option when the query was specific enough to
      // have meaningfully narrowed the list.
      if (wanted.length >= 3 && options.length === 1) return options[0] ?? null
    }

    await new Promise((resolve) => setTimeout(resolve, 60))
  }

  return null
}

/** Exported for the label fallback used when a react-select has no visible label. */
export function reactSelectLabel(element: Element): string {
  const control = element.closest(REACT_SELECT_CONTROL)
  return control ? resolveLabel(control) : ''
}
