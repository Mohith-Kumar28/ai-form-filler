import type { FieldSchema, FormSchema } from '@aff/shared'

/** A field paired with the live element it came from. The element never leaves the page. */
export interface DetectedField {
  schema: FieldSchema
  /**
   * For radio and checkbox groups this is the group's first element; the full set is in
   * `groupElements`, because writing a radio means clicking one of several nodes.
   */
  element: HTMLElement
  groupElements?: HTMLElement[]
}

export interface DetectedForm {
  fields: DetectedField[]
  /** The form or container element, used for scoping and for scroll-into-view. */
  root: HTMLElement
}

export interface FormAdapter {
  /** Stable identifier recorded in `fill_log` so per-site accuracy is measurable. */
  readonly name: string
  matches(url: URL): boolean
  detectForms(root: Document | ShadowRoot): DetectedForm[]
  /** Returns true if the value was verifiably applied. */
  applyValue(field: DetectedField, value: string): Promise<boolean> | boolean
  /**
   * What the field holds right now, in the same vocabulary `applyValue` accepts, or `null`
   * for a field the user has not answered.
   *
   * **Reading is an adapter concern, exactly like writing.** This started life as a helper in
   * the extension that sniffed the DOM — `instanceof HTMLSelectElement`, `element.checked` —
   * and it silently returned `null` for every widget that is not a native control. On Google
   * Forms that is every radio, checkbox and dropdown, and on a native radio group it read
   * only the *first* radio's checked state. The consequence was not a visible failure: the
   * learning loop simply never saw a choice the user made, on any site, so the product could
   * not learn "iOS" or a multi-select while learning a typed phone number fine.
   *
   * The asymmetry was the bug. An adapter that knows how to click a div into a checked state
   * is the only thing that knows how to read that state back, so the contract now demands
   * both and a new adapter cannot forget the second half.
   *
   * Returns human-readable option **labels** rather than opaque values: these strings become
   * remembered answers and reach a prompt, where "United States" carries meaning and
   * "opt_1" carries none. Multiple selections are joined with ", " — the same shape
   * `applyValue` parses.
   */
  readValue(field: DetectedField): string | null
}

/** Everything the content script hands to the background worker, plus the local element map. */
export interface DetectionResult {
  form: FormSchema
  /** fieldId → detected field. Lives only in the content script; never serialised. */
  elements: Map<string, DetectedField>
  /**
   * The adapter that produced this result, carried so application uses the same one that
   * detected. Re-selecting by URL at apply time would silently diverge if the page had
   * navigated in between.
   */
  adapter: FormAdapter
  /**
   * Whether this is a form a person would call a form, rather than a stray control.
   *
   * Separate from `form.fields.length > 0` on purpose, and consulted only by the parts of the
   * UI that appear **uninvited**. A fill the user asked for should still reach a lone field;
   * the launcher must not show up beside one. See `isActualForm`.
   */
  actualForm: boolean
}
