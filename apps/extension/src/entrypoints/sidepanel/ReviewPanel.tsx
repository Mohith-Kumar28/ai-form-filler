import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared'
import type { FillPlan } from '../../generated/model/index.js'
import { IconInferred, IconVerified } from './icons.js'

const SKIP_REASON_LABEL: Record<string, string> = {
  no_matching_knowledge: 'Nothing recorded answers this',
  already_filled: 'You had already answered it',
  unsupported_kind: 'Field type not supported yet',
  quota_exhausted: 'Out of forms this month',
  model_error: 'Could not answer',
}

/**
 * What the panel shows after a fill.
 *
 * This exists because the dock's Review button previously opened the panel onto the profile
 * tabs — a button that promised a destination that was never built. The panel *becomes* the
 * review while a result is live; the profile is still there behind one click back.
 *
 * Ordered by what can hurt: judgement calls first (an answer made on the user's behalf),
 * then low confidence, then what was left blank. A blank field cannot be wrong; a confident
 * wrong answer on a job application can.
 */
export function ReviewPanel({ plan, onBack }: { plan: FillPlan; onBack: () => void }) {
  const inferred = plan.fills.filter((f) => f.inferred)
  const unsure = plan.fills.filter((f) => !f.inferred && f.confidence < REVIEW_CONFIDENCE_THRESHOLD)
  const stated = plan.fills.filter(
    (f) => !f.inferred && f.confidence >= REVIEW_CONFIDENCE_THRESHOLD,
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-rule bg-page px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-ink">
            <span className="measure">{plan.fills.length}</span> answers
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-[11.5px] text-faint transition-colors hover:text-ink"
          >
            Back to profile
          </button>
        </div>
        <p className="mt-1 text-[12px] text-muted">
          {inferred.length > 0
            ? `${inferred.length} ${inferred.length === 1 ? 'was a judgement call' : 'were judgement calls'} — check ${inferred.length === 1 ? 'it' : 'them'} before submitting.`
            : 'Every answer came from what you recorded.'}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {inferred.length > 0 && (
          <Section
            title="Judgement calls"
            note="Concluded from what you've recorded, not stated by you."
            tone="annot"
            fills={inferred}
          />
        )}

        {unsure.length > 0 && (
          <Section
            title="Uncertain"
            note="Answered, but the notebook is not confident."
            tone="annot"
            fills={unsure}
          />
        )}

        {stated.length > 0 && (
          <Section
            title="From your profile"
            note="These came straight from what you recorded."
            tone="verified"
            fills={stated}
          />
        )}

        {plan.skipped.length > 0 && (
          <section className="border-t border-rule px-4 py-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              Left blank · {plan.skipped.length}
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {plan.skipped.map((skip) => (
                <li key={skip.fieldId} className="text-[12px] text-muted">
                  {skip.detail ?? SKIP_REASON_LABEL[skip.reason] ?? skip.reason}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="shrink-0 border-t border-rule bg-page px-4 py-2.5">
        <p className="measure text-[11px] text-faint">
          {plan.usage.latencyMs}ms
          {plan.usage.costMicroUsd > 0 && ` · ${(plan.usage.costMicroUsd / 10_000).toFixed(2)}¢`}
          {' · '}
          {plan.quotaRemaining} left
        </p>
      </footer>
    </div>
  )
}

function Section({
  title,
  note,
  tone,
  fills,
}: {
  title: string
  note: string
  tone: 'annot' | 'verified'
  fills: FillPlan['fills']
}) {
  const Icon = tone === 'annot' ? IconInferred : IconVerified

  return (
    <section className="border-t border-rule first:border-t-0">
      <div className="px-4 pb-1 pt-3">
        <h3
          className={`flex items-center gap-1.5 text-[12px] font-semibold ${
            tone === 'annot' ? 'text-annot' : 'text-verified'
          }`}
        >
          <Icon className="size-3.5" />
          {title}
          <span className="measure text-[11px] font-normal text-faint">{fills.length}</span>
        </h3>
        <p className="mt-0.5 text-[11.5px] text-faint">{note}</p>
      </div>

      <ul>
        {fills.map((fill) => (
          <li key={fill.fieldId} className="border-t border-rule-soft px-4 py-2.5">
            {/* The question first — without it an answer is an orphan string. */}
            {fill.label && <p className="text-[11.5px] leading-snug text-faint">{fill.label}</p>}
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink">{fill.value}</p>
            {fill.reasoning && (
              <p className="mt-1 text-[11.5px] italic leading-snug text-muted">{fill.reasoning}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
