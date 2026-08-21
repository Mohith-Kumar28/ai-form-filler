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

  /**
   * Already-populated value. A real one means we skip unless the user forces a refill —
   * but see `hasAnswer`, which is the thing to ask rather than testing this directly.
   */
  currentValue: z.string().optional(),
})
export type FieldSchema = z.infer<typeof FieldSchema>

/**
 * A `tel` value that is only a dial code: `+91`, `+1 `, `+44 ()`, or a bare `+`.
 *
 * International phone widgets — `react-phone-number-input`, `intl-tel-input`, and every
 * component library that wraps them — seed the input with the dial code of the country their
 * selector is showing. That prefix is furniture the page put there, not something the user
 * typed, and it is present before anybody has touched the field.
 */
const DIAL_CODE_ONLY = /^\+[\s()\-.]*\d{0,4}[\s()\-.]*$/

/**
 * Whether a field already holds a real answer, as opposed to furniture.
 *
 * Ask this rather than testing `currentValue` for emptiness. A phone input showing `+91` is
 * the case that forced it: `currentValue` was `"+91"`, so the field counted as filled, and
 * everything downstream did the polite thing and left it alone. The fill skipped it as
 * `already_filled`, and the content script's field assist took the same branch — which is why
 * the inline sparkle never appeared on it either. One prefix, two symptoms, and from the
 * outside it looked like phone fields were not being detected at all.
 *
 * Deliberately narrow. Only `tel`, and only a `+` with at most four digits after it: the
 * longest dial code in use is three (+998), four buys a margin, and five would start eating
 * real short numbers. A national-format prefix with no `+` — a bare `91`, or the `(0)` some
 * widgets show — is left alone, because there is no way to tell it from somebody's actual
 * first two digits.
 */
export function hasAnswer(field: { kind?: string; currentValue?: string | undefined }): boolean {
  const value = field.currentValue?.trim()
  if (!value) return false
  if (field.kind === 'tel' && DIAL_CODE_ONLY.test(value)) return false
  return true
}

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
