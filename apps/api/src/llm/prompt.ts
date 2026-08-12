import type { FieldSchema } from '@aff/shared'
import { z } from 'zod'
import type { Classification } from '../router/classify.js'

/**
 * Prompt assembly. **Read this before changing anything in it.**
 *
 * The whole cost model rests on one property: the ~10k-token profile document must sit
 * behind a prompt-cache breakpoint whose prefix is byte-identical across requests. Caching
 * hashes `tools → system → messages` **in that order**, so anything variable appearing in
 * `tools` or `system` invalidates the cached profile on every single request.
 *
 * There is no error when that happens. The only symptom is `cacheReadTokens: 0` and a bill
 * roughly ten times the modelled one — which is why `fill.integration.test.ts` asserts on it.
 *
 * The specific trap: `generateObject` synthesises a *new tool per schema*. Using it with a
 * per-form schema would silently disable caching forever. Hence the fixed tool below and
 * `generateText` at the call site.
 */

/**
 * The one and only output schema — identical for every form on earth.
 *
 * Do not make this depend on the form. The form's structure travels in the user message,
 * below the cache breakpoint, where variation is free.
 */
export const SubmitFillsSchema = z.object({
  fills: z.array(
    z.object({
      fieldId: z.string().describe('The id of the field being answered, copied exactly.'),
      value: z
        .string()
        .describe(
          'The answer, written as the user would write it. For a choice field this must be one of the offered option values.',
        ),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe(
          'How sure you are, given only what the profile actually says. Below 0.7 flags the answer for review.',
        ),
      reasoning: z
        .string()
        .optional()
        .describe('One short clause naming the profile fact this came from.'),
    }),
  ),
  skipped: z
    .array(
      z.object({
        fieldId: z.string(),
        reason: z.string().describe('Why this field could not be answered from the profile.'),
      }),
    )
    .describe('Fields you could not answer. Leaving a field out entirely is not acceptable.'),
})

export type SubmitFillsInput = z.infer<typeof SubmitFillsSchema>

/**
 * Frozen. Every byte of this string is part of the cache prefix, so edits invalidate every
 * user's cached profile at once — batch changes rather than tweaking wording casually.
 */
export const SYSTEM_INSTRUCTIONS = `You fill in web forms on behalf of a specific person, using only the profile supplied below.

Rules:
- Answer only from the profile. If the profile does not contain the answer, skip the field — never invent a fact, a date, a number, or an employer.
- Write in the person's own voice. Match the tone and sentence length of their example writing when it is provided.
- For a field with options, the value must be exactly one of the offered option values. For multiple selections, separate values with a comma.
- Respect the stated maximum length. A truncated answer is worse than a shorter complete one.
- Confidence reflects how directly the profile supports the answer, not how well-written it is. An inference from adjacent facts is below 0.7.
- Do not add pleasantries, salutations, or sign-offs unless the field explicitly asks for a letter.
- Answer every field you are given: either in "fills" or in "skipped".`

/** Describes a field to the model, dropping keys that carry no signal. */
function describeField(field: FieldSchema): Record<string, unknown> {
  return {
    fieldId: field.id,
    label: field.label,
    kind: field.kind,
    ...(field.section ? { section: field.section } : {}),
    ...(field.hint ? { hint: field.hint } : {}),
    ...(field.placeholder ? { placeholder: field.placeholder } : {}),
    ...(field.maxLength ? { maxLength: field.maxLength } : {}),
    ...(field.required ? { required: true } : {}),
    ...(field.options ? { options: field.options.map((o) => o.value) } : {}),
    // Option labels are what a human reads, so include them when they add information.
    ...(field.options?.some((o) => o.label !== o.value)
      ? { optionLabels: Object.fromEntries(field.options.map((o) => [o.value, o.label])) }
      : {}),
  }
}

export interface UserMessageInput {
  fields: FieldSchema[]
  classifications: Classification[]
  pageContext?: string | undefined
  origin: string
  /** Past answers retrieved by BM25. Only supplied for tier-3 batches. */
  relatedAnswers?: { label: string; answer: string }[]
}

/**
 * Everything variable goes here — below the cache breakpoint, where variation costs nothing.
 */
export function buildUserMessage(input: UserMessageInput): string {
  const parts: string[] = []

  parts.push(`This form is on ${input.origin}.`)

  if (input.pageContext) {
    parts.push(`Page context:\n${input.pageContext}`)
  }

  if (input.relatedAnswers && input.relatedAnswers.length > 0) {
    // Past accepted answers are the strongest available signal for both voice and content.
    parts.push(
      `Answers this person gave to similar questions before. Reuse the substance and the voice; do not copy verbatim if the question differs:\n${input.relatedAnswers
        .map((a) => `Q: ${a.label}\nA: ${a.answer}`)
        .join('\n\n')}`,
    )
  }

  parts.push(`Fields to fill:\n${JSON.stringify(input.fields.map(describeField), null, 1)}`)

  return parts.join('\n\n')
}

/**
 * System blocks, ordered stable-first.
 *
 * The caller marks the **last** block with a cache breakpoint, so everything above it is
 * cached together. `SYSTEM_INSTRUCTIONS` precedes the profile because it changes even less
 * often; putting the profile first would mean an instruction edit invalidated nothing, but
 * a profile edit invalidated the instructions too.
 */
export function buildSystemBlocks(profileDoc: string): string[] {
  return [SYSTEM_INSTRUCTIONS, `The person's profile:\n\n${profileDoc}`]
}
