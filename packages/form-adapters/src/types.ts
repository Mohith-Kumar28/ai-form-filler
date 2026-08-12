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
}
