import type { ApplyReport, FillPlan } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { useState } from 'react'
import { useImproveAnswer } from '../../../generated/endpoints/fill/fill.js'
import { plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import {
  setError,
  setValue,
  setVerdict,
  useReviewDraft,
  type Verdict,
} from '../../../lib/review-store.js'
import {
  AiBadge,
  AutoTextarea,
  Button,
  Card,
  Chip,
  Mascot,
  Screen,
  ScreenBody,
  ScreenHeader,
} from '../components.js'
import { IconAlert, IconCheck, IconPen, IconSparkle } from '../icons.js'

type Fill = FillPlan['fills'][number]

const STYLES = [
  { key: 'professional', label: 'More formal' },
  { key: 'simpler', label: 'Simpler' },
  { key: 'shorter', label: 'Shorter' },
  { key: 'detailed', label: 'More detail' },
] as const

const SKIP_REASON: Record<string, string> = {
  no_matching_knowledge: 'Nothing on file answers this',
  already_filled: 'You had already answered it',
  unsupported_kind: 'This kind of field cannot be filled',
  quota_exhausted: 'Ran out of forms mid-way',
  model_error: 'Could not be answered',
}

function needsCheck(fill: Fill): boolean {
  return fill.inferred || fill.confidence < REVIEW_CONFIDENCE_THRESHOLD
}

let lastHighlighted: string | null = null

function highlight(fieldId: string): void {
  if (lastHighlighted === fieldId) return
  lastHighlighted = fieldId
  void sendMessage({ type: 'content/highlight', fieldId })
}

function confidenceNote(fill: Fill): string {
  if (fill.inferred) return 'The AI wrote this from your other answers — check it.'
  return 'The AI is not confident about this one.'
}

function AnswerEntry({
  fill,
  verdict,
  value,
  writeError,
  notAccepted,
  onResolve,
  onEdit,
}: {
  fill: Fill
  verdict: Verdict
  value: string
  writeError?: string
  notAccepted: boolean
  onResolve: (verdict: Verdict, next: string) => void
  onEdit: (next: string) => void
}) {
  const [rewriting, setRewriting] = useState(false)
  const improve = useImproveAnswer()

  const dirty = value !== fill.value
  const settled = verdict !== 'open'

  return (
    <Card
      className="border-b-0 rounded-none first:rounded-t-2xl last:rounded-b-2xl"
      onMouseEnter={() => highlight(fill.fieldId)}
    >
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[13px] font-semibold text-ink">
            {fill.label || 'Untitled field'}
          </p>
          <AiBadge />
        </div>

        {notAccepted && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-danger">
            <IconAlert className="mt-px size-3.5 shrink-0" />
            <span>The page refused this one. Nothing was written.</span>
          </p>
        )}

        <div className="mt-2.5">
          {fill.options.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {fill.options.map((option) => {
                const selected = option === value
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onResolve('edited', option)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-border-muted text-ink-muted hover:border-border hover:text-ink'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          ) : (
            <AutoTextarea
              aria-label={fill.label || 'Answer'}
              value={value}
              minRows={1}
              onChange={(event) => onEdit(event.currentTarget.value)}
            />
          )}
        </div>

        {needsCheck(fill) && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-dim">
            <IconSparkle className="size-3 text-accent" />
            {confidenceNote(fill)}
          </p>
        )}

        {rewriting && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {STYLES.map((style) => (
              <Button
                key={style.key}
                size="sm"
                disabled={improve.isPending}
                onClick={() => {
                  improve.mutate(
                    { data: { label: fill.label, value, instruction: style.key } },
                    {
                      onSuccess: (result) => {
                        onEdit(result.value)
                        setRewriting(false)
                      },
                    },
                  )
                }}
              >
                {style.label}
              </Button>
            ))}
            {improve.isPending && (
              <span className="self-center text-[12px] text-ink-dim">Rewriting…</span>
            )}
          </div>
        )}

        {improve.isError && (
          <p className="mt-1.5 text-[12px] text-danger" role="alert">
            {improve.error.message}
          </p>
        )}

        {writeError && (
          <p className="mt-1.5 text-[12px] text-danger" role="alert">
            {writeError}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {dirty ? (
            <>
              <Button size="sm" variant="primary" onClick={() => onResolve('edited', value)}>
                Save to the page
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(fill.value)}>
                Undo
              </Button>
            </>
          ) : (
            <>
              {needsCheck(fill) && !settled && (
                <Button size="sm" variant="secondary" onClick={() => onResolve('accepted', value)}>
                  <IconCheck className="size-3.5" />
                  Keep
                </Button>
              )}
              {fill.options.length === 0 && (
                <Button size="sm" variant="ghost" onClick={() => setRewriting((v) => !v)}>
                  <IconPen className="size-3.5" />
                  Rewrite
                </Button>
              )}
              {verdict === 'accepted' && (
                <Chip className="bg-positive-muted text-positive">
                  <IconCheck className="size-3" />
                  confirmed
                </Chip>
              )}
              {verdict === 'edited' && (
                <Chip className="bg-positive-muted text-positive">
                  <IconCheck className="size-3" />
                  saved
                </Chip>
              )}
              <span className="flex-1" />
              {verdict === 'cleared' ? (
                <Button size="sm" variant="ghost" onClick={() => onResolve('edited', fill.value)}>
                  Undo clear
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => onResolve('cleared', '')}>
                  Clear
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

export function Review({
  plan,
  report,
  tabId,
  onDone,
}: {
  plan: FillPlan
  report: ApplyReport | undefined
  tabId: number | null
  onDone: () => void
}) {
  const draft = useReviewDraft(tabId)
  const [showSettled, setShowSettled] = useState(false)

  const notAccepted = new Set(report?.failed ?? [])

  const checkable = plan.fills
    .filter(needsCheck)
    .sort((a, b) => (a.inferred === b.inferred ? a.confidence - b.confidence : a.inferred ? -1 : 1))
  const settledFills = plan.fills.filter((fill) => !needsCheck(fill))

  const outstanding = checkable.filter(
    (fill) => (draft.verdicts[fill.fieldId] ?? 'open') === 'open',
  ).length

  const resolve = async (fill: Fill, verdict: Verdict, next: string) => {
    if (tabId === null) return

    if (verdict !== 'accepted') {
      const result = await sendMessage({
        type: 'review/write',
        fieldId: fill.fieldId,
        value: next,
      })

      if (!result.ok) {
        setError(tabId, fill.fieldId, 'Could not write this to the page.')
        return
      }
    }

    setError(tabId, fill.fieldId, null)
    setValue(tabId, fill.fieldId, next)
    setVerdict(tabId, fill.fieldId, verdict)

    void sendMessage({ type: 'review/resolved', fieldId: fill.fieldId })

    if (verdict === 'edited' || verdict === 'accepted') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      await sendMessage({
        type: 'feedback/submit',
        payload: {
          origin: tab?.url ? new URL(tab.url).origin : '',
          entries: [
            {
              label: fill.label,
              ...(fill.kind ? { kind: fill.kind } : {}),
              proposed: fill.value,
              accepted: next,
              edited: verdict === 'edited',
              ...(verdict === 'accepted' ? { confirmed: true } : {}),
            },
          ],
        },
      })
    }
  }

  const written = plan.fills.length - notAccepted.size

  return (
    <Screen>
      <ScreenHeader
        title={outstanding > 0 ? `${outstanding} need a look` : 'All good'}
        onBack={onDone}
      />

      <ScreenBody className="flex flex-col">
        <p className="px-4 py-2.5 text-[12px] font-medium text-ink-muted">
          {written} written
          {notAccepted.size > 0 && (
            <span className="text-danger"> · {notAccepted.size} refused</span>
          )}
          {plan.skipped.length > 0 && (
            <span className="text-ink-dim"> · {plan.skipped.length} blank</span>
          )}
        </p>

        {checkable.length === 0 && settledFills.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-7 py-10 text-center">
            <Mascot expression="happy" size={52} />
            <h2 className="mt-4 font-display text-[17px] font-bold text-ink">
              Nothing was written
            </h2>
            <p className="mt-1.5 max-w-[32ch] text-[13px] leading-relaxed text-ink-muted">
              No field here could be answered. Add more about yourself in My info — that's what
              changes it.
            </p>
          </div>
        ) : (
          <>
            {checkable.length > 0 ? (
              <div className="mx-4 mt-2 flex flex-col gap-px">
                <p className="mb-2 text-[12px] font-semibold uppercase text-ink-dim">
                  the AI wrote these — take a look
                </p>
                {checkable.map((fill) => (
                  <AnswerEntry
                    key={fill.fieldId}
                    fill={fill}
                    verdict={draft.verdicts[fill.fieldId] ?? 'open'}
                    value={draft.values[fill.fieldId] ?? fill.value}
                    writeError={draft.errors[fill.fieldId]}
                    notAccepted={notAccepted.has(fill.fieldId)}
                    onResolve={(verdict, next) => void resolve(fill, verdict, next)}
                    onEdit={(next) => tabId !== null && setValue(tabId, fill.fieldId, next)}
                  />
                ))}
              </div>
            ) : (
              <p className="mx-4 mt-4 rounded-2xl border border-border-muted bg-surface-raised px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
                Everything came from your own info. Nothing to check.
              </p>
            )}

            {settledFills.length > 0 && (
              <div className="mx-4 mt-3">
                <button
                  type="button"
                  onClick={() => setShowSettled((v) => !v)}
                  aria-expanded={showSettled}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <IconCheck className="size-4 shrink-0 text-positive" />
                  <span className="flex-1 text-[13px] font-medium text-ink-muted">
                    {settledFills.length} {plural(settledFills.length, 'answer')} from you
                  </span>
                  <span className="text-[12px] font-semibold uppercase text-ink-dim">
                    {showSettled ? 'hide' : 'show'}
                  </span>
                </button>

                {showSettled && (
                  <div className="mt-1 space-y-1">
                    {settledFills.map((fill) => (
                      <div
                        key={fill.fieldId}
                        className="rounded-xl border border-border-muted px-4 py-2.5"
                      >
                        <p className="text-[12px] font-semibold text-ink-muted">
                          {fill.label || 'Untitled field'}
                        </p>
                        <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-ink">
                          {draft.values[fill.fieldId] ?? fill.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {plan.skipped.length > 0 && (
              <details className="mx-4 mt-1.5">
                <summary className="cursor-pointer rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-muted">
                  {plan.skipped.length} left blank
                </summary>
                <div className="mt-1 space-y-1">
                  {plan.skipped.map((skip) => (
                    <div
                      key={skip.fieldId}
                      className="rounded-xl border border-border-muted px-3 py-2"
                    >
                      <p className="text-[12px] leading-snug text-ink-dim">
                        {skip.detail ?? SKIP_REASON[skip.reason] ?? 'Left blank'}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        <div className="px-4 py-5">
          <Button variant="primary" block size="lg" onClick={onDone}>
            <IconSparkle className="size-4" />
            Done
          </Button>
          <p className="mt-2.5 text-center text-[12px] text-ink-dim">
            Submitting the form is still yours to do.
          </p>
        </div>
      </ScreenBody>
    </Screen>
  )
}
