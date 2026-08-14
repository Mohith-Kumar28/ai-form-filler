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
/**
 * The question's description, or nothing.
 *
 * Google marks it with `aria-describedby` on the heading. The previous version scanned for
 * the first text-bearing node after the heading, which on a real form is the *first option*
 * — so every question got a fabricated hint: "Your answer", "Choose", "WhatsApp's own
 * personal chat", "Not Concerned". None of those are guidance, and handing one to the model
 * as if it were is actively harmful: on a 1-10 scale, "Not Concerned" is the low anchor, and
 * presenting it as a description biases the answer toward that end.
 *
 * A fabricated hint is worse than no hint, so anything not explicitly marked is discarded.
 */
function questionHint(item: Element): string {
  const heading = item.querySelector(HEADING)
  const describedBy = heading?.getAttribute('aria-describedby')
  if (!describedBy) return ''

  const parts: string[] = []
  for (const id of describedBy.split(/\s+/).filter(Boolean)) {
    const node = item.querySelector(`#${CSS.escape(id)}`)
    // Skip anything that is itself an answer widget or contains one.
    if (!node || node.querySelector('[role="radio"], [role="checkbox"], [role="option"]')) continue
    const text = textOf(node)
    // Google puts the required-marker node in `aria-describedby` too; "*" is not guidance.
    if (text && /[a-z0-9]/i.test(text) && text !== 'Your answer' && text !== 'Choose') {
      parts.push(text)
    }
  }

  return parts.join(' ').slice(0, 400)
}

/**
 * Turns option nodes into the choice list the model is offered.
 *
 * Falls back to the visible text: Google sets `data-value` on radios and dropdown options
 * but **not** on checkboxes, so keying only on it produced empty options for every
 * checkbox question.
 */
