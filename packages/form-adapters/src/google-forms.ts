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

  /**
   * No heading, no question.
   *
   * This is the load-bearing check, and it is deliberately not about nesting. Google reuses
   * `role="listitem"` for the question *and* for each option row inside it, so a naive scan
   * finds an eight-option question as nine fields — the real one plus eight single-option
   * impostors that arrive with an empty label, cost a model call each, and show up in the
   * review as answers to no question.
   *
   * An earlier fix filtered by ancestry, which assumed a specific nesting depth and did not
   * survive contact with the real page. A heading is what actually distinguishes the two:
   * every question has one, no option row does. It is also the honest test — a field with no
   * label cannot be answered anyway, because the label is the entire question we send.
   */
  if (label === '') return null

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

    /**
     * Outermost list items only.
     *
     * Google wraps **each option row** in its own `[role="listitem"]` as well as the
     * question, so a plain `querySelectorAll` returns one node per question *plus* one per
     * option. Every option row contains a `[role="checkbox"]`, so each was detected as its
     * own single-option multiselect with an empty label — a ten-option question arrived as
     * eleven fields, ten of them unanswerable duplicates that still cost a model call and
     * still showed up in the review as answers to no question.
     */
    /**
     * Outermost list items first, then a claim check.
     *
     * Ancestry filtering is kept as a cheap first pass, but it is not trusted on its own —
     * see `detectQuestion`, where the heading check does the real work. The claim set below
     * is the final guarantee: once a control belongs to one question, no later question may
     * also own it, whatever the markup looks like. That holds for nesting we have not seen.
     */
    const items = [...container.querySelectorAll(QUESTION)].filter(
      (item) => item.parentElement?.closest(QUESTION) === null,
    )

    const claimed = new Set<Element>()
    const fields: DetectedField[] = []

    for (const item of items) {
      const field = detectQuestion(item)
      if (!field) continue

      const controls = field.groupElements ?? [field.element]
      if (controls.some((control) => claimed.has(control))) continue

      for (const control of controls) claimed.add(control)
      fields.push(field)
    }

    if (fields.length === 0) return []
    return [{ root: container, fields }]
  }

  async applyValue(field: DetectedField, value: string): Promise<boolean> {
    const { schema, element, groupElements } = field

    if (schema.kind === 'radio' && groupElements) {
      const target = matchOption(groupElements, value)
      if (!target) return false
      // `realClick`, not `.click()` — see its comment. These are divs, not inputs.
      realClick(target)
      return target.getAttribute('aria-checked') === 'true'
    }

    if (schema.kind === 'multiselect' && groupElements) {
      const wanted = value
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length > 0)
      let applied = false

      for (const option of groupElements) {
        /**
         * Matched on every key the option can be identified by, including its visible text.
         * This used to compare `data-value` and `aria-label` only, while the single-select
         * path already matched on text content — so a model answering with the words a
         * human reads selected radios correctly and silently checked nothing here.
         */
        const keys = optionKeys(option).map((k) => k.toLowerCase())
        const shouldCheck = wanted.some((w) => keys.includes(w))
        const isChecked = option.getAttribute('aria-checked') === 'true'

        // Clicking toggles, so only click when the state actually needs to change.
        if (shouldCheck !== isChecked) realClick(option)
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

/** Whether the environment lays anything out. Headless DOMs report no rects for anything. */
function hasLayout(): boolean {
  return document.body.getClientRects().length > 0
}

/**
 * Whether an option can actually be clicked.
 *
 * Google pre-renders every dropdown option inside the collapsed listbox, so presence in the
 * DOM says nothing. Three independent signals, because each covers a case the others miss:
 *
 *   - `aria-hidden` and computed style, which work with or without a layout engine.
 *   - The owning listbox reporting itself collapsed.
 *   - Geometry — but **only where layout exists**. Rects are empty for every node in a
 *     headless DOM, so testing them unconditionally would reject everything off-browser.
 */
function isVisible(node: HTMLElement): boolean {
  if (node.getAttribute('aria-hidden') === 'true') return false

  const style = node.ownerDocument.defaultView?.getComputedStyle(node)
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false

  if (node.closest('[role="listbox"]')?.getAttribute('aria-expanded') === 'false') return false

  if (hasLayout() && node.getClientRects().length === 0) return false

  return true
}

/** Polls a condition until it holds or the deadline passes. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return predicate()
}

/**
 * Opens a Google Forms dropdown and picks an option.
 *
 * Three things have to be verified rather than assumed, because each fails silently:
 *
 *   1. That the popup actually opened. A click on the wrong node does nothing at all, and
 *      every step after it then operates on the collapsed widget.
 *   2. That the option clicked is visible. Otherwise the pre-rendered copy is clicked and
 *      the page never hears about it.
 *   3. That the selection landed. The old check was `aria-expanded !== 'true'`, which is
 *      satisfied by the attribute being *absent* — the exact state of a dropdown that never
 *      opened. So the one case it needed to catch was the one case it reported as success.
 */
async function openAndSelect(listbox: HTMLElement, value: string): Promise<boolean> {
  const before = listbox.textContent ?? ''

  realClick(listbox)

  // Options render into an overlay that may live outside the listbox, so the popup is
  // detected by options becoming visible anywhere, not by an attribute on this node.
  const opened = await waitFor(
    () =>
      listbox.getAttribute('aria-expanded') === 'true' ||
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].some(isVisible),
    1500,
  )

  if (!opened) return false

  const option = matchOption(
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].filter(isVisible),
    value,
  )

  if (!option) {
    // Escape closes the popup; a second click can toggle it back open on some builds and
    // would leave the form visibly wrong.
    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    return false
  }

  const chosen = (option.textContent ?? '').replace(/\s+/g, ' ').trim()
  realClick(option)

  /**
   * Confirmed by what the widget now reads.
   *
   * `aria-selected` alone is not enough — Google sets it on the pre-rendered copy in some
   * builds without committing the choice. The listbox displaying the chosen label is the
   * state the user can see, which makes it the state worth asserting.
   */
  return waitFor(() => {
    if (option.getAttribute('aria-selected') === 'true') return true
    const now = (listbox.textContent ?? '').replace(/\s+/g, ' ').trim()
    return now !== before.replace(/\s+/g, ' ').trim() && chosen !== '' && now.includes(chosen)
  }, 1000)
}
