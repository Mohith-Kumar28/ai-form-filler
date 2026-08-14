import type { FieldSchema } from '@aff/shared'
import { baseSchema, GenericAdapter, nextId } from './generic.js'
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

/**
 * A react-select is identified by its **combobox input**, not by the wrapper class.
 *
 * `[class*="__control"]` matches ordinary BEM names — `field__control`, `form__control` —
 * which are common in ATS themes. Any plain text input inside one was re-typed as a choice
 * field with no options (so the model was asked for a constrained answer to a free-text
 * question) and then routed to the react-select driver, which found no combobox and left
 * the field empty.
 */
function isReactSelect(element: Element): boolean {
  if (element.matches(REACT_SELECT_INPUT)) return true
  const control = element.closest(REACT_SELECT_CONTROL)
  return control !== null && control.querySelector(REACT_SELECT_INPUT) !== null
}

export class AtsAdapter extends GenericAdapter {
  override readonly name = 'ats-standard'

  override matches(url: URL): boolean {
    return ATS_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  }

  override detectForms(root: Document | ShadowRoot): DetectedForm[] {
    const forms = super.detectForms(root)

    const isDocument = root.nodeType === 9
    const container = (isDocument ? (root as Document).body : root) as HTMLElement | null
    if (!container) return forms

    /**
     * Kept going even when the generic pass found nothing.
     *
     * Returning early on an empty result meant a page whose only controls are non-searchable
     * comboboxes — every one of them `readonly`, and so rejected by the generic scan — was
     * reported as having no form at all. The second pass below is the only thing that can
     * see them, so it has to run first-class rather than as a decoration on existing fields.
     */
    if (forms.length === 0) {
      forms.push({ root: container, fields: [] })
    }

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
      /**
       * A second pass for comboboxes the generic scan refuses.
       *
       * react-select with `isSearchable: false` renders a **readonly** input, and the
       * generic pass rejects `[readonly]` as unfillable — so those fields were not detected
       * at all. On Greenhouse they are exactly the required demographic and work-eligibility
       * dropdowns, and a required field the tool never sees is a form the user cannot submit.
       */
      const seen = new Set(form.fields.map((field) => field.element))

      for (const input of container.querySelectorAll<HTMLElement>(REACT_SELECT_INPUT)) {
        if (seen.has(input)) continue
        if (input.closest('fieldset[disabled], [inert]')) continue

        const control = input.closest(REACT_SELECT_CONTROL)
        const options = readPreloadedOptions(control)
        const current = readSelectedValue(control)

        form.fields.push({
          schema: {
            ...baseSchema(input, 'select', nextId('f')),
            ...(options.length > 0 ? { options } : {}),
            ...(current ? { currentValue: current } : {}),
          },
          element: input,
        })
      }
    }

    // A form that is still empty after both passes is not a form.
    return forms.filter((form) => form.fields.length > 0)
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

  /**
   * react-select keeps its committed choice in `__single-value` / `__multi-value` nodes, not
   * in the backing input — whose value is the *search text*, cleared after a selection. So the
   * generic reader saw an empty string on a field the user had plainly answered.
   *
   * This is the same state `driveReactSelect` verifies against, which keeps write and read
   * looking at one source of truth.
   */
  override readValue(field: DetectedField): string | null {
    if (!isReactSelect(field.element)) return super.readValue(field)

    const control = field.element.matches(REACT_SELECT_CONTROL)
      ? field.element
      : field.element.closest(REACT_SELECT_CONTROL)

    const shown = [
      ...(control?.querySelectorAll<HTMLElement>(
        '[class*="__single-value"], [class*="__multi-value"]',
      ) ?? []),
    ]
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean)

    return shown.length > 0 ? shown.join(', ') : null
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
  const chosen = option.textContent?.trim().toLowerCase() ?? ''

  option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  option.click()

  /**
   * Confirmed by the control displaying the choice.
   *
   * This used to `return true` the moment the click was dispatched, with no check at all —
   * so an inert or unresponsive widget reported every field as filled. react-select renders
   * the committed value into a `__single-value` / `__multi-value` node, which is the same
   * thing the user sees.
   */
  const control = input.closest(REACT_SELECT_CONTROL)
  const deadline = Date.now() + 1000

  while (Date.now() < deadline) {
    const shown = [
      ...(control?.querySelectorAll<HTMLElement>(
        '[class*="__single-value"], [class*="__multi-value"]',
      ) ?? []),
    ]
      .map((node) => node.textContent?.trim().toLowerCase() ?? '')
      .join(' ')

    if (chosen !== '' && shown.includes(chosen)) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return false
}

async function waitForOption(
  input: HTMLInputElement,
  value: string,
  timeoutMs = 1500,
): Promise<HTMLElement | null> {
  const wanted = value.trim().toLowerCase()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    /**
     * The menu is searched near the control first, then document-wide.
     *
     * react-select's `menuPortalTarget` renders the menu at the end of `<body>` to escape
     * overflow clipping — which Greenhouse's embedded forms use. Scoping only to the
     * control's parent meant portalled menus were never found, and every such field timed
     * out and was left blank.
     */
    const scoped = input.closest(REACT_SELECT_CONTROL)?.parentElement
    const options = [
      ...(scoped?.querySelectorAll<HTMLElement>(REACT_SELECT_OPTION) ?? []),
      ...input.ownerDocument.querySelectorAll<HTMLElement>(REACT_SELECT_OPTION),
    ].filter((node, index, all) => all.indexOf(node) === index)

    if (options.length > 0) {
      const exact = options.find((o) => o.textContent?.trim().toLowerCase() === wanted)
      if (exact) return exact

      // A prefix match beats a substring one: typing "United" should land on "United
      // States", not "Emirates, United Arab".
      const prefix = options.find((o) => o.textContent?.trim().toLowerCase().startsWith(wanted))
      if (prefix) return prefix

      /**
       * Every word of the answer must appear in the option.
       *
       * The previous rule took the sole rendered option whenever the query was 3+ characters
       * — but a menu holds one option while it is still filtering or loading, so answering
       * "United States" against a list showing only "Afghanistan" selected Afghanistan and
       * reported success. A wrong country on a job application, silently.
       */
      const words = wanted.split(/\s+/).filter((w) => w.length > 2)
      if (words.length > 0) {
        const contains = options.find((o) => {
          const text = o.textContent?.trim().toLowerCase() ?? ''
          return words.every((word) => text.includes(word))
        })
        if (contains) return contains
      }
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
