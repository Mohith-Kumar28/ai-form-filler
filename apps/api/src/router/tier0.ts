import type { FieldSchema, Fill, Identity, Skip } from '@aff/shared'
import { matchFact } from '@aff/shared/facts'
import { type Classification, type IdentitySlot, isAboutApplicant } from './classify.js'

/**
 * Answers fields directly from the stored profile, with no model call.
 *
 * Every field resolved here costs nothing and cannot hallucinate — the value is exactly what
 * the user typed or what was parsed from their own resume. This is why keeping the profile
 * well-populated matters more than any model choice.
 *
 * Two sources, and for a long time only the first was consulted:
 *
 *   - `identity`, a fixed set of twelve slots recognised by `identitySlotFor`.
 *   - `custom`, the facts the user typed into the panel under names they chose.
 *
 * Both are matched by `matchFact` from `@aff/shared/facts` — the same function, over the same
 * catalogue, that the panel uses to offer a suggestion when you focus a field. That shared
 * matcher is the point of this file's current shape.
 *
 * It got here in two wrong steps. First `custom` was not read at all, so "Address Line" was
 * classified tier 0 with slot `location`, found `identity.location` empty, and was dropped
 * without ever reaching a model — while the panel, reading the whole catalogue, could suggest
 * the stored address the instant you focused the same field. Then `custom` was read but matched
 * by a hand-written table of alias keys per slot, which for `location` tried city, address,
 * town, state and country in turn — so an address field got answered with the user's *country*,
 * confidently and at tier 0. Two matchers over one set of facts, disagreeing twice.
 *
 * There is one matcher now. Ranked keywords, exact-label rules and autocomplete tokens all come
 * from the catalogue, which is why "Address Line" resolves to the address at rank 40 and never
 * reaches the country at rank 45.
 */

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { first: fullName.trim(), last: '' }
  return {
    first: parts[0] ?? '',
    // Everything after the first token. Naive for some naming conventions, but it beats
    // asking a model, and the user can correct it in the profile editor.
    last: parts.slice(1).join(' '),
  }
}

export function resolveSlot(identity: Identity, slot: IdentitySlot): string | undefined {
  switch (slot) {
    case 'fullName':
      return identity.fullName
    case 'firstName':
      return identity.fullName ? splitName(identity.fullName).first : undefined
    case 'lastName': {
      if (!identity.fullName) return undefined
      // An empty surname is a failure to resolve, not an answer of "".
      return splitName(identity.fullName).last || undefined
    }
    case 'preferredName':
      return identity.preferredName ?? identity.fullName
    case 'email':
      return identity.email
    case 'phone':
      return identity.phone
    case 'location':
      return identity.location
    case 'pronouns':
      return identity.pronouns
    case 'workAuthorization':
      return identity.workAuthorization
    case 'linkedin':
      return identity.links.linkedin
    case 'github':
      return identity.links.github
    case 'website':
      return identity.links.website
  }
}

export interface Tier0Result {
  fills: Fill[]
  skipped: Skip[]
  /** Fields we could not answer, handed back to the model tiers. */
  unresolved: Classification[]
}

export function resolveTier0(
  identity: Identity,
  classifications: Classification[],
  /** fieldId → the field, for its label and its kind. */
  fields: Map<string, FieldSchema> = new Map(),
  /** Facts the user typed, keyed by the names they chose. */
  custom: Record<string, string> = {},
): Tier0Result {
  const fills: Fill[] = []
  const skipped: Skip[] = []
  const unresolved: Classification[] = []

  const answer = (fieldId: string, value: string) => {
    fills.push({
      fieldId,
      label: fields.get(fieldId)?.label ?? '',
      value,
      // Certain: this is the user's own stored value, copied verbatim.
      confidence: 1,
      // Tier 0 answers typed inputs rather than choices.
      options: [],
      tier: 0,
      // A direct lookup is never an inference.
      inferred: false,
    })
  }

  for (const classification of classifications) {
    const field = fields.get(classification.fieldId)
    const label = field?.label ?? ''

    /*
      A stored fact answers the field, whatever tier the classifier reached for.

      The classifier works from the label alone and knows nothing about what is held, so a
      "Notice period" or a "PAN number" lands in tier 2 and goes to a model to be composed —
      when the user has already typed that answer under that name. Free, instant, and not
      capable of being wrong in the way a composed answer is.

      `matchFact` is asked first because it sees more than `resolveSlot` does: the whole
      catalogue, ranked, plus any bespoke fact whose key names the field. `resolveSlot` remains
      below as the identity-only path, which still covers derived values like a surname split
      out of a full name.

      Choice fields are left out: the answer has to be one of the given options, and picking it
      is a matching problem rather than a lookup. Essays too — a one-line fact is not the three
      paragraphs a tier-3 field is asking for. That leaves tier 0 and tier 2, which is exactly
      the set where a stored string is a complete answer.

      `isAboutApplicant` still governs. A field asking for a referee's phone number must not be
      answered from the user's own facts, and matching on a label makes that easier to trip
      over, not harder.
    */
    const eligible = classification.tier === 0 || classification.tier === 2
    if (eligible && field && isAboutApplicant(`${field.label} ${field.section ?? ''}`)) {
      const matched = matchFact(
        {
          label,
          kind: field.kind,
          ...(field.autocomplete ? { autocomplete: field.autocomplete } : {}),
        },
        { identity, custom },
      )
      if (matched) {
        answer(classification.fieldId, matched.value)
        continue
      }
    }

    if (classification.tier !== 0 || !classification.slot) {
      unresolved.push(classification)
      continue
    }

    const value = resolveSlot(identity, classification.slot)

    if (value === undefined || value === '') {
      // We identified the field but hold no value for it. Escalating to a model would only
      // invite invention — a made-up phone number is worse than an empty field.
      skipped.push({
        fieldId: classification.fieldId,
        reason: 'no_matching_knowledge',
        detail: `No ${classification.slot} in your profile`,
      })
      continue
    }

    answer(classification.fieldId, value)
  }

  return { fills, skipped, unresolved }
}
