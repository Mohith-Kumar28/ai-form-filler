import type { Identity } from '@aff/shared'

/**
 * Instant inline suggestions: matching a focused field against what we already know, so a
 * name or an email can be filled with no model call at all.
 *
 * This is deliberately conservative. The full fill path (the launcher, or a field-scoped
 * request) still runs the tier router with all the context it needs; this is only the
 * zero-latency fast path for the obvious cases. A wrong suggestion on a job application is
 * worse than no suggestion, so every rule requires a reasonably specific signal.
 */

export interface KnownFacts {
  identity: Identity
  custom: Record<string, string>
}

/** Which field kinds can take a free-text suggestion. Choices must match their options. */
const SUGGESTABLE_KINDS = new Set(['text', 'longtext', 'email', 'tel', 'url'])

interface Rule {
  label: string
  value: (facts: KnownFacts) => string | undefined
  keywords: string[]
  autocomplete?: string[]
}

function firstName(fullName?: string): string | undefined {
  return fullName?.trim().split(/\s+/)[0]
}

function lastName(fullName?: string): string | undefined {
  const parts = fullName?.trim().split(/\s+/) ?? []
  return parts.length > 1 ? parts[parts.length - 1] : undefined
}

const RULES: Rule[] = [
  {
    label: 'Email',
    value: (f) => f.identity.email || undefined,
    keywords: ['email', 'e-mail'],
    autocomplete: ['email'],
  },
  {
    label: 'Phone',
    value: (f) => f.identity.phone,
    keywords: ['phone', 'mobile', 'telephone', 'cell'],
    autocomplete: ['tel', 'tel-national'],
  },
  {
    label: 'Full name',
    value: (f) => f.identity.fullName,
    keywords: ['full name', 'legal name'],
    autocomplete: ['name'],
  },
  {
    label: 'First name',
    value: (f) => f.identity.preferredName || firstName(f.identity.fullName),
    keywords: ['first name', 'given name'],
    autocomplete: ['given-name'],
  },
  {
    label: 'Last name',
    value: (f) => lastName(f.identity.fullName),
    keywords: ['last name', 'surname', 'family name'],
    autocomplete: ['family-name'],
  },
  {
    label: 'Preferred name',
    value: (f) => f.identity.preferredName,
    keywords: ['preferred name', 'nickname', 'goes by'],
  },
  {
    label: 'Location',
    value: (f) => f.identity.location,
    keywords: ['location', 'city', 'town', 'where are you', 'address'],
    autocomplete: ['address-level2', 'street-address'],
  },
  {
    label: 'Pronouns',
    value: (f) => f.identity.pronouns,
    keywords: ['pronouns'],
  },
  {
    label: 'Work authorization',
    value: (f) => f.identity.workAuthorization,
    keywords: ['work authori', 'authorised to work', 'authorized to work', 'visa', 'sponsorship'],
  },
  {
    label: 'LinkedIn',
    value: (f) => f.identity.links?.linkedin || undefined,
    keywords: ['linkedin'],
  },
  {
    label: 'GitHub',
    value: (f) => f.identity.links?.github || undefined,
    keywords: ['github'],
  },
  {
    label: 'Website',
    value: (f) => f.identity.links?.website || undefined,
    keywords: ['website', 'portfolio', 'personal site'],
  },
]

export interface Suggestion {
  label: string
  value: string
}

export function suggestForField(
  field: { label: string; autocomplete?: string; kind: string },
  facts: KnownFacts,
): Suggestion | null {
  if (!SUGGESTABLE_KINDS.has(field.kind)) return null

  const ac = (field.autocomplete ?? '').toLowerCase()
  const label = field.label.toLowerCase().trim()

  // A native autocomplete token is the strongest signal — trust it before label guessing.
  if (ac) {
    for (const rule of RULES) {
      if (rule.autocomplete?.includes(ac)) {
        const value = rule.value(facts)
        if (value) return { label: rule.label, value }
      }
    }
  }

  // Then label keywords, most specific rules first.
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => label.includes(kw))) {
      const value = rule.value(facts)
      if (value) return { label: rule.label, value }
    }
  }

  // Finally, typed facts: the field label names the fact ("notice period").
  for (const [key, value] of Object.entries(facts.custom)) {
    const k = key.trim().toLowerCase()
    if (!value.trim() || k.length < 4) continue
    if (label.includes(k) || k.includes(label)) {
      return { label: key, value: value.trim() }
    }
  }

  return null
}
