import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared'
import { useState } from 'react'
import type { Account } from '../../generated/model/index.js'
import { STAGE_LABEL, useFill } from '../../lib/use-fill.js'

const SKIP_REASON_LABEL: Record<string, string> = {
  no_matching_knowledge: 'Nothing in your profile answers this',
  already_filled: 'Already filled',
  unsupported_kind: 'This field type is not supported yet',
  quota_exhausted: 'Out of forms this month',
  model_error: 'The model could not answer this',
}

/**
 * The fill trigger and its result summary.
 *
 * No page overlay yet — that is phase 4. Driving everything from the panel first is
 * deliberate: it proves the pipeline and produces real cost numbers before any of the
 * presentation layer is built on top of it.
 */
export function FillPanel({ account }: { account: Account }) {
  const { state, start, reset } = useFill()
  const [highQuality, setHighQuality] = useState(false)

  const outOfQuota = account.quota.used >= account.quota.limit
  const disabled = !account.profileReady || outOfQuota || state.status === 'running'

  const needsReview =
    state.plan?.fills.filter((f) => f.confidence < REVIEW_CONFIDENCE_THRESHOLD) ?? []

  return (
    <div className="flex flex-col gap-2">
      {state.status === 'idle' && (
        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
          <input
            type="checkbox"
            checked={highQuality}
            onChange={(e) => setHighQuality(e.target.checked)}
            className="size-3.5 accent-[var(--color-accent)]"
          />
          Best quality — slower and uses a stronger model for written answers
        </label>
      )}

      {state.status !== 'done' && (
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            start({ quality: highQuality ? 'high' : 'auto', overwriteExisting: false })
          }
          title={
            !account.profileReady
              ? 'Add at least one source before filling a form'
              : outOfQuota
                ? 'You have used this month’s forms'
                : undefined
          }
          className="w-full rounded-md bg-accent py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {state.status === 'running'
            ? (STAGE_LABEL[state.stage ?? 'detecting'] ?? 'Working…')
            : 'Fill this page'}
        </button>
      )}

      {state.status === 'error' && (
        <p className="text-xs text-review" role="alert">
          {state.error?.message}
        </p>
      )}

      {state.status === 'done' && state.plan && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-line bg-surface-raised p-3">
            <p className="text-sm font-medium">
              Filled {state.report?.applied.length ?? 0} of {state.plan.fills.length} fields
            </p>

            {/* Distinct from a skip: we produced an answer, the page refused it. */}
            {(state.report?.failed.length ?? 0) > 0 && (
              <p className="mt-1 text-xs text-review">
                {state.report?.failed.length} could not be written — the page may have changed.
              </p>
            )}

            {needsReview.length > 0 && (
              <p className="mt-1 text-xs text-review">
                {needsReview.length} answer{needsReview.length === 1 ? '' : 's'} need
                {needsReview.length === 1 ? 's' : ''} a look before you submit.
              </p>
            )}

            {state.plan.usage.costMicroUsd > 0 && (
              <p className="mt-1 text-[11px] text-ink-muted">
                {state.plan.usage.latencyMs}ms ·{' '}
                {(state.plan.usage.costMicroUsd / 10_000).toFixed(2)}¢
                {state.plan.usage.cacheReadTokens > 0 && ' · cached'}
              </p>
            )}
          </div>

          {needsReview.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {needsReview.map((fill) => (
                <li
                  key={fill.fieldId}
                  className="flex gap-2 rounded-md border border-line bg-surface-raised px-3 py-2"
                >
                  {/* Same status-dot idiom as SourceList — one visual language for
                      "needs attention" across the panel. */}
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-review" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs">{fill.value}</p>
                    {fill.reasoning && (
                      <p className="mt-0.5 text-[11px] text-ink-muted">{fill.reasoning}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {state.plan.skipped.length > 0 && (
            <details className="rounded-md border border-line px-3 py-2">
              <summary className="cursor-pointer text-xs text-ink-muted">
                {state.plan.skipped.length} field
                {state.plan.skipped.length === 1 ? '' : 's'} left blank
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1">
                {state.plan.skipped.map((skip) => (
                  <li key={skip.fieldId} className="text-[11px] text-ink-muted">
                    {skip.detail ?? SKIP_REASON_LABEL[skip.reason] ?? skip.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-md border border-line py-1.5 text-xs text-ink-muted transition-colors hover:bg-line hover:text-ink"
          >
            Fill again
          </button>
        </div>
      )}

      {!account.profileReady && (
        <p className="text-center text-[11px] text-ink-muted">Add a source to enable filling</p>
      )}
    </div>
  )
}
