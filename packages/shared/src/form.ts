import { z } from 'zod'

/**
 * How a field behaves, not what tag it is. Adapters normalise wildly different DOM
 * (a Google Forms `[role=radio]` div, a react-select combobox, a native `<select>`)
 * onto this small set so the model only ever reasons about behaviour.
 */
export const FieldKind = z.enum([
  'text',
  'longtext',
  'email',
  'tel',
  'url',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
  'multiselect',
  'file',
])
export type FieldKind = z.infer<typeof FieldKind>

/** A choice on a select/radio/multiselect. `value` is what we write; `label` is what the user sees. */
export const FieldOption = z.object({
  value: z.string(),
  label: z.string(),
})
export type FieldOption = z.infer<typeof FieldOption>

export const FieldSchema = z.object({
  /**
   * Stable within a single detection pass. The content script owns the
   * fieldId -> Element map; the server never sees a selector or any DOM.
   */
  id: z.string().min(1),
  kind: FieldKind,

  /** Best-effort resolved label. See `resolveLabel` in @aff/form-adapters for precedence. */
  label: z.string(),
  /** Help text, description, or hint rendered near the field. */
  hint: z.string().optional(),
  placeholder: z.string().optional(),

  required: z.boolean().default(false),
  maxLength: z.number().int().positive().optional(),

  /** Present for select/radio/multiselect. The model MUST choose from these. */
  options: z.array(FieldOption).optional(),

  /** Native autocomplete token (`email`, `given-name`, ...) — a strong tier-0 signal. */
  autocomplete: z.string().optional(),

  /**
   * Section or fieldset heading this field sits under. Disambiguates repeated labels
   * ("Start date" under Education vs. under Employment).
   */
  section: z.string().optional(),

  /** Already-populated value. Non-empty means we skip unless the user forces a refill. */
  currentValue: z.string().optional(),
})
export type FieldSchema = z.infer<typeof FieldSchema>

export const FormSchema = z.object({
  /** Origin only. We deliberately do not send full URLs — they leak query-string PII. */
  origin: z.string().url(),
  /** Path without query or fragment, for adapter attribution and debugging. */
  path: z.string().default('/'),
  pageTitle: z.string().optional(),

  /** Which adapter produced this, e.g. `generic`, `google-forms`, `ats-standard`. */
  adapter: z.string(),

  /**
   * Visible page text near the form, capped server-side. Gives the model context like
   * the company name and role for "why do you want to work here".
   */
  pageContext: z.string().max(4000).optional(),

  fields: z.array(FieldSchema).min(1).max(300),
})
export type FormSchema = z.infer<typeof FormSchema>
