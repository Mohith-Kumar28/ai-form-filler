import type { Identity } from '@aff/shared'
import type { CatalogField } from '../lib/fact-catalog.js'
import { CATALOG } from '../lib/fact-catalog.js'

/**
 * Instant inline suggestions: matching a focused field against what we already know, so a
 * name or an email can be filled with no model call at all.
 *
 * This is deliberately conservative. The full fill path (the launcher, or a field-scoped
 * request) still runs the tier router with all the context it needs; this is only the
 * zero-latency fast path for the obvious cases. A wrong suggestion on a job application is
 * worse than no suggestion, so every rule requires a reasonably specific signal.
 *
 * The rules are **derived from `fact-catalog.ts`** rather than hand-written here. There used to
 * be two lists — twelve rules in this file and seven fields in the editor — and a fact you
 * could type into the panel was not necessarily a fact this could recognise on a page. Now
 * anything in the catalogue with a `match` block is matchable, which is why a PAN number or a
 * current employer now gets an instant local answer and previously did not.
 */

export interface KnownFacts {
  identity: Identity
  custom: Record<string, string>
}

/** Which field kinds can take a free-text suggestion. Choices must match their options. */
const SUGGESTABLE_KINDS = new Set(['text', 'longtext', 'email', 'tel', 'url'])

function firstWord(fullName?: string): string | undefined {
  return fullName?.trim().split(/\s+/)[0]
}

function lastWord(fullName?: string): string | undefined {
  const parts = fullName?.trim().split(/\s+/) ?? []
  return parts.length > 1 ? parts[parts.length - 1] : undefined
}

/**
 * Values a form asks for separately but nobody stores separately.
 *
 * A blank "First name" row in the panel is correct, not missing data — most people type one
 * full name and expect the halves to follow. These run only when the stored field is empty, so
 * an explicitly typed override always wins.
 */
const DERIVED: Record<string, (facts: KnownFacts) => string | undefined> = {
  'First name': (f) => f.identity.preferredName || firstWord(f.identity.fullName),
  'Last name': (f) => lastWord(f.identity.fullName),
}

function factValue(field: CatalogField, facts: KnownFacts): string | undefined {
  const stored =
    field.store === 'identity'
      ? ((facts.identity as Record<string, unknown>)[field.key] as string | undefined)
      : field.store === 'link'
        ? facts.identity.links?.[field.key]
        : facts.custom[field.key]

  if (stored?.trim()) return stored.trim()
  return DERIVED[field.key]?.(facts)?.trim() || undefined
}

/**
 * Matchable catalogue fields, in rank order.
 *
 * Rank, not array order. Matching is a first-hit substring test, so the label "Email address"
 * contains both `email` and `address` and only rank decides which fact answers it — see the
 * note on `match.rank` in the catalogue.
 */
const RULES: CatalogField[] = CATALOG.filter((field) => field.match).sort(
  (a, b) => (a.match?.rank ?? 0) - (b.match?.rank ?? 0),
)

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
  if (ac === 'off' || ac === 'one-time-code') return null
  const label = field.label.toLowerCase().trim()

  // A native autocomplete token is the strongest signal — trust it before label guessing.
  if (ac) {
    for (const rule of RULES) {
      if (rule.match?.autocomplete?.includes(ac)) {
        const value = factValue(rule, facts)
        if (value) return { label: rule.label, value }
      }
    }
  }

  // Then a whole-label match, for words too short or too common to test as substrings.
  for (const rule of RULES) {
    if (rule.match?.exact?.includes(label)) {
      const value = factValue(rule, facts)
      if (value) return { label: rule.label, value }
    }
  }

  // Then label keywords, in rank order.
  for (const rule of RULES) {
    if (rule.match?.keywords?.some((keyword) => label.includes(keyword))) {
      const value = factValue(rule, facts)
      if (value) return { label: rule.label, value }
    }
  }

  // Finally, typed facts the catalogue does not know: the field label names the fact
  // ("notice period"). The label shown is the user's own, because that is what they called it.
  for (const [key, value] of Object.entries(facts.custom)) {
    const k = key.trim().toLowerCase()
    if (!value.trim() || k.length < 4) continue
    if (label.includes(k) || k.includes(label)) {
      return { label: key, value: value.trim() }
    }
  }

  return null
}
