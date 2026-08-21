/**
 * The panel's editor over the fact catalogue.
 *
 * The catalogue itself, and the matcher that decides which fact answers a form field, moved to
 * `@aff/shared/facts` — both the panel and the Worker's tier 0 need them, and while there were
 * two copies the two paths disagreed. See the note at the top of that file.
 *
 * What is left here is the half only the editor wants: folding the stored profile into one row
 * per fact, and turning edits back into a PATCH.
 *
 * The subpath import is deliberate. `@aff/shared` pulls in the Zod schemas and took this
 * bundle from 11 kB to 93 kB; `@aff/shared/facts` imports nothing at runtime beyond itself.
 */

import type { Identity } from '@aff/shared'
import type { CatalogField, FactSection } from '@aff/shared/facts'
import { CATALOG, FIELDS_BY_SECTION, fieldFor } from '@aff/shared/facts'

export type {
  CatalogField,
  FactMatch,
  FactSection,
  FactStore,
  KnownFacts,
  SectionMeta,
} from '@aff/shared/facts'
export {
  CATALOG,
  CATALOG_INDEX,
  FIELDS_BY_SECTION,
  factValue,
  fieldFor,
  matchFact,
  normaliseKey,
  SECTIONS,
} from '@aff/shared/facts'

export interface ReconciledProfile {
  /** Canonical catalogue key → value. Only keys that had a source value are present. */
  values: Record<string, string>
  /** `custom` keys matching no catalogue field, in the casing the user typed. */
  extras: Record<string, string>
  /**
   * Link platforms folded into a canonical spelling, in the casing they were stored under.
   *
   * These have to be sent back as explicit `''` deletions. `identity.links` is merged field by
   * field on the server (`updateStructured`), not replaced, so writing the canonical key alone
   * leaves the variant behind — and `reconcile` finds it again on the next load, folds it again,
   * and reports the same repair forever. An empty string is how the wire schema says "deleted";
   * `pruneLinks` drops the key.
   */
  droppedLinks: string[]
  /** `links` platforms matching no catalogue field, in the casing they were stored under. */
  extraLinks: Record<string, string>
  /**
   * Keys that collided with another spelling of the same field and will not survive the next
   * save, so the screen can say `Merged 2 duplicate fields` rather than silently rewriting
   * what the user thought they had. A lone key under a non-canonical spelling is not listed:
   * there was never a second row to merge.
   */
  merged: string[]
}

interface Source {
  raw: string
  value: string
  /** A value read from the field's own canonical store outranks one read from anywhere else. */
  canonical: boolean
}

/**
 * Folds a profile into catalogue slots, merging everything that means the same thing.
 *
 * Precedence, when two source keys land on one field: a non-empty value beats an empty one;
 * between two non-empty values the canonical store wins (`identity.email` over a hand-typed
 * `custom["Email"]`), because the canonical one is the value the fill path actually reads.
 * Ties break on the sorted raw key so the result never depends on object insertion order.
 */
export function reconcile(input: {
  // `Partial` because the generated wire type makes `links` optional where the schema gives it
  // a default. Widening here beats a cast at every call site.
  identity?: Partial<Identity>
  custom?: Record<string, string>
}): ReconciledProfile {
  const identity = input.identity ?? { links: {} }
  const custom = input.custom ?? {}

  const candidates = new Map<string, Source[]>()
  const extras: Record<string, string> = {}
  const extraLinks: Record<string, string> = {}
  const droppedLinks: string[] = []
  const merged: string[] = []

  const offer = (field: CatalogField, raw: string, value: string, canonical: boolean) => {
    const list = candidates.get(field.key)
    if (list) list.push({ raw, value, canonical })
    else candidates.set(field.key, [{ raw, value, canonical }])
  }

  // The typed identity fields. Their key *is* canonical, so there is nothing to resolve here.
  for (const field of CATALOG) {
    if (field.store !== 'identity') continue
    const value = (identity as Record<string, unknown>)[field.key]
    if (typeof value === 'string') offer(field, field.key, value, true)
  }

  // Link platforms are free-form strings — the ingest pass gets `platform` straight from a
  // model — so this is where `"LinkedIn"` next to `"linkedin"` became two permanent rows.
  for (const raw of Object.keys(identity.links ?? {}).sort()) {
    const value = identity.links?.[raw] ?? ''
    const field = fieldFor(raw)
    if (field?.store === 'link') {
      offer(field, raw, value, raw === field.key)
      // Recorded whether or not anything collided: a lone variant spelling is a rename, and a
      // rename that does not delete the old key is not a rename.
      if (raw !== field.key) droppedLinks.push(raw)
    } else extraLinks[raw] = value
  }

  // Whatever the user typed themselves. A key here may name a catalogue field of any store —
  // somebody who adds a fact called "Email" means the email field, not a second one.
  for (const raw of Object.keys(custom).sort()) {
    const value = custom[raw] ?? ''
    const field = fieldFor(raw)
    if (field) offer(field, raw, value, field.store === 'custom' && raw === field.key)
    else extras[raw] = value
  }

  const values: Record<string, string> = {}
  for (const [key, sources] of candidates) {
    const winner = sources.reduce((best, next) => {
      const bestFilled = best.value.trim() !== ''
      const nextFilled = next.value.trim() !== ''
      if (bestFilled !== nextFilled) return bestFilled ? best : next
      if (best.canonical !== next.canonical) return best.canonical ? best : next
      return best.raw <= next.raw ? best : next
    })
    values[key] = winner.value
    // Only a genuine collision is reported. One key under a non-canonical spelling is a
    // silent rename — there was never a second row, so there is nothing to tell the user.
    if (sources.length > 1) {
      for (const source of sources) if (source.raw !== key) merged.push(source.raw)
    }
  }

  return {
    values,
    extras,
    extraLinks,
    droppedLinks: [...new Set(droppedLinks)].sort(),
    merged: [...new Set(merged)].sort(),
  }
}

