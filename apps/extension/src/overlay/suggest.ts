import type { KnownFacts } from '@aff/shared/facts'
import { matchFact } from '@aff/shared/facts'

/**
 * Instant inline suggestions: matching a focused field against what we already know, so a
 * name or an email can be filled with no model call at all.
 *
 * The matching itself is `matchFact` in `@aff/shared/facts`, and this file is now barely more
 * than the name the panel calls it by. That is the point. The rules used to live here, in the
 * extension, where the Worker could not reach them — so the panel could suggest a stored
 * address for a field that the Fill button then answered with the user's country. One matcher,
 * both paths, and a rule added to the catalogue changes them together.
 */

export type { KnownFacts } from '@aff/shared/facts'

export interface Suggestion {
  label: string
  value: string
}

export function suggestForField(
  field: { label: string; autocomplete?: string; kind: string },
  facts: KnownFacts,
): Suggestion | null {
  return matchFact(field, facts)
}
