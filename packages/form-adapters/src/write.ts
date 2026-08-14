/**
 * Writing values into fields that frameworks control.
 *
 * The naive `el.value = x` does not work on React-controlled inputs. React stores the last
 * value it rendered on the DOM node itself (`_valueTracker`); when the next render runs and
 * the tracked value still matches, React concludes nothing changed and reverts the field.
 * The user sees the value flash in and disappear.
 *
 * The fix is to call the *native* prototype setter — which bypasses React's override and
 * updates the tracker — then dispatch a bubbling `input` event so React's synthetic handler
 * picks the change up as if a human typed it.
 *
 * Vue, Svelte, and Angular all listen for the same bubbling `input`/`change` events, so this
 * works for them too.
 */

type ValueElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/**
 * Resolved lazily rather than at module load: a content script can be injected before the
 * page's own scripts run, and some frameworks patch these prototypes on boot.
 */
function nativeValueSetter(el: ValueElement): ((value: string) => void) | null {
  const proto =
    el instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype

  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (!descriptor?.set) return null
  return descriptor.set.bind(el)
}

/** Dispatches the events a framework needs to observe the change, in the order a human produces. */
function notifyChange(el: Element): void {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Some validation libraries (react-hook-form in `onBlur` mode, most notably) only run on
 * focus/blur, so a value written without them stays flagged as untouched and invalid.
 */
function simulateVisit(el: HTMLElement): void {
  el.dispatchEvent(new Event('focus', { bubbles: true }))
  el.dispatchEvent(new Event('blur', { bubbles: true }))
}

export function writeTextValue(el: ValueElement, value: string): boolean {
  const setter = nativeValueSetter(el)
  if (setter) {
    setter(value)
  } else {
    // No descriptor — a non-standard element. Direct assignment is the only option.
    el.value = value
  }
  notifyChange(el)
  simulateVisit(el)

  /**
   * Success means the value is still there *and* the node is still in the document.
   *
   * A write into a node the page has already discarded reads back correctly and means
   * nothing — `el.value === value` is true on a detached input.
   */
  return el.isConnected && el.value === value
}

/**
 * Selects an option by value, then by exact label, then by case-insensitive contains.
 *
 * The fallback chain exists because the model is told to answer with an option's `value`,
 * but on real forms `value` is often an opaque id (`"opt_3"`) while the label is the only
 * meaningful string — so a model that answers with the visible text still succeeds.
 */
/** Finds the option a written answer refers to, by value then by visible text. */
function matchSelectOption(
  options: HTMLOptionElement[],
  value: string,
): HTMLOptionElement | undefined {
  const wanted = value.trim().toLowerCase()
  return (
    options.find((o) => o.value === value) ??
    options.find((o) => o.text.trim() === value.trim()) ??
    options.find((o) => o.value.trim().toLowerCase() === wanted) ??
    options.find((o) => o.text.trim().toLowerCase() === wanted) ??
    options.find((o) => o.text.trim().toLowerCase().includes(wanted) && wanted.length > 2)
  )
}

/**
 * A `<select multiple>` can hold several options, and `el.value` can only ever express one.
 *
 * Multi-selects were detected as `multiselect` and then written through the scalar path, so
 * at most one option was ever selected — and under a comma-separated answer the whole string
 * matched nothing, so usually none were. Success requires every requested option to land.
 */
function writeMultiSelectValue(el: HTMLSelectElement, value: string): boolean {
  const options = [...el.options]

  // Whole value first: an option's own text may contain a comma.
  const whole = matchSelectOption(options, value)
  const tokens = whole
    ? [value]
    : value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)

  const matched = tokens
    .map((token) => matchSelectOption(options, token))
    .filter((option): option is HTMLOptionElement => option !== undefined)

  if (matched.length === 0) return false

  for (const option of options) option.selected = matched.includes(option)
  notifyChange(el)

  return el.isConnected && matched.every((option) => option.selected)
}

export function writeSelectValue(el: HTMLSelectElement, value: string): boolean {
  if (el.multiple) return writeMultiSelectValue(el, value)

  const options = [...el.options]
  const wanted = value.trim().toLowerCase()

  const match =
    options.find((o) => o.value === value) ??
    options.find((o) => o.text.trim() === value.trim()) ??
    options.find((o) => o.value.trim().toLowerCase() === wanted) ??
    options.find((o) => o.text.trim().toLowerCase() === wanted) ??
    options.find((o) => o.text.trim().toLowerCase().includes(wanted) && wanted.length > 2)

  if (!match) return false

  const setter = nativeValueSetter(el)
  if (setter) setter(match.value)
  else el.value = match.value

  notifyChange(el)
  return el.isConnected && el.value === match.value
}

/**
 * Checks a checkbox or radio by clicking it rather than setting `.checked`.
 *
 * `.checked = true` does not fire the events a framework listens for, and for radios it
 * does not deselect the sibling that was previously selected. `click()` produces the exact
 * sequence a real user does — and is a no-op guard away from being idempotent.
 */
export function writeCheckedValue(el: HTMLInputElement, shouldCheck: boolean): boolean {
  if (el.checked !== shouldCheck) {
    el.click()
  }
  return el.isConnected && el.checked === shouldCheck
}

/**
 * `contenteditable` regions (rich-text editors, some ATS cover-letter boxes) have no `value`.
 *
 * `textContent` is used rather than `innerHTML` deliberately: model output is untrusted text
 * and must never be parsed as markup. Assigning to `innerHTML` here would be a self-inflicted
 * XSS in the page's origin.
 */
export function writeContentEditable(el: HTMLElement, value: string): boolean {
  el.focus()
  el.textContent = value
  notifyChange(el)
  el.dispatchEvent(new Event('blur', { bubbles: true }))

  /**
   * `isConnected` matters most here. Writing `textContent` on an outer editable **destroys
   * every node inside it**, so a nested editable detected as its own field is detached by
   * the time it is written — and `textContent === value` still reads true on a node in no
   * document, reporting success for a write nobody will ever see.
   */
  return el.isConnected && el.textContent === value
}
