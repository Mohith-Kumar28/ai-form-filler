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
  return el.value === value
}

/**
 * Selects an option by value, then by exact label, then by case-insensitive contains.
 *
 * The fallback chain exists because the model is told to answer with an option's `value`,
 * but on real forms `value` is often an opaque id (`"opt_3"`) while the label is the only
 * meaningful string — so a model that answers with the visible text still succeeds.
 */
export function writeSelectValue(el: HTMLSelectElement, value: string): boolean {
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
  return el.value === match.value
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
  return el.checked === shouldCheck
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
  return el.textContent === value
}
