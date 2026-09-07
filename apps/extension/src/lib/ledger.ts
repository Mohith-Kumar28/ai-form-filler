/**
 * The ledger: what the panel says about the form on the page, before and after a fill.
 *
 * Before a fill the page is a list of questions and the honest thing to say about each one is
 * what will happen when Fill is pressed — copied in from a saved detail, written by the model,
 * or left alone because it already has an answer. After a fill the same list becomes the
 * receipt: what was written from saved details, what was a judgement call that wants a look,
 * and what stayed blank and why.
 *
 * Pure functions over the shared contract, so the grouping can be tested without a browser and
 * the screen that renders it stays a renderer.
 */

import type { ApplyReport, FieldSchema, FillPlan, FormSchema } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { CATALOG, type CatalogField, type KnownFacts, matchFact } from '@aff/shared/facts'
import type { ReviewDraft, Verdict } from './review-store.js'

/* ── Before a fill ─────────────────────────────────────────────────────────── */

export type PreviewStatus = 'known' | 'write' | 'answered'

export interface PreviewRow {
  fieldId: string
  label: string
  kind: FieldSchema['kind']
  status: PreviewStatus
  /** `known`: the saved value that will be copied in. `answered`: what is already there. */
  value?: string
  /**
   * The catalogue field this question is asking for, when it asks for one nothing is saved
   * under. Rendered as an inline "Add" so the form itself tells the person what to save.
   */
  expected?: CatalogField
}

export interface Preview {
  known: PreviewRow[]
  write: PreviewRow[]
  answered: PreviewRow[]
  total: number
}

/** Same kinds `matchFact` will answer from a saved value. Choices are matched against options. */
const MATCHABLE = new Set(['text', 'longtext', 'email', 'tel', 'url', 'number', 'date'])

const RULES: CatalogField[] = CATALOG.filter((field) => field.match).sort(
  (a, b) => (a.match?.rank ?? 0) - (b.match?.rank ?? 0),
)

/**
 * Which catalogue field a form field is asking for, whether or not anything is saved there.
 *
 * `matchFact` answers the narrower question — which *saved value* fits — and skips a rule whose
 * value is empty. This is the rule the label would resolve to, so the panel can offer to save
 * a detail the form wants and nothing on file answers. Same order as the matcher: the
 * `autocomplete` token first, then whole-label equality, then keywords by rank.
 */
export function expectedFact(field: {
  label: string
  autocomplete?: string
  kind: string
}): CatalogField | null {
  if (!MATCHABLE.has(field.kind)) return null
  const ac = (field.autocomplete ?? '').toLowerCase()
  if (ac === 'off' || ac === 'one-time-code') return null
  const label = field.label.toLowerCase().trim()
  if (!label && !ac) return null

  if (ac) {
    const byToken = RULES.find((rule) => rule.match?.autocomplete?.includes(ac))
    if (byToken) return byToken
  }
  const exact = RULES.find((rule) => rule.match?.exact?.includes(label))
  if (exact) return exact
  return (
    RULES.find((rule) => rule.match?.keywords?.some((keyword) => label.includes(keyword))) ?? null
  )
}

/** Mirrors `hasAnswer` in the shared form module without pulling the zod schema in with it. */
const DIAL_CODE_ONLY = /^\+[\s()\-.]*\d{0,4}[\s()\-.]*$/

function hasAnswer(field: { kind?: string; currentValue?: string | undefined }): boolean {
  const value = field.currentValue?.trim()
  if (!value) return false
  if (field.kind === 'tel' && DIAL_CODE_ONLY.test(value)) return false
  return true
}

export function buildPreview(form: FormSchema, facts: KnownFacts | null): Preview {
  const preview: Preview = { known: [], write: [], answered: [], total: form.fields.length }

  for (const field of form.fields) {
    const base = { fieldId: field.id, label: field.label || 'Untitled field', kind: field.kind }

    if (hasAnswer(field)) {
      preview.answered.push({ ...base, status: 'answered', value: field.currentValue })
      continue
    }

    const match = facts ? matchFact(field, facts) : null
    if (match) {
      preview.known.push({ ...base, status: 'known', value: match.value })
      continue
    }

    const expected = expectedFact(field)
    preview.write.push(
      expected ? { ...base, status: 'write', expected } : { ...base, status: 'write' },
    )
  }

  return preview
}

/* ── After a fill ──────────────────────────────────────────────────────────── */

type Fill = FillPlan['fills'][number]

/** A judgement call: an inference, or an answer the model was not sure of. */
export function isJudged(fill: Pick<Fill, 'inferred' | 'confidence'>): boolean {
  return fill.inferred || fill.confidence < REVIEW_CONFIDENCE_THRESHOLD
}

export interface ResultRow {
  fieldId: string
  label: string
  /** What is on the page now — the verdict's value once one has been given. */
  value: string
  inferred: boolean
  confidence: number
  tier: Fill['tier']
  verdict: Verdict
  /** The page would not take the value. Nothing was written there. */
  refused: boolean
}

export interface BlankRow {
  fieldId: string
  label: string
  reason: string
}

export interface Result {
  /** Fields that now hold a value the fill wrote. */
  written: number
  /** Judgement calls, most doubtful first. */
  check: ResultRow[]
  /** Still waiting for a verdict. */
  open: ResultRow[]
  /** Copied from saved details, or answered with confidence. */
  stated: ResultRow[]
  blank: BlankRow[]
  refused: number
}

export const BLANK_REASON: Record<string, string> = {
  no_matching_knowledge: 'Nothing on file answers this',
  already_filled: 'Already had an answer',
  unsupported_kind: 'This kind of field cannot be filled',
  quota_exhausted: 'Out of fields for this month',
  model_error: 'Could not be answered',
}

export function buildResult(
  plan: FillPlan,
  report: ApplyReport | undefined,
  draft: ReviewDraft,
  form: FormSchema | null | undefined,
): Result {
  const refusedIds = new Set(report?.failed ?? [])
  const labels = new Map((form?.fields ?? []).map((field) => [field.id, field.label]))

  const toRow = (fill: Fill): ResultRow => ({
    fieldId: fill.fieldId,
    label: fill.label || labels.get(fill.fieldId) || 'Untitled field',
    value: draft.values[fill.fieldId] ?? fill.value,
    inferred: fill.inferred,
    confidence: fill.confidence,
    tier: fill.tier,
    verdict: draft.verdicts[fill.fieldId] ?? 'open',
    refused: refusedIds.has(fill.fieldId),
  })

  const check = plan.fills
    .filter(isJudged)
    .map(toRow)
    .sort((a, b) => (a.inferred === b.inferred ? a.confidence - b.confidence : a.inferred ? -1 : 1))
  const stated = plan.fills.filter((fill) => !isJudged(fill)).map(toRow)

  return {
    written: plan.fills.length - refusedIds.size,
    check,
    open: check.filter((row) => row.verdict === 'open' && !row.refused),
    stated,
    blank: plan.skipped.map((skip) => ({
      fieldId: skip.fieldId,
      label: labels.get(skip.fieldId) || 'Untitled field',
      reason: skip.detail ?? BLANK_REASON[skip.reason] ?? 'Left blank',
    })),
    refused: refusedIds.size,
  }
}
