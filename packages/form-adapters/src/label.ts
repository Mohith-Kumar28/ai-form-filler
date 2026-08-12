/**
 * Label resolution.
 *
 * The label is the single most important signal we send the model — it is what the field is
 * *asking*. Every other property (kind, maxLength, options) only constrains the answer's
 * shape. Real forms label fields in wildly inconsistent ways, so this walks a precedence
 * chain from most explicit to most speculative.
 */

const MAX_LABEL_LENGTH = 300

function clean(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH)
}

/** Text of an element with nested inputs and their values excluded. */
function ownText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  for (const nested of clone.querySelectorAll('input, textarea, select, button, style, script')) {
    nested.remove()
  }
  return clean(clone.textContent)
}

function fromAriaLabelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby')
  if (!ids) return ''
  const root = el.getRootNode() as Document | ShadowRoot
  return clean(
    ids
      .split(/\s+/)
      .map((id) => root.querySelector(`#${CSS.escape(id)}`)?.textContent ?? '')
      .join(' '),
  )
}

function fromLabelElement(el: Element): string {
  const id = el.getAttribute('id')
  if (id) {
    const root = el.getRootNode() as Document | ShadowRoot
    // `for=` is the explicit, author-intended association — trust it above anything derived.
    const explicit = root.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (explicit) return ownText(explicit)
  }

  // A wrapping <label> is equally intentional, just written differently.
  const wrapping = el.closest('label')
  if (wrapping) return ownText(wrapping)

  return ''
}

/**
 * Last resort: walk up looking for text in an ancestor that contains this field and no others.
 *
 * The "no others" condition matters. A container holding five inputs has text describing the
 * *section*, not this field, and using it would give every field in that section the same
 * label — which is worse than no label at all, because it looks plausible.
 */
function fromNearestAncestorText(el: Element): string {
  let current = el.parentElement
  let depth = 0

  // Stop before <body>: whole-page text is never a field label, and on a sparse page body
  // trivially satisfies the one-input test and would caption the field with the page.
  while (current && depth < 4 && current.tagName !== 'BODY' && current.tagName !== 'FORM') {
    const inputsInside = current.querySelectorAll('input, textarea, select').length
    if (inputsInside === 1) {
      const text = ownText(current)
      if (text.length > 0 && text.length < 200) return text
    }
    current = current.parentElement
    depth += 1
  }

  return ''
}

export function resolveLabel(el: Element): string {
  return (
    fromLabelElement(el) ||
    clean(el.getAttribute('aria-label')) ||
    fromAriaLabelledBy(el) ||
    clean(el.getAttribute('placeholder')) ||
    clean(el.getAttribute('title')) ||
    fromNearestAncestorText(el) ||
    // A name attribute is machine-ish but still better than nothing: "workAuthStatus"
    // tells the model more than an empty string does.
    clean(el.getAttribute('name'))
  )
}

/**
 * Help text near the field — the sentence under an input explaining what's wanted.
 * `aria-describedby` is the standards-based version; the class-name sniffing after it covers
 * the common component libraries that never wired it up.
 */
export function resolveHint(el: Element): string {
  const describedBy = el.getAttribute('aria-describedby')
  if (describedBy) {
    const root = el.getRootNode() as Document | ShadowRoot
    const text = clean(
      describedBy
        .split(/\s+/)
        .map((id) => root.querySelector(`#${CSS.escape(id)}`)?.textContent ?? '')
        .join(' '),
    )
    if (text) return text
  }

  const sibling = el.parentElement?.querySelector(
    '[class*="help"], [class*="hint"], [class*="description"], small',
  )
  return sibling && !sibling.contains(el) ? ownText(sibling) : ''
}

/**
 * The section heading a field sits under.
 *
 * Disambiguates repeated labels — a form with Education and Employment blocks has two
 * "Start date" fields, and without the section the model cannot tell them apart.
 */
export function resolveSection(el: Element): string {
  const container = el.closest('fieldset, section, [role="group"], [class*="section"]')
  if (container) {
    const legend = container.querySelector('legend, h1, h2, h3, h4, [class*="title"]')
    if (legend) {
      const text = ownText(legend)
      if (text) return text
    }
  }

  // No container: fall back to the nearest preceding heading in document order.
  let node: Element | null = el
  while (node) {
    let sibling = node.previousElementSibling
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) return ownText(sibling)
      sibling = sibling.previousElementSibling
    }
    node = node.parentElement
  }

  return ''
}
