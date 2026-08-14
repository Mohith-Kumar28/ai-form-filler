import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared'
import { useState } from 'react'
import type { Account } from '../../generated/model/index.js'
import { STAGE_LABEL, useFill } from '../../lib/use-fill.js'
import { IconInferred, IconPen, IconVerified } from './icons.js'

const SKIP_REASON_LABEL: Record<string, string> = {
  no_matching_knowledge: 'Nothing recorded answers this',
  already_filled: 'Already filled',
  unsupported_kind: 'Field type not supported yet',
  quota_exhausted: 'Out of forms this month',
  model_error: 'Could not answer',
}

/**
 * The fill action and its record.
 *
 * The product's trust rests on one distinction being unmissable: an answer the notebook
 * *observed* (you stated it) versus one it *concluded* (it read you). Those carry different
 * risks, so they get different marks and different words — not one amber "needs review"
 * bucket that flattens them together, which is what the previous panel did.
 */
export function FillPanel({ account }: { account: Account }) {
  const { state, start, reset } = useFill()
  const [highQuality, setHighQuality] = useState(false)

  const outOfQuota = account.quota.used >= account.quota.limit
  const disabled = !account.profileReady || outOfQuota || state.status === 'running'

  const inferred = state.plan?.fills.filter((f) => f.inferred) ?? []
  const unsure =
    state.plan?.fills.filter((f) => !f.inferred && f.confidence < REVIEW_CONFIDENCE_THRESHOLD) ?? []

  if (state.status === 'done' && state.plan) {
    const applied = state.report?.applied.length ?? 0
    const failed = state.report?.failed.length ?? 0

    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="measure text-[11px] uppercase tracking-wide text-faint">Recorded</p>
          <p className="mt-0.5 text-[15px] text-ink">
            <span className="measure font-medium">{applied}</span> of{' '}
            <span className="measure">{state.plan.fills.length}</span> fields filled
          </p>
          <div className="rule-draw mt-2 h-px w-full origin-left bg-verified" />
          <p className="measure mt-1.5 text-[11px] text-faint">
            {state.plan.usage.latencyMs}ms
            {state.plan.usage.costMicroUsd > 0 &&
              ` · ${(state.plan.usage.costMicroUsd / 10_000).toFixed(2)}¢`}
          </p>
        </div>

        {failed > 0 && (
          <p className="text-[12px] text-annot">
            {failed} could not be written — the page may have changed since.
          </p>
        )}

        {inferred.length > 0 && (
          <Group
            title="Judgement calls"
            note="Concluded from what you've recorded, not stated by you."
            tone="annot"
            fills={inferred}
          />
        )}

        {unsure.length > 0 && (
          <Group
            title="Uncertain"
            note="Answered, but the notebook is not confident."
            tone="graphite"
            fills={unsure}
          />
        )}

        {state.plan.skipped.length > 0 && (
          <details className="border-t border-rule pt-2">
            <summary className="cursor-pointer text-[12px] text-muted marker:text-faint">
              {state.plan.skipped.length} left blank
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1">
              {state.plan.skipped.map((skip) => (
                <li key={skip.fieldId} className="text-[11px] text-faint">
                  {skip.detail ?? SKIP_REASON_LABEL[skip.reason] ?? skip.reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        <button
          type="button"
          onClick={reset}
          className="w-full rounded-sharp border border-rule py-2 text-[12px] text-muted transition-colors hover:border-pen hover:text-pen"
        >
          Fill again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {state.status === 'idle' && account.profileReady && (
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={highQuality}
            onChange={(e) => setHighQuality(e.target.checked)}
            className="size-3.5 accent-[var(--color-pen)]"
          />
          Take more care with written answers
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => start({ quality: highQuality ? 'high' : 'auto', overwriteExisting: false })}
        className="flex w-full items-center justify-center gap-2 rounded-sharp bg-pen py-2.5 text-[13px] font-medium text-page transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {state.status === 'running' ? (
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-page" aria-hidden />
            {STAGE_LABEL[state.stage ?? 'detecting'] ?? 'Working'}
          </>
        ) : (
          <>
            <IconPen className="size-4" />
            Fill this page
          </>
        )}
      </button>

      {state.status === 'error' && (
        <p className="text-[12px] text-annot" role="alert">
          {state.error?.message}
        </p>
      )}

      {!account.profileReady && (
        <p className="text-center text-[11px] text-faint">Record something first</p>
      )}
      {outOfQuota && account.profileReady && (
        <p className="text-center text-[11px] text-annot">
          Out of forms until {new Date(account.quota.resetsAt).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

function Group({
  title,
  note,
  tone,
  fills,
}: {
  title: string
  note: string
  tone: 'annot' | 'graphite'
  fills: { fieldId: string; value: string; reasoning?: string }[]
}) {
  const Icon = tone === 'annot' ? IconInferred : IconVerified

  return (
    <section>
      <h3
        className={`flex items-center gap-1.5 text-[12px] font-medium ${
          tone === 'annot' ? 'text-annot' : 'text-muted'
        }`}
      >
        <Icon className="size-3.5" />
        {title}
        <span className="measure text-[11px] font-normal text-faint">{fills.length}</span>
      </h3>
      <p className="mt-0.5 text-[11px] text-faint">{note}</p>

      <ul className="mt-1.5">
        {fills.map((fill) => (
          <li key={fill.fieldId} className="border-t border-rule py-2">
            <p className="text-[12px] leading-snug text-ink">{fill.value}</p>
            {fill.reasoning && (
              <p className="mt-1 text-[11px] italic leading-snug text-faint">{fill.reasoning}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
