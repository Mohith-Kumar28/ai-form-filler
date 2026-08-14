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
  AutoTextarea,
  Button,
  EmptyState,
  Screen,
  ScreenBody,
  ScreenHeader,
} from '../components.js'
import { IconAlert, IconCheck, IconPen, IconStamp } from '../icons.js'

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

/**
 * The endorsement.
 *
 * This is the signature of the whole surface, and the one thing that must never be missed: a
 * mark applied *after* the printing, off-angle, in the second ink, saying who added it and on
 * what authority. A stated answer gets none of this — it is simply printed, the way a field
 * issued with the document is. Making inference visible is the product's entire trust model.
 */
function Endorsement({ fill }: { fill: Fill }) {
  if (fill.inferred) {
    // The vermilion here is the endorsement stamp and nothing else. Faults elsewhere on this
    // screen speak in the caution ink, so a guessed answer never reads as something broken.
    return (
      <span className="endorse-in inline-flex shrink-0 items-center gap-1 rounded-doc border border-endorse bg-endorse-wash px-1.5 py-0.5 text-endorse">
        <IconStamp className="size-3" />
        <span className="mrz text-[9.5px] font-medium uppercase tracking-[0.1em]">Concluded</span>
      </span>
    )
  }

  if (fill.confidence < REVIEW_CONFIDENCE_THRESHOLD) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-doc border border-query px-1.5 py-0.5 text-query">
        <span className="mrz text-[9.5px] font-medium uppercase tracking-[0.1em]">Unsure</span>
        <span className="mrz text-[9.5px]">{Math.round(fill.confidence * 100)}%</span>
      </span>
    )
  }

  return null
}

/**
 * Points at a field on the page, from the row that is about it.
 *
 * Deduplicated against the last field asked for. Pointer movement inside a row fires
 * `mouseenter` again whenever the list reflows under a stationary cursor, and each of those
 * used to be another scroll request — with a marked field near the top of a long form and
 * another near the bottom, the page walked between them without stopping.
 */
let lastHighlighted: string | null = null

