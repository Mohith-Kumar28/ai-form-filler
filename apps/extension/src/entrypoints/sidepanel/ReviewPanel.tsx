import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { improveAnswer } from '../../generated/endpoints/fill/fill.js'
import type { FillPlan } from '../../generated/model/index.js'
import { sendMessage } from '../../lib/messaging.js'

/**
 * The review: one question, one answer, one score, per card.
 *
 * The previous version was a list of values grouped by our own internal categories, which
 * meant the user had to reconstruct which question each answer belonged to — and for choice
 * questions there was no way to see what the options had even been. A review you cannot act
 * on from is a report, so every card here can be accepted, rewritten, or cleared, and a
 * rewrite goes to memory so the next form starts closer to right.
 */

const STYLES = [
  { key: 'professional', label: 'More formal' },
  { key: 'simpler', label: 'Simpler' },
  { key: 'shorter', label: 'Shorter' },
  { key: 'detailed', label: 'More detail' },
] as const

type Verdict = 'pending' | 'kept' | 'edited' | 'cleared'

interface Row {
  fieldId: string
  label: string
  value: string
  confidence: number
  inferred: boolean
  options: string[]
  reasoning?: string
}

/** Green / amber / red, by how much the answer is worth a second look. */
function scoreTone(confidence: number, inferred: boolean): { text: string; ring: string } {
  if (inferred || confidence < 0.5) return { text: 'text-annot', ring: 'border-annot/50' }
  if (confidence < REVIEW_CONFIDENCE_THRESHOLD)
    return { text: 'text-amber', ring: 'border-amber/50' }
  return { text: 'text-verified', ring: 'border-rule' }
}

