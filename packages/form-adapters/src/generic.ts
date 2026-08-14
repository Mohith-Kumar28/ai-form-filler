import type { FieldKind, FieldOption, FieldSchema } from '@aff/shared'
import { resolveHint, resolveLabel, resolveSection } from './label.js'
import type { DetectedField, DetectedForm, FormAdapter } from './types.js'
import {
  writeCheckedValue,
  writeContentEditable,
  writeSelectValue,
  writeTextValue,
} from './write.js'

/**
 * Input types we never touch.
 *
 * Passwords and payment fields are excluded on principle — an autofiller that types into a
 * password box is a security incident waiting to happen, and we have no business knowing a
 * card number. The rest are structural (buttons, hidden state) rather than user input.
 */
const SKIPPED_INPUT_TYPES = new Set([
  'password',
  'hidden',
  'submit',
  'reset',
  'button',
  'image',
  'range',
  'color',
])

const SENSITIVE_NAME =
  /pass(word|code)|\bcvv\b|\bcvc\b|card.?number|security.?code|\bssn\b|social.?security/i

const TYPE_TO_KIND: Record<string, FieldKind> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  number: 'number',
  date: 'date',
  'datetime-local': 'date',
  month: 'date',
  week: 'date',
  file: 'file',
  text: 'text',
  search: 'text',
}

