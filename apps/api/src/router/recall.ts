import { type FieldSchema, type Fill, type LearnedAnswer, matchOptions } from '@aff/shared'
import type { Classification } from './classify.js'

/**
 * Answers a question the user has already answered, with no model call.
 *
 * Tier 0 answers *identity* — a fixed set of slots, matched by pattern. This is the same idea
 * applied to everything else the user has told us by submitting a form: if they picked "iOS"
 * last time this exact question was asked, picking it again is a lookup, not a judgement.
 *
 * Two properties are worth more here than cleverness:
 *
 *   - **Deterministic.** The same question gets the same answer every time, for free, with no
 *     retrieval ranking and no model temperature in the path. This is what makes the product
 *     feel like it remembers rather than re-decides.
 *   - **Exact match only.** No substring or fuzzy matching on the question, because a
 *     confidently wrong deterministic answer is worse than a model call — "Do you have a
 *     driving licence?" and "Do you have a driving licence for heavy vehicles?" are different
 *     questions. Differently-worded repeats are still handled well: every learned answer is
 *     also in the prompt, where the model can see it means the same thing.
 *
 * A learned answer that does not fit the field on this form is *not* forced onto it. The
 * classification falls through to the model tiers, which see the same answer as context.
 */

/**
 * The question as it will be recognised next time.
 *
 * Google appends "*" to required questions and many forms end a label with a colon, so the
 * same question arrives punctuated three different ways across three sites. Shared by the
 * write path and the read path on purpose: two normalisers that drift by one character are two
 * stores that never agree, and the failure is silent.
 */
export function normalizeQuestion(label: string, maxChars = 200): string {
  return label
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s*:]+$/, '')
    .trim()
    .slice(0, maxChars)
}

function keyOf(label: string): string {
  return normalizeQuestion(label).toLowerCase()
}

/**
 * Maps a remembered answer onto this field's option list.
 *
 * Returns the option **values** the widget expects, or `undefined` when the answer names
 * something this form does not offer — the remembered "Notion, Coda" against a form that only
 * lists Notion. Partially applying that would silently drop half the user's answer, so it goes
 * to the model instead, which can see the full list and decide.
 */
function toOptions(field: FieldSchema, answer: string): string | undefined {
  const options = field.options
  if (!options || options.length === 0) return undefined

  const { chosen, leftover } = matchOptions(answer, options, (option) => [
    option.value,
    option.label,
  ])

  if (chosen.length === 0) return undefined

  /**
   * Nothing unaccounted for, or nothing at all.
   *
   * A remembered answer whose every part landed on an option is a definite answer to this
   * form's question. One with something left over named a choice this form does not offer, and
   * applying just the part that matched would silently drop half of what the user said while
   * reporting the field as filled. The model sees the whole list and can decide instead.
   */
  if (leftover !== '') return undefined

  if (field.kind !== 'multiselect' && chosen.length > 1) return undefined

  return chosen.map((option) => option.value).join(', ')
}

/** What a remembered answer becomes on this field, or `undefined` if it does not apply. */
function valueFor(field: FieldSchema, answer: string): string | undefined {
  if (field.options && field.options.length > 0) return toOptions(field, answer)

  /**
   * A remembered one-liner is not an answer to an essay.
   *
   * "9" is the right answer to "years of experience" and a terrible one to "tell us about a
   * project you are proud of" — and a textarea that arrives pre-filled with it reads as a
   * broken product. Prose questions belong to the model, which has the user's voice.
   */
  if (field.kind === 'longtext') return undefined

  return answer
}

export interface RecallResult {
  fills: Fill[]
  /** Everything still needing a model, in the order it arrived. */
  unresolved: Classification[]
}

export function resolveLearned(
  learned: LearnedAnswer[],
  fields: Map<string, FieldSchema>,
  unresolved: Classification[],
): RecallResult {
  if (learned.length === 0) return { fills: [], unresolved }

  /**
   * Newest wins on a duplicate key.
   *
   * `foldLearned` already keeps one row per question, but the map is built newest-last so a
   * history written before that rule existed cannot resurrect a stale answer.
   */
  const byQuestion = new Map(learned.map((entry) => [keyOf(entry.question), entry.answer]))

  const fills: Fill[] = []
  const remaining: Classification[] = []

  for (const classification of unresolved) {
    const field = fields.get(classification.fieldId)
    const answer = field ? byQuestion.get(keyOf(field.label)) : undefined
    const value = field && answer ? valueFor(field, answer) : undefined

    if (value === undefined) {
      remaining.push(classification)
      continue
    }

    fills.push({
      fieldId: classification.fieldId,
      label: field?.label ?? '',
      value,
      // The user's own previous answer to this exact question. Nothing is more certain.
      confidence: 1,
      options: field?.options?.map((option) => option.value) ?? [],
      tier: 0,
      // Recalled, not reasoned. Marking it inferred would flag it for review and ask the user
      // to re-confirm a decision they have already made twice.
      inferred: false,
    })
  }

  return { fills, unresolved: remaining }
}