function highlight(fieldId: string): void {
  if (lastHighlighted === fieldId) return
  lastHighlighted = fieldId
  void sendMessage({ type: 'content/highlight', fieldId })
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

  /*
    Hover only. `onFocus` bubbles from the textarea inside the row, so every keystroke that
    moved focus re-pointed the page at this field.
  */
  return (
    <li
      className="border-b border-guilloche px-4 py-3.5"
      onMouseEnter={() => highlight(fill.fieldId)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="doc-label min-w-0 flex-1 normal-case tracking-[0.04em] text-ink2">
          {fill.label || 'Untitled field'}
        </p>
        <Endorsement fill={fill} />
      </div>

      {notAccepted && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-alert">
          <IconAlert className="mt-px size-3.5 shrink-0" />
          <span>The page would not take this one. Nothing was written.</span>
        </p>
      )}

      <div className="mt-2">
        {fill.options.length > 0 ? (
          /*
            A choice question shows what was on offer. "Notion" alone tells you nothing about
            whether the right answer was even available, and picking a different one should be
            a tap rather than retyping a string that has to match the page exactly.
          */
          <div className="flex flex-wrap gap-1.5">
            {fill.options.map((option) => {
              const selected = option === value
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onResolve('edited', option)}
                  className={`rounded-doc border px-2 py-1 text-[12px] transition-colors ${
                    selected
                      ? 'border-ink bg-ink text-stock'
                      : 'border-guilloche text-ink2 hover:border-ink hover:text-ink'
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

      {rewriting && (
        <div className="mt-2 flex flex-wrap gap-1.5">
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
            <span className="self-center text-[11.5px] text-ink3">Rewriting…</span>
          )}
        </div>
      )}

      {improve.isError && (
        <p className="mt-1.5 text-[11.5px] text-alert" role="alert">
          {improve.error.message}
        </p>
      )}

      {writeError && (
        <p className="mt-1.5 text-[11.5px] text-alert" role="alert">
          {writeError}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {dirty ? (
          <>
            <Button size="sm" variant="plate" onClick={() => onResolve('edited', value)}>
              Save to the page
            </Button>
            <Button size="sm" variant="quiet" onClick={() => onEdit(fill.value)}>
              Undo
            </Button>
          </>
        ) : (
          <>
            {needsCheck(fill) && !settled && (
              <Button size="sm" onClick={() => onResolve('accepted', value)}>
                <IconCheck className="size-3.5" />
                Keep
              </Button>
            )}
            {fill.options.length === 0 && (
              <Button size="sm" variant="quiet" onClick={() => setRewriting((v) => !v)}>
                <IconPen className="size-3.5" />
                Rewrite
              </Button>
            )}
            {verdict === 'accepted' && (
              <span className="mrz text-[10px] uppercase tracking-[0.1em] text-ink3">
                Confirmed
              </span>
            )}
            {verdict === 'edited' && (
              <span className="mrz text-[10px] uppercase tracking-[0.1em] text-ink3">Saved</span>
            )}
            <span className="flex-1" />
            {verdict === 'cleared' ? (
              <Button size="sm" variant="quiet" onClick={() => onResolve('edited', fill.value)}>
                Undo clear
              </Button>
            ) : (
              <Button size="sm" variant="quiet" onClick={() => onResolve('cleared', '')}>
                Clear
              </Button>
            )}
          </>
        )}
      </div>
    </li>
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

  /**
   * Resolving a row writes to the page and verifies it.
   *
   * `sendMessage` resolves `{ok:false}` rather than throwing, and the content script answers
   * `false` outright when the field is gone — discarding either produced a row that said
   * "Saved" and showed the new answer while the form still held the old one, which is worse
   * than the correction never being offered.
   */
  const resolve = async (fill: Fill, verdict: Verdict, next: string) => {
    if (tabId === null) return

    // Accepting writes nothing: the page already holds this value. It only records agreement.
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

    /*
      Take the stamp off the field, whatever the verdict was.

      `review/write` already clears the mark for an edit or a clear, but accepting writes
      nothing — so agreeing with a concluded answer used to leave its endorsement on the field
      indefinitely, and the only way to remove a stamp was to change the answer you had just
      said was right.
    */
    void sendMessage({ type: 'review/resolved', fieldId: fill.fieldId })

    /*
      Only a rewrite or a confirmation teaches. Clearing says the answer was wrong without
      saying what is right, and feeding "this was wrong" into the same index later answers are
      retrieved from would make them worse rather than better.
    */
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
        title={outstanding > 0 ? `${outstanding} worth checking` : 'Everything checked'}
        onBack={onDone}
      />

      <ScreenBody className="flex flex-col">
        {/*
          What happened to the form, and nothing else.

          The per-fill cost in cents used to end this line. That is our unit economics, not the
          reader's: this is hosted, not bring-your-own-key, so a number they cannot act on and
          are not billed for only invites them to price their own job application. Latency goes
          with it — they watched it happen.
        */}
        <p className="mrz border-b border-guilloche px-4 py-2 text-[10.5px] text-ink3">
          {written} written
          {notAccepted.size > 0 && (
            <span className="text-alert"> · {notAccepted.size} refused</span>
          )}
          {plan.skipped.length > 0 && ` · ${plan.skipped.length} blank`}
        </p>

        {checkable.length === 0 && settledFills.length === 0 ? (
          <EmptyState
            title="Nothing was written"
            body="No field on this page could be answered from what it knows. Adding more about yourself is what changes that."
          />
        ) : (
          <>
            {checkable.length > 0 ? (
              <ul>
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
              </ul>
            ) : (
              <p className="border-b border-guilloche px-4 py-4 text-[12.5px] leading-relaxed text-ink2">
                Every answer came straight from something you told it. Nothing here was a judgement
                call.
              </p>
            )}

            {/*
              Answers it read straight off are collapsed by design. Research on confidence-
              scored autofill puts the typical number needing a look at two to five; putting
              thirty-four percentages in front of someone is how the five get missed.
            */}
            {settledFills.length > 0 && (
              <div className="border-b border-guilloche">
                <button
                  type="button"
                  onClick={() => setShowSettled((v) => !v)}
                  aria-expanded={showSettled}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-guilloche-soft"
                >
                  <IconCheck className="size-4 shrink-0 text-ink3" />
                  <span className="flex-1 text-[12.5px] text-ink2">
                    {settledFills.length} {plural(settledFills.length, 'answer')} read straight off
                  </span>
                  <span className="mrz text-[10.5px] uppercase tracking-[0.1em] text-ink3">
                    {showSettled ? 'Hide' : 'Show'}
                  </span>
                </button>

                {showSettled && (
                  <ul className="divide-y divide-guilloche-soft border-t border-guilloche-soft">
                    {settledFills.map((fill) => (
                      <li key={fill.fieldId} className="px-4 py-2.5">
                        <p className="doc-label normal-case tracking-[0.04em]">
                          {fill.label || 'Untitled field'}
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug text-ink">
                          {draft.values[fill.fieldId] ?? fill.value}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {plan.skipped.length > 0 && (
              <details className="border-b border-guilloche">
                <summary className="cursor-pointer px-4 py-3 text-[12.5px] text-ink2 transition-colors hover:bg-guilloche-soft">
                  {plan.skipped.length} left blank
                </summary>
                <ul className="divide-y divide-guilloche-soft border-t border-guilloche-soft">
                  {plan.skipped.map((skip) => (
                    <li key={skip.fieldId} className="px-4 py-2">
                      <p className="text-[11.5px] leading-snug text-ink3">
                        {skip.detail ?? SKIP_REASON[skip.reason] ?? 'Left blank'}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <div className="px-4 py-4">
          <Button variant="plate" block onClick={onDone}>
            Done
          </Button>
          <p className="mt-2 text-center text-[11.5px] text-ink3">
            Submitting the form is still yours to do.
          </p>
        </div>
      </ScreenBody>
    </Screen>
  )
}
