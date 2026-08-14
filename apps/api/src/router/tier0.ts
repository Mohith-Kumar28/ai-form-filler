import type { Fill, Identity, Skip } from '@aff/shared'
import type { Classification, IdentitySlot } from './classify.js'

/**
 * Answers identity fields directly from the stored profile, with no model call.
 *
 * Every field resolved here costs nothing and cannot hallucinate — the value is exactly what
 * the user typed or what was parsed from their own resume. This is why keeping the identity
 * section well-populated matters more than any model choice.
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
  /** fieldId → question text, so each fill can describe itself to the review UI. */
  labels: Map<string, string> = new Map(),
): Tier0Result {
  const fills: Fill[] = []
  const skipped: Skip[] = []
  const unresolved: Classification[] = []

  for (const classification of classifications) {
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

    fills.push({
      fieldId: classification.fieldId,
      label: labels.get(classification.fieldId) ?? '',
      value,
      // Certain: this is the user's own stored value, copied verbatim.
      confidence: 1,
      // Tier 0 answers identity fields, which are typed inputs rather than choices.
      options: [],
      tier: 0,
      // A direct lookup is never an inference.
      inferred: false,
    })
  }

  return { fills, skipped, unresolved }
}