let idCounter = 0
/** Ids only need to be unique within one detection pass — the map is rebuilt each time. */
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}${idCounter}`
}

export function resetIdCounter(): void {
  idCounter = 0
}

/**
 * Whether this document actually performs layout.
 *
 * Headless DOMs (happy-dom, jsdom) return a zero rect for *every* element, so geometry is
 * meaningless there. Computed style is checked first precisely because it is the one signal
 * that behaves identically headless and in a real browser — geometry is then applied only
 * as an extra filter where it means something.
 */
function documentHasLayout(doc: Document): boolean {
  return doc.body.getBoundingClientRect().height > 0
}

function isVisible(el: HTMLElement, hasLayout: boolean): boolean {
  if (el.hidden || el.closest('[hidden]')) return false

  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  if (style) {
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }

  // Only trust geometry where geometry exists. A 0×0 box in a real browser is how component
  // libraries hide the native input behind a custom widget.
  if (hasLayout) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return false
  }

  return true
}

function isFillable(el: HTMLElement, hasLayout: boolean): boolean {
  if (!isVisible(el, hasLayout)) return false

  /**
   * Disabled is a **property**, not just an attribute.
   *
   * A control inside `<fieldset disabled>` has `el.disabled === true` and no attribute of
   * its own, so an attribute-only test detected it, wrote to it, and reported success — and
   * the browser then dropped the value at submit. The user saw text sitting in a greyed-out
   * box and a form that failed validation with no explanation.
   */
  const control = el as HTMLInputElement
  if (control.disabled === true) return false
  if (el.closest('fieldset[disabled], [inert]')) return false
  if (el.matches('[readonly], [disabled], [aria-hidden="true"], [aria-disabled="true"]')) {
    return false
  }

  const name = `${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''} ${el.getAttribute('autocomplete') ?? ''}`
  if (SENSITIVE_NAME.test(name)) return false

  return true
}

function optionsOf(select: HTMLSelectElement): FieldOption[] {
  return (
    [...select.options]
      // An empty value marks a placeholder ("Select one…"), not a real choice. Offering it
      // to the model invites it to "answer" by selecting nothing.
      // Safe because an <option> with no value attribute reports its text as `value`.
      .filter((o) => o.value !== '')
      .map((o) => ({ value: o.value, label: o.text.trim() }))
  )
}

/** Strings a model plausibly returns for a yes/no checkbox. */
const AFFIRMATIVE = /^(yes|true|on|1|checked|agree(d)?|i agree|accept(ed)?|confirm(ed)?)$/i
const NEGATIVE = /^(no|false|off|0|unchecked|decline(d)?|n\/?a|none|not applicable)$/i

/**
 * What a yes/no answer means, or `null` when it means nothing we recognise.
 *
 * A lone checkbox used to be written as `AFFIRMATIVE.test(value)`, so "N/A", "United
 * States", or any hallucinated answer became a silent "leave unchecked" **reported as a
 * success**. That makes a wrong answer indistinguishable from a deliberate one, both in the
 * UI and in the fill log. Returning `null` lets the caller report the failure honestly.
 */
function readIntent(value: string): boolean | null {
  const trimmed = value.trim()
  if (AFFIRMATIVE.test(trimmed)) return true
  if (NEGATIVE.test(trimmed)) return false
  return null
}

export function baseSchema(el: HTMLElement, kind: FieldKind, id: string): FieldSchema {
  const label = resolveLabel(el)
  const hint = resolveHint(el)
  const section = resolveSection(el)
  const placeholder = el.getAttribute('placeholder') ?? ''
  const autocomplete = el.getAttribute('autocomplete') ?? ''
  const maxLength = Number(el.getAttribute('maxlength'))

  return {
    id,
    kind,
    label,
    ...(hint ? { hint } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(section && section !== label ? { section } : {}),
    ...(autocomplete && autocomplete !== 'off' ? { autocomplete } : {}),
    ...(Number.isFinite(maxLength) && maxLength > 0 ? { maxLength } : {}),
    required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
  }
}

/**
 * Radios and checkboxes sharing a `name` are one logical question, not N fields.
 *
 * The key includes the owning form, because `name` scoping in HTML is **per-form**: two
 * forms on one page each with `name="choice"` were merged into a single field carrying all
 * four options and two duplicate labels, the second question vanished entirely, and applying
 * an answer checked a radio in *both* forms.
 */
function groupControls(root: ParentNode, hasLayout: boolean): Map<string, HTMLInputElement[]> {
  const groups = new Map<string, HTMLInputElement[]>()
  const formKeys = new WeakMap<HTMLFormElement, string>()
  let formCounter = 0

  for (const el of root.querySelectorAll<HTMLInputElement>(
    'input[type="radio"], input[type="checkbox"]',
  )) {
    if (!isFillable(el, hasLayout)) continue

    const form = el.form
    let scope = 'no-form'
    if (form) {
      const existingKey = formKeys.get(form)
      if (existingKey) scope = existingKey
      else {
        formCounter += 1
        scope = `form${formCounter}`
        formKeys.set(form, scope)
      }
    }

    // Ungrouped controls get a synthetic key so a lone checkbox is still its own field.
    const key = el.name ? `${scope}::${el.name}` : `__ungrouped__${el.id || nextId('c')}`
    const existing = groups.get(key)
    if (existing) existing.push(el)
    else groups.set(key, [el])
  }
  return groups
}

/** The question text for a group, taken from its fieldset legend rather than one option's label. */
function groupLabel(controls: HTMLInputElement[]): string {
  const first = controls[0]
  if (!first) return ''

  // A lone control's own label *is* the question ("I agree to the terms"). With several
  // controls those same labels are the options ("Yes" / "No"), and the question lives on
  // the enclosing group — so this shortcut must not apply to them.
  if (controls.length === 1) {
    const own = resolveLabel(first)
    if (own) return own
  }

  // One `closest` call over all the container kinds, so the *nearest* labelled ancestor
  // wins. Checking fieldsets first instead would caption a `[role=radiogroup]` with the
  // enclosing section heading ("Eligibility") rather than its own question — an outer
  // fieldset commonly groups several questions.
  const container = first.closest('fieldset, [role="radiogroup"], [role="group"]')

  if (container) {
    const ariaLabel = container.getAttribute('aria-label')
    if (ariaLabel) return ariaLabel.replace(/\s+/g, ' ').trim()

    // Only a fieldset's *own* legend, not a nested one belonging to an inner group.
    const legend = container.querySelector(':scope > legend')
    if (legend?.textContent) return legend.textContent.replace(/\s+/g, ' ').trim()
  }

  return resolveSection(first) || first.name
}

export class GenericAdapter implements FormAdapter {
  // Declared as `string`, not inferred as the literal `'generic'`, so subclasses can name
  // themselves. Same reason `matches` takes the URL it ignores: a narrower signature here
  // makes every override invalid.
  readonly name: string = 'generic'

  matches(_url: URL): boolean {
    // The fallback for everything; the registry only reaches it when nothing else matched.
    return true
  }

  detectForms(root: Document | ShadowRoot): DetectedForm[] {
    resetIdCounter()

    // `instanceof Document` is realm-scoped and returns false for a document from another
    // realm — which is exactly what a content script sees inside an iframe. nodeType is
    // realm-independent, so it is the only reliable discriminator here.
    const isDocument = root.nodeType === 9
    const container = (isDocument ? (root as Document).body : root) as HTMLElement | null
    if (!container) return []

    const doc = isDocument ? (root as Document) : container.ownerDocument
    // Computed once per pass: it forces layout, and doing it per field would be the exact
    // reflow storm the overlay work is careful to avoid.
    const hasLayout = documentHasLayout(doc)

    const fields: DetectedField[] = []
    const claimed = new WeakSet<Element>()

    // Grouped controls first, so the single-input pass below can skip their members.
    for (const [, controls] of groupControls(root, hasLayout)) {
      const first = controls[0]
      if (!first) continue
      for (const control of controls) claimed.add(control)

      const isRadio = first.type === 'radio'
      /**
       * `"on"` is the browser's default for a checkbox with no `value`, not a real one.
       * Keeping it made every option in a group share the value `"on"`, so a model answering
       * with the value matched all of them and ticked every box.
       */
      const optionValue = (c: HTMLInputElement) =>
        c.value && c.value !== 'on' ? c.value : resolveLabel(c)

      const options: FieldOption[] = controls.map((c) => ({
        value: optionValue(c),
        label: resolveLabel(c) || optionValue(c),
      }))

      // A lone checkbox is a yes/no question; several sharing a name is multi-select.
      const kind: FieldKind = isRadio ? 'radio' : controls.length > 1 ? 'multiselect' : 'checkbox'

      const schema: FieldSchema = {
        ...baseSchema(first, kind, nextId('f')),
        label: groupLabel(controls) || resolveLabel(first),
        ...(kind === 'checkbox' ? {} : { options }),
      }

      const checked = controls.filter((c) => c.checked)
      if (checked.length > 0) {
        schema.currentValue = checked.map(optionValue).join(', ')
      }

      fields.push({ schema, element: first, groupElements: controls })
    }

    for (const el of container.querySelectorAll<HTMLElement>('input, textarea, select')) {
      if (claimed.has(el)) continue
      if (!isFillable(el, hasLayout)) continue

      if (el instanceof HTMLInputElement) {
        const type = (el.getAttribute('type') ?? 'text').toLowerCase()
        if (SKIPPED_INPUT_TYPES.has(type)) continue
        // Setting a non-empty value on a file input throws `InvalidStateError` in Chrome,
        // and nothing we produce can fill one anyway.
        if (type === 'file') continue
        const kind = TYPE_TO_KIND[type] ?? 'text'
        const schema = baseSchema(el, kind, nextId('f'))
        if (el.value) schema.currentValue = el.value
        fields.push({ schema, element: el })
        continue
      }

      if (el instanceof HTMLTextAreaElement) {
        const schema = baseSchema(el, 'longtext', nextId('f'))
        if (el.value) schema.currentValue = el.value
        fields.push({ schema, element: el })
        continue
      }

      if (el instanceof HTMLSelectElement) {
        const kind: FieldKind = el.multiple ? 'multiselect' : 'select'
        const schema: FieldSchema = {
          ...baseSchema(el, kind, nextId('f')),
          options: optionsOf(el),
        }
        if (el.value) schema.currentValue = el.value
        fields.push({ schema, element: el })
      }
    }

    const editables = [
      ...container.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]'),
    ]

    for (const el of editables) {
      if (!isFillable(el, hasLayout)) continue

      /**
       * Only the outermost editable region is a field.
       *
       * Rich-text editors nest editable nodes. Detecting an inner one as its own field means
       * writing the outer one first destroys it — `textContent` replaces every child — and
       * the inner write then lands on a node that is no longer in the document.
       */
      if (editables.some((other) => other !== el && other.contains(el))) continue
      const schema = baseSchema(el, 'longtext', nextId('f'))
      const text = el.textContent?.trim()
      if (text) schema.currentValue = text
      fields.push({ schema, element: el })
    }

    if (fields.length === 0) return []
    return [{ root: container, fields }]
  }

  /**
   * Returns `boolean | Promise<boolean>` rather than plain `boolean` so subclasses can be
   * async — driving a react-select means waiting on the page. The generic path is entirely
   * synchronous, and awaiting a non-promise costs nothing.
   */
  applyValue(field: DetectedField, value: string): boolean | Promise<boolean> {
    const { element, schema, groupElements } = field

    if (groupElements && groupElements.length > 0) {
      // A lone checkbox is a yes/no question, not a choice among options — its `value` is
      // usually the useless HTML default "on", so match on intent instead.
      if (schema.kind === 'checkbox') {
        const only = groupElements[0] as HTMLInputElement
        const intent = readIntent(value)
        // An answer that is neither yes nor no is not a deliberate "leave it unchecked" —
        // it is an answer we failed to understand, and reporting success for it hid that.
        if (intent === null) return false
        return writeCheckedValue(only, intent)
      }

      /**
       * The whole answer is tried before splitting on commas.
       *
       * Option labels contain commas — "Social media (X, Facebook, etc.)" is ordinary — and
       * splitting first turned them into fragments that matched nothing. A fragment can also
       * match a *different* option ("Yes" out of "Yes, I agree"), ticking the wrong box.
       */
      const controls = groupElements as HTMLInputElement[]
      const keysOf = (c: HTMLInputElement) =>
        [c.value, resolveLabel(c)].filter(Boolean).map((k) => k.toLowerCase())

      const whole = value.trim().toLowerCase()
      const matchesWhole = controls.some((c) => keysOf(c).includes(whole))

      const wanted = matchesWhole
        ? [whole]
        : value
            .split(',')
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean)

      let applied = false
      for (const control of controls) {
        const shouldCheck = keysOf(control).some((k) => wanted.includes(k))

        if (schema.kind === 'radio') {
          if (shouldCheck && writeCheckedValue(control, true)) applied = true
        } else if (writeCheckedValue(control, shouldCheck)) {
          if (shouldCheck) applied = true
        }
      }
      return applied
    }

    if (element instanceof HTMLSelectElement) return writeSelectValue(element, value)
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox') {
        const intent = readIntent(value)
        if (intent === null) return false
        return writeCheckedValue(element, intent)
      }
      return writeTextValue(element, value)
    }
    if (element instanceof HTMLTextAreaElement) return writeTextValue(element, value)
    if (element.isContentEditable) return writeContentEditable(element, value)

    return false
  }
}