export function ReviewPanel({ plan, onBack }: { plan: FillPlan; onBack: () => void }) {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [values, setValues] = useState<Record<string, string>>({})

  const rows: Row[] = plan.fills.map((f) => ({
    fieldId: f.fieldId,
    label: f.label ?? '',
    value: f.value,
    confidence: f.confidence,
    inferred: f.inferred ?? false,
    options: f.options ?? [],
    ...(f.reasoning ? { reasoning: f.reasoning } : {}),
  }))

  // Least certain first: the whole point of the screen is to spend attention where it pays.
  const ordered = [...rows].sort(
    (a, b) => Number(b.inferred) - Number(a.inferred) || a.confidence - b.confidence,
  )

  const unresolved = rows.filter(
    (r) =>
      (r.inferred || r.confidence < REVIEW_CONFIDENCE_THRESHOLD) &&
      (verdicts[r.fieldId] ?? 'pending') === 'pending',
  ).length

  async function resolve(row: Row, next: string, verdict: Verdict) {
    setVerdicts((v) => ({ ...v, [row.fieldId]: verdict }))
    setValues((v) => ({ ...v, [row.fieldId]: next }))

    await sendMessage({ type: 'review/write', fieldId: row.fieldId, value: next })

    /**
     * Only a rewrite teaches. Clearing says the answer was wrong without saying what is
     * right, and putting "this was wrong" into the same index the next answer is retrieved
     * from would make later answers worse rather than better.
     */
    if (verdict === 'edited') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await sendMessage({
        type: 'feedback/submit',
        payload: {
          origin: tab?.url ? new URL(tab.url).origin : '',
          entries: [{ label: row.label, proposed: row.value, accepted: next, edited: true }],
        },
      })
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ground">
      <header className="shrink-0 border-b border-rule bg-page px-4 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink">
            {unresolved > 0 ? (
              <>
                <span className="measure">{unresolved}</span> worth checking
              </>
            ) : (
              'All answers look settled'
            )}
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-[11.5px] text-faint transition-colors hover:text-ink"
          >
            Done
          </button>
        </div>
        <p className="measure mt-0.5 text-[10.5px] text-faint">
          {rows.length} answered
          {plan.skipped.length > 0 && ` · ${plan.skipped.length} blank`}
          {` · ${(plan.usage.latencyMs / 1000).toFixed(1)}s`}
          {plan.usage.costMicroUsd > 0 && ` · ${(plan.usage.costMicroUsd / 10_000).toFixed(2)}¢`}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-2">
          {ordered.map((row) => (
            <AnswerCard
              key={row.fieldId}
              row={row}
              verdict={verdicts[row.fieldId] ?? 'pending'}
              value={values[row.fieldId] ?? row.value}
              onResolve={resolve}
            />
          ))}
        </ul>

        {plan.skipped.length > 0 && (
          <details className="mt-3 px-1">
            <summary className="cursor-pointer text-[11.5px] text-faint marker:text-faint">
              {plan.skipped.length} left blank
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1">
              {plan.skipped.map((skip) => (
                <li key={skip.fieldId} className="text-[11px] leading-snug text-faint">
                  {skip.detail ?? 'Nothing recorded answers this'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}

/**
 * One question as one card.
 *
 * Choice questions show their options with the selected one marked, because "Notion" tells
 * you nothing about whether the right answer was even available — and picking a different
 * option is one tap rather than retyping a string that has to match exactly.
 */
function AnswerCard({
  row,
  verdict,
  value,
  onResolve,
}: {
  row: Row
  verdict: Verdict
  value: string
  onResolve: (row: Row, next: string, verdict: Verdict) => void
}) {
  const [draft, setDraft] = useState(value)
  const [showStyles, setShowStyles] = useState(false)

  const dirty = draft.trim() !== value.trim()
  const tone = scoreTone(row.confidence, row.inferred)
  const isChoice = row.options.length > 0
  const selected = new Set(
    value
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  )

  const improve = useMutation({
    mutationFn: async (instruction: string) => {
      const result = await improveAnswer({ label: row.label, value: draft, instruction })
      return result.value
    },
    onSuccess: (next) => {
      setDraft(next)
      setShowStyles(false)
    },
  })

  if (verdict === 'cleared') {
    return (
      <li className="flex items-baseline justify-between gap-2 rounded-sharp border border-rule bg-page px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[11.5px] text-faint line-through">{row.label}</p>
        <button
          type="button"
          onClick={() => onResolve(row, row.value, 'kept')}
          className="shrink-0 text-[11px] text-faint transition-colors hover:text-ink"
        >
          Undo
        </button>
      </li>
    )
  }

  return (
    <li className={`rounded-sharp border bg-page ${tone.ring}`}>
      <div className="flex items-start gap-2 px-3 pb-1.5 pt-2.5">
        <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-ink">{row.label}</p>
        <span
          className={`measure shrink-0 text-[10.5px] font-medium tabular-nums ${tone.text}`}
          title={row.inferred ? 'Concluded, not stated by you' : 'Confidence'}
        >
          {Math.round(row.confidence * 100)}%
        </span>
      </div>

      {isChoice ? (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {row.options.map((option) => {
            const on = selected.has(option.toLowerCase())
            return (
              <button
                key={option}
                type="button"
                onClick={() => onResolve(row, option, 'edited')}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  on
                    ? 'border-pen bg-pen-wash font-medium text-pen'
                    : 'border-rule text-muted hover:border-pen hover:text-pen'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="px-3 pb-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(8, Math.max(1, Math.ceil(draft.length / 42)))}
            disabled={improve.isPending}
            className="w-full resize-none rounded-sharp border border-rule bg-ground px-2 py-1.5 text-[12.5px] leading-snug text-ink outline-none transition-colors focus:border-pen disabled:opacity-50"
          />
        </div>
      )}

      {row.inferred && !dirty && row.reasoning && (
        <p className="px-3 pb-2 text-[11px] italic leading-snug text-muted">{row.reasoning}</p>
      )}

      {improve.isError && (
        <p className="px-3 pb-2 text-[11px] text-annot" role="alert">
          {(improve.error as Error).message}
        </p>
      )}

      {showStyles && !isChoice && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {STYLES.map((style) => (
            <button
              key={style.key}
              type="button"
              disabled={improve.isPending}
              onClick={() => improve.mutate(style.label)}
              className="rounded-full border border-rule px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-pen hover:text-pen disabled:opacity-40"
            >
              {style.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-rule-soft px-3 py-1.5">
        {dirty ? (
          <>
            <button
              type="button"
              onClick={() => onResolve(row, draft.trim(), 'edited')}
              className="rounded-sharp border border-pen px-2 py-0.5 text-[11.5px] font-medium text-pen transition-colors hover:bg-pen-wash"
            >
              Save &amp; remember
            </button>
            <button
              type="button"
              onClick={() => setDraft(value)}
              className="text-[11.5px] text-faint transition-colors hover:text-ink"
            >
              Revert
            </button>
          </>
        ) : (
          <>
            {!isChoice && (
              <button
                type="button"
                disabled={improve.isPending}
                onClick={() => setShowStyles((v) => !v)}
                className="text-[11.5px] text-muted transition-colors hover:text-pen disabled:opacity-40"
              >
                {improve.isPending ? 'Rewriting…' : 'Improve'}
              </button>
            )}
            {verdict === 'edited' && (
              <span className="measure text-[11px] text-verified">Remembered</span>
            )}
            <button
              type="button"
              onClick={() => onResolve(row, '', 'cleared')}
              className="ml-auto text-[11.5px] text-faint transition-colors hover:text-annot"
            >
              Clear
            </button>
          </>
        )}
      </div>
    </li>
  )
}