/**
 * The inverse: catalogue slots back into a `ProfilePatch` body.
 *
 * Two asymmetries, both deliberate.
 *
 * An empty **catalogue** `custom` field is omitted rather than stored as `""`. Nobody created
 * those rows — the catalogue did — and an empty one is not a fact. Storing it would also spend
 * one of the user's `PLAN_FACT_LIMITS` on nothing.
 *
 * An empty **extra** is kept. The user made that row on purpose; it disappears when they press
 * remove, not when they clear the box they are still typing in.
 */
export function toPatch(reconciled: {
  values: Record<string, string>
  extras: Record<string, string>
  extraLinks: Record<string, string>
  droppedLinks?: string[]
}): { identity: Identity; custom: Record<string, string> } {
  const identity: Record<string, unknown> = {}
  const links: Record<string, string> = {}
  const custom: Record<string, string> = {}

  for (const field of CATALOG) {
    const value = reconciled.values[field.key]
    if (value === undefined) continue
    if (field.store === 'identity') identity[field.key] = value
    else if (field.store === 'link') links[field.key] = value
    else if (value.trim() !== '') custom[field.key] = value
  }

  for (const [key, value] of Object.entries(reconciled.extraLinks)) links[key] = value
  for (const [key, value] of Object.entries(reconciled.extras)) custom[key] = value

  /*
   * Variant spellings are deleted explicitly, after the canonical keys are set.
   *
   * `updateStructured` merges `identity.links` key by key rather than replacing it, so a fold that
   * only writes the winner leaves the loser in place — and the next load folds it again. `''` is
   * the schema's "cleared", and `pruneLinks` turns that into a removed key. Guarded so a variant
   * that is somehow also a canonical key cannot delete the value we just wrote.
   */
  for (const key of reconciled.droppedLinks ?? []) {
    if (!(key in links)) links[key] = ''
  }

  identity.links = links
  return { identity: identity as Identity, custom }
}

/** Fields in a section that have a value, over the total. Drives each section's counter. */
export function sectionProgress(
  section: FactSection,
  reconciled: { values: Record<string, string>; extras: Record<string, string> },
): { filled: number; total: number } {
  if (section === 'extra') {
    const keys = Object.keys(reconciled.extras)
    return { filled: keys.filter((k) => reconciled.extras[k]?.trim()).length, total: keys.length }
  }
  const fields = FIELDS_BY_SECTION[section]
  return {
    filled: fields.filter((f) => reconciled.values[f.key]?.trim()).length,
    total: fields.length,
  }
}

/** Every catalogue field carrying a value, plus every extra. What the fill path can answer. */
export function factCount(reconciled: {
  values: Record<string, string>
  extras: Record<string, string>
  extraLinks: Record<string, string>
}): number {
  const patch = toPatch(reconciled)
  const identityFilled = CATALOG.filter(
    (f) => f.store === 'identity' && patch.identity[f.key as keyof Identity],
  ).length
  const linksFilled = Object.values(patch.identity.links ?? {}).filter((v) => v.trim()).length
  const customFilled = Object.values(patch.custom).filter((v) => v.trim()).length
  return identityFilled + linksFilled + customFilled
}

/**
 * `custom` keys only — what `PLAN_FACT_LIMITS` is actually measured against.
 *
 * The previous screen counted identity fields and links into the same total while the server
 * counted only `custom` (`routes/profile.ts`), so a free-tier user saw "10 of 10 — Upgrade"
 * with zero facts of their own.
 */
export function customFactCount(reconciled: {
  values: Record<string, string>
  extras: Record<string, string>
  extraLinks: Record<string, string>
}): number {
  return Object.keys(toPatch(reconciled).custom).length
}

/** `••••3210` — enough tail to recognise the value, not enough to read it over a shoulder. */
export function maskValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length)
  return `${'•'.repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`
}