function optionsFrom(nodes: Element[]): FieldOption[] {
  return nodes
    .map((node) => {
      const keys = optionKeys(node as HTMLElement)
      const value = node.getAttribute('data-value') || keys[0] || ''
      const label = node.getAttribute('aria-label') || keys[keys.length - 1] || value
      // A trailing colon is Google's rendering of "Other:", not part of the answer.
      const clean = (text: string) => text.replace(/:\s*$/, '').trim()
      return { value: clean(value || label), label: clean(label || value) }
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

  /**
   * Any real input, not just text and email.
   *
   * The selector used to name two types, so date, time, number, tel and url questions
   * matched nothing, `detectQuestion` returned `null`, and the question never reached the
   * model at all — it simply was not in the form, with no skip and no explanation.
   */
  const input = item.querySelector<HTMLInputElement>(
    'input:not([type="hidden"]):not([type="file"]):not([aria-label*="Other" i])',
  )
  if (input) {
    const byType: Record<string, FieldKind> = {
      email: 'email',
      tel: 'tel',
      url: 'url',
      number: 'number',
      date: 'date',
    }
    const kind: FieldKind = byType[input.type] ?? 'text'
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

      // "Other" is only an answer once its companion box says what the other thing is.
      writeOtherText(target, value)

      /**
       * Verified by the keys of the node we matched, not by the model's raw string.
       *
       * `matchOption` deliberately falls back to a substring match, so "iPhone" selects
       * "iPhone (App Store)" — and comparing the answer back exactly then reported that
       * successful click as a failure. The node's own identity is what we clicked, so it is
       * what the check should look for.
       */
      const keys = optionKeys(target)
      const scope = scopeOf(target)
      // `realClick`, not `.click()` — see its comment. These are divs, not inputs.
      realClick(target)
      // Re-read from the DOM: the node just clicked may already have been replaced.
      return waitFor(() => isChosen(scope, 'radio', keys), 800)
    }

    if (schema.kind === 'multiselect' && groupElements) {
      /**
       * The whole answer is tried before splitting on commas.
       *
       * Option labels contain commas — this form has "Documents (PDFs, notes, etc.)" — and
       * splitting first shattered them into fragments that matched nothing, leaving the
       * option permanently unfillable. Worse, a fragment can match a *different* option
       * ("Yes" out of "Yes, I agree"), ticking the wrong box.
       */
      const asWhole = matchOption(groupElements, value)
      const wanted = asWhole
        ? [value.trim().toLowerCase()]
        : value
            .split(',')
            .map((v) => v.trim().toLowerCase())
            .filter((v) => v.length > 0)

      const scope = scopeOf(groupElements[0] ?? element)
      const chosenKeys: string[][] = []
      let applied = false

      for (const option of groupElements) {
        /**
         * Matched on every key the option can be identified by, including its visible text.
         * This used to compare `data-value` and `aria-label` only, while the single-select
         * path already matched on text content — so a model answering with the words a
         * human reads selected radios correctly and silently checked nothing here.
         */
        const keys = optionKeys(option).map((k) => k.toLowerCase())
        const shouldCheck = wanted.some((w) => keys.includes(w) || keys.some((k) => k === w))
        const isChecked = option.getAttribute('aria-checked') === 'true'

        // Clicking toggles, so only click when the state actually needs to change.
        if (shouldCheck !== isChecked) realClick(option)
        if (shouldCheck) {
          applied = true
          chosenKeys.push(optionKeys(option))
          writeOtherText(option, value)
        }
      }

      if (!applied) return false

      /**
       * Only what actually matched is verified.
       *
       * Requiring every requested token meant a partly-recognised answer ("Notion, Coda")
       * ticked Notion, then reported failure — leaving the page modified while the UI called
       * the field unfilled, and a retry would toggle Notion back off.
       */
      return waitFor(() => chosenKeys.every((keys) => isChosen(scope, 'checkbox', keys)), 800)
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

/**
 * Fills the free-text box that sits beside an "Other" choice.
 *
 * Google renders `Other:` as a checkbox or radio with a disabled input next to it, enabled
 * once the option is picked. Selecting it without writing anything leaves a checked-but-blank
 * answer, which Google rejects at submit for a required question — so the fill looks
 * successful and the form cannot be sent.
 */
function writeOtherText(option: HTMLElement, value: string): void {
  const keys = optionKeys(option).map((k) => k.toLowerCase().replace(/:\s*$/, ''))
  if (!keys.includes('other')) return

  /**
   * Scoped to the whole question, not the option's own row.
   *
   * Google wraps each option in its own `listitem`, so `closest` lands on that row — and the
   * companion text box is a sibling of the option *list*, one level further out.
   */
  const box = (scopeOf(option) as ParentNode).querySelector<HTMLInputElement>(
    'input[aria-label*="Other" i], input[type="text"]',
  )
  if (!box) return

  // Google disables the box until its option is picked; the click above has just enabled it.
  box.disabled = false

  // Whatever the model said, minus the word "other" itself — that is the label, not content.
  const text = value.replace(/^other\s*:?\s*/i, '').trim()
  if (text !== '') writeTextValue(box, text)
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

/** Whether an option is Google's free-text "Other" choice. */
function isOtherOption(node: HTMLElement): boolean {
  return optionKeys(node).some((k) => /^other:?$/i.test(k.trim()))
}

function matchOption(nodes: HTMLElement[], value: string): HTMLElement | undefined {
  const wanted = value.trim().toLowerCase()
  return (
    nodes.find((n) => optionKeys(n).includes(value.trim())) ??
    nodes.find((n) => optionKeys(n).some((k) => k.toLowerCase() === wanted)) ??
    // Trailing colons are Google's rendering of "Other:", not part of the answer.
    nodes.find((n) => optionKeys(n).some((k) => k.toLowerCase().replace(/:\s*$/, '') === wanted)) ??
    /**
     * "Other: a friend at the company" is one answer naming a choice *and* its free text.
     * The substring fallback below tests whether the option contains the answer, which is
     * the wrong way round for this shape and left every "Other" answer unmatched.
     */
    (/^other\b/i.test(wanted) ? nodes.find(isOtherOption) : undefined) ??
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

/**
 * Whether the widget now reports `value` as chosen — re-read from the DOM, not from a node.
 *
 * Google replaces these nodes when it re-renders after a selection, so a reference captured
 * before the click can be detached by the time we check it. Verifying through that reference
 * reports failure for a selection the user can plainly see on the page, which then shows up
 * as "answered but not accepted" on a field that is visibly filled.
 *
 * Searching by the option's own identity instead survives the node being swapped out.
 */
function isChosen(
  root: ParentNode,
  role: 'option' | 'radio' | 'checkbox',
  keys: string[],
): boolean {
  const flag = role === 'option' ? 'aria-selected' : 'aria-checked'
  const wanted = keys.map((key) => key.toLowerCase())

  return [...root.querySelectorAll<HTMLElement>(`[role="${role}"]`)].some(
    (node) =>
      node.getAttribute(flag) === 'true' &&
      optionKeys(node).some((key) => wanted.includes(key.toLowerCase())),
  )
}

/**
 * The question a control belongs to.
 *
 * Verification must be scoped to it. Searching the whole document asks only "is *some*
 * option with this label selected anywhere" — and Google forms routinely repeat labels
 * across questions (this fixture has "Screenshots and saved images" in two, and Yes/No in
 * many). Filling one question then satisfies the check for the next, so a question that
 * silently failed reports success. Our own successful fill arms it for the following one.
 */
function scopeOf(element: HTMLElement): ParentNode {
  // The **outermost** list item. Google wraps each option row in its own `listitem` inside
  // the question's, so `closest` alone lands on the single row we came from — scoping the
  // check to one option and hiding every sibling it needs to see.
  let scope = element.closest(QUESTION)
  for (let outer = scope?.parentElement?.closest(QUESTION); outer; ) {
    scope = outer
    outer = scope.parentElement?.closest(QUESTION) ?? null
  }
  return scope ?? element.ownerDocument
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
/** Whether the popup is up, by either the attribute or an option actually being on screen. */
/**
 * Options for *this* listbox.
 *
 * Google keeps them as children of the listbox. Scanning the document instead let one
 * dropdown's apply select an option belonging to a different question — and then confirm it.
 * The document fallback exists only for builds that portal the popup out of the listbox.
 */
function optionsOf(listbox: HTMLElement): HTMLElement[] {
  const own = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')]
  if (own.length > 0) return own
  return [...(listbox.ownerDocument ?? document).querySelectorAll<HTMLElement>('[role="option"]')]
}

function isOpen(listbox: HTMLElement): boolean {
  return listbox.getAttribute('aria-expanded') === 'true' || optionsOf(listbox).some(isVisible)
}

/**
 * Opens the popup, trying each route a real user has.
 *
 * Google wires the widget through `jsaction`, whose handlers are registered on a delegating
 * root rather than the node itself — `jsaction="click:cOuCgd(LgbsSe); mousedown:UX7yZ(...);
 * keydown:I481le"`. Which of those actually fires for a synthesised event depends on the
 * build, and a widget that ignores our mouse events is indistinguishable from one that
 * opened and had nothing in it, so guessing once and giving up is what left dropdowns blank.
 *
 * The keyboard path is not a fallback hack: `keydown:I481le` is Google's own handler, and
 * Enter and Down-arrow are how the widget is opened without a mouse.
 */
async function openDropdown(listbox: HTMLElement): Promise<boolean> {
  realClick(listbox)
  if (await waitFor(() => isOpen(listbox), 700)) return true

  // Some builds bind the handler to the inner presentation node named by the jsaction.
  const inner = listbox.querySelector<HTMLElement>('[jsname="LgbsSe"]')
  if (inner) {
    realClick(inner)
    if (await waitFor(() => isOpen(listbox), 700)) return true
  }

  listbox.focus()
  for (const key of ['Enter', 'ArrowDown']) {
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    listbox.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
    if (await waitFor(() => isOpen(listbox), 500)) return true
  }

  return false
}

async function openAndSelect(listbox: HTMLElement, value: string): Promise<boolean> {
  const opened = await openDropdown(listbox)

  if (!opened) {
    console.debug('[aff] dropdown did not open', {
      label: listbox.getAttribute('aria-labelledby'),
      expanded: listbox.getAttribute('aria-expanded'),
      disabled: listbox.getAttribute('aria-disabled'),
    })
    return false
  }

  const option = matchOption(optionsOf(listbox).filter(isVisible), value)

  if (!option) {
    console.debug('[aff] no dropdown option matched', {
      wanted: value,
      available: optionsOf(listbox)
        .filter(isVisible)
        .map((o) => o.getAttribute('data-value')),
    })
    // Escape closes the popup; a second click can toggle it back open on some builds and
    // would leave the form visibly wrong.
    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    return false
  }

  const chosenKeys = optionKeys(option)
  realClick(option)

  /**
   * Confirmed by which option the widget now reports as selected.
   *
   * Not by the listbox's text: Google keeps every option as a **child** of the listbox, so
   * its `textContent` is the whole option list concatenated. It reads the same before and
   * after a selection, which made an earlier version of this check unsatisfiable — a click
   * that worked perfectly still reported failure, and the field was then left alone.
   *
   * `aria-selected` moving to the clicked option is the state Google actually mutates, and
   * requiring it to be *this* option rules out the placeholder still holding the flag.
   */
  return waitFor(() => isChosen(listbox, 'option', chosenKeys), 1000)
}
