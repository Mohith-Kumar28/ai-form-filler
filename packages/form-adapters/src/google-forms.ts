import type { FieldKind, FieldOption, FieldSchema } from '@aff/shared'
import type { DetectedField, DetectedForm, FormAdapter } from './types.js'
import { writeTextValue } from './write.js'

/**
 * Google Forms.
 *
 * There is no `<form>` element and almost no native inputs — Google renders its own widget
 * layer, so the generic adapter finds a handful of stray text inputs and misses every radio,
 * checkbox, and dropdown. Everything here works off ARIA roles instead, which are both
 * semantically correct and far more stable than Google's generated class names.
 *
 * Roles used:
 *   [role="listitem"]  one question
 *   [role="heading"]   the question text
 *   [role="radio"]     a radio option (a div, not an input)
 *   [role="checkbox"]  a checkbox option
 *   [role="listbox"]   a dropdown, which must be opened before its options exist
 */

const QUESTION = '[role="listitem"]'
const HEADING = '[role="heading"]'

/** Google marks required questions with a visually-hidden asterisk carrying this label. */
const REQUIRED_MARKER = '[aria-label*="Required"], .vnumgf'

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `g${idCounter}`
}

function textOf(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

/**
 * The question text, minus the trailing "*" Google appends to required questions.
 * Leaving it in would send the model a label ending in an asterisk, which it sometimes
 * echoes back into the answer.
 */
function questionLabel(item: Element): string {
  const heading = textOf(item.querySelector(HEADING))
  return heading.replace(/\s*\*$/, '')
}

/**
 * Help text — the description Google renders under a question.
 *
 * Found by scanning the question's elements in document order for the first text-bearing
 * node after the heading that contains no widget. Walking a fixed number of levels from
 * the heading (`parentElement.nextElementSibling`) would encode Google's current nesting
 * depth, which is generated markup and changes without notice.
 */
function questionHint(item: Element): string {
  const elements = [...item.querySelectorAll('*')]
  const headingIndex = elements.findIndex((el) => el.matches(HEADING))
  if (headingIndex === -1) return ''

  const heading = elements[headingIndex]

  for (const candidate of elements.slice(headingIndex + 1)) {
    // Skip anything still inside the heading — its own child nodes come next in this list.
    if (heading?.contains(candidate)) continue

    // A node wrapping a widget is layout, not prose.
    if (candidate.querySelector('input, textarea, [role]')) continue
    if (candidate.matches('input, textarea, [role]')) continue

    const text = textOf(candidate)
    if (text.length > 0 && text.length < 400) return text
  }

  return ''
}

function optionsFrom(nodes: Element[]): FieldOption[] {
  return nodes
    .map((node) => {
      // `data-value` is the value Google submits; aria-label is what the user reads. They
      // usually match, but on "Other" options they do not.
      const value = node.getAttribute('data-value') ?? node.getAttribute('aria-label') ?? ''
      const label = node.getAttribute('aria-label') ?? value
      return { value: value || label, label: label || value }
    })
    .filter((option) => option.value !== '')
}

function detectQuestion(item: Element): DetectedField | null {
  const label = questionLabel(item)
  const hint = questionHint(item)
  const required = item.querySelector(REQUIRED_MARKER) !== null

  const base = {
    id: nextId(),
    label,
    required,
    ...(hint ? { hint } : {}),
  }

  const radios = [...item.querySelectorAll('[role="radio"]')]
  if (radios.length > 0) {
    const checked = radios.find((r) => r.getAttribute('aria-checked') === 'true')
    const schema: FieldSchema = {
      ...base,
      kind: 'radio',
      options: optionsFrom(radios),
      ...(checked ? { currentValue: checked.getAttribute('data-value') ?? '' } : {}),
    }
    return {
      schema,
      element: radios[0] as HTMLElement,
      groupElements: radios as HTMLElement[],
    }
  }

  const checkboxes = [...item.querySelectorAll('[role="checkbox"]')]
  if (checkboxes.length > 0) {
    const checked = checkboxes.filter((c) => c.getAttribute('aria-checked') === 'true')
    const schema: FieldSchema = {
      ...base,
      // A single checkbox in Google Forms is still part of a checkbox *grid* question far
      // more often than it is a yes/no, so multiselect is the safer reading.
      kind: 'multiselect',
      options: optionsFrom(checkboxes),
      ...(checked.length > 0
        ? { currentValue: checked.map((c) => c.getAttribute('data-value') ?? '').join(', ') }
        : {}),
    }
    return {
      schema,
      element: checkboxes[0] as HTMLElement,
      groupElements: checkboxes as HTMLElement[],
    }
  }

  const listbox = item.querySelector('[role="listbox"]')
  if (listbox) {
    // Options only exist in the DOM once the dropdown has been opened, so they are read
    // from the pre-rendered hidden option nodes Google keeps inside the listbox.
    const options = optionsFrom([...listbox.querySelectorAll('[role="option"]')])
    const schema: FieldSchema = {
      ...base,
      kind: 'select',
      options: options.filter((o) => o.label !== 'Choose'),
    }
    return { schema, element: listbox as HTMLElement }
  }

  const textarea = item.querySelector('textarea')
  if (textarea) {
    const schema: FieldSchema = {
      ...base,
      kind: 'longtext',
      ...(textarea.value ? { currentValue: textarea.value } : {}),
    }
    return { schema, element: textarea }
  }

  const input = item.querySelector<HTMLInputElement>('input[type="text"], input[type="email"]')
  if (input) {
    const kind: FieldKind = input.type === 'email' ? 'email' : 'text'
    const schema: FieldSchema = {
      ...base,
      kind,
      ...(input.value ? { currentValue: input.value } : {}),
    }
    return { schema, element: input }
  }

  // A section header or image block — a listitem with no answer widget.
  return null
}

export class GoogleFormsAdapter implements FormAdapter {
  readonly name = 'google-forms'

  matches(url: URL): boolean {
    return url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')
  }

  detectForms(root: Document | ShadowRoot): DetectedForm[] {
    idCounter = 0

    const isDocument = root.nodeType === 9
    const container = (isDocument ? (root as Document).body : root) as HTMLElement | null
    if (!container) return []

    const fields: DetectedField[] = []
    for (const item of container.querySelectorAll(QUESTION)) {
      const field = detectQuestion(item)
      if (field) fields.push(field)
    }

    if (fields.length === 0) return []
    return [{ root: container, fields }]
  }

  async applyValue(field: DetectedField, value: string): Promise<boolean> {
    const { schema, element, groupElements } = field

    if (schema.kind === 'radio' && groupElements) {
      const target = matchOption(groupElements, value)
      if (!target) return false
      target.click()
      return target.getAttribute('aria-checked') === 'true'
    }

    if (schema.kind === 'multiselect' && groupElements) {
      const wanted = value.split(',').map((v) => v.trim().toLowerCase())
      let applied = false

      for (const option of groupElements) {
        const optionValue = (option.getAttribute('data-value') ?? '').toLowerCase()
        const optionLabel = (option.getAttribute('aria-label') ?? '').toLowerCase()
        const shouldCheck = wanted.some((w) => w === optionValue || w === optionLabel)
        const isChecked = option.getAttribute('aria-checked') === 'true'

        // Clicking toggles, so only click when the state actually needs to change.
        if (shouldCheck !== isChecked) option.click()
        if (shouldCheck) applied = true
      }
      return applied
    }

    if (schema.kind === 'select') {
      return openAndSelect(element, value)
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return writeTextValue(element, value)
    }

    return false
  }
}

/** Every string an option might legitimately be identified by. */
function optionKeys(node: HTMLElement): string[] {
  return [
    node.getAttribute('data-value') ?? '',
    node.getAttribute('aria-label') ?? '',
    // Google renders the visible label in a child span, and the model answers with what a
    // human reads — so text content has to be a first-class match, not an afterthought.
    node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  ].filter((key) => key.length > 0)
}

function matchOption(nodes: HTMLElement[], value: string): HTMLElement | undefined {
  const wanted = value.trim().toLowerCase()
  return (
    nodes.find((n) => optionKeys(n).includes(value.trim())) ??
    nodes.find((n) => optionKeys(n).some((k) => k.toLowerCase() === wanted)) ??
    // Last resort, and only when the query is specific enough to have narrowed meaningfully.
    (wanted.length > 2
      ? nodes.find((n) => optionKeys(n).some((k) => k.toLowerCase().includes(wanted)))
      : undefined)
  )
}

/**
 * Google's widgets are div-based and listen for **pointer and mouse events**, not a bare
 * `.click()`. Dispatching the full sequence is what a real click does; calling `click()`
 * alone frequently does nothing at all, which is why the previous version silently failed.
 */
function realClick(node: HTMLElement): void {
  const opts = { bubbles: true, cancelable: true, view: window }
  node.dispatchEvent(new PointerEvent('pointerdown', opts))
  node.dispatchEvent(new MouseEvent('mousedown', opts))
  node.dispatchEvent(new PointerEvent('pointerup', opts))
  node.dispatchEvent(new MouseEvent('mouseup', opts))
  node.click()
}

/** Options only become selectable once the popup is really open. */
function isSelectable(node: HTMLElement): boolean {
  if (node.getAttribute('aria-hidden') === 'true') return false
  // A pre-rendered option inside a collapsed listbox is present but not clickable; its
  // closest listbox reports itself collapsed.
  const owner = node.closest('[role="listbox"]')
  if (owner?.getAttribute('aria-expanded') === 'false') return false
  return true
}

/**
 * Opens a Google Forms dropdown and picks an option.
 *
 * Three things the previous version got wrong: it used `.click()` where the widget needs
 * pointer events, it never waited for the popup to actually open, and its "visible" filter
 * matched pre-rendered hidden options — so it would click a dead node and report success.
 */
async function openAndSelect(listbox: HTMLElement, value: string): Promise<boolean> {
  realClick(listbox)

  const deadline = Date.now() + 1500
  let option: HTMLElement | undefined

  while (Date.now() < deadline) {
    const candidates = [...document.querySelectorAll<HTMLElement>('[role="option"]')].filter(
      isSelectable,
    )
    option = matchOption(candidates, value)
    if (option) break
    await new Promise((resolve) => setTimeout(resolve, 60))
  }

  if (!option) {
    // Escape closes the popup; a second click can toggle it back open on some builds and
    // would leave the form visibly wrong.
    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    return false
  }

  realClick(option)

  // Confirm rather than assume: the widget marks the chosen option, and reporting a
  // success the page did not accept is worse than reporting the failure.
  await new Promise((resolve) => setTimeout(resolve, 60))
  return (
    option.getAttribute('aria-selected') === 'true' ||
    listbox.getAttribute('aria-expanded') !== 'true'
  )
}
