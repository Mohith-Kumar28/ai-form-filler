import type { ApplyReport, FillPlan } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { useState } from 'react'
import { plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { useReviewDraft } from '../../../lib/review-store.js'
import {
  Button,
  Chip,
  Mascot,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
} from '../components.js'
import { IconAlert, IconCheck, IconSparkle } from '../icons.js'

/**
 * What the fill did, and a way back to anything worth a second look.
 *
 * **This screen no longer edits answers.** It was a second editor: a textarea per field, option
 * chips, Rewrite, Keep, Save to the page, Undo, Clear — all operating on a copy of an answer
 * whose real home was the form, two feet to the left. Three places held the same text and only
 * one of them could fail to write it, which is what "Save to the page" was apologising for.
 *
 * There is one editor now and it is the answer card, on the page, under the question it belongs
 * to. This screen does the two things a 400px panel beside a form is actually good at: telling
 * the user what happened, and pointing at the things that might need them.
 */

type Fill = FillPlan['fills'][number]

const SKIP_REASON: Record<string, string> = {
  no_matching_knowledge: 'Nothing on file answers this',
  already_filled: 'You had already answered it',
  unsupported_kind: 'This kind of field cannot be filled',
  quota_exhausted: 'Ran out of fields for this month',
  model_error: 'Could not be answered',
}

/** A judgement call: concluded rather than read, or read without confidence. */
function isJudged(fill: Fill): boolean {
  return fill.inferred || fill.confidence < REVIEW_CONFIDENCE_THRESHOLD
}

let lastHighlighted: string | null = null

function highlight(fieldId: string): void {
  if (lastHighlighted === fieldId) return
  lastHighlighted = fieldId
  void sendMessage({ type: 'content/highlight', fieldId })
}

/** Scroll to the field and open its card. The panel's whole remaining power over an answer. */
function openOnPage(fieldId: string): void {
  void sendMessage({ type: 'review/open', fieldId })
}

export function Receipt({
  plan,
  report,
  tabId,
  onDone,
  onBack,
}: {
  plan: FillPlan
  report: ApplyReport | undefined
  tabId: number | null
  onDone: () => void
  onBack?: () => void
}) {
  const draft = useReviewDraft(tabId)
  const [cursor, setCursor] = useState(0)
  const [showStated, setShowStated] = useState(false)

  const refused = new Set(report?.failed ?? [])

  const judged = plan.fills
    .filter(isJudged)
    // Inferences first, then least confident: the ones most worth a human's attention.
    .sort((a, b) => (a.inferred === b.inferred ? a.confidence - b.confidence : a.inferred ? -1 : 1))
  const stated = plan.fills.filter((fill) => !isJudged(fill))

  const outstanding = judged.filter((fill) => (draft.verdicts[fill.fieldId] ?? 'open') === 'open')
  const written = plan.fills.length - refused.size

  /** Clamped rather than stored as a fill id, so a settled answer does not strand the stepper. */
  const at = Math.min(cursor, Math.max(0, outstanding.length - 1))
  const step = (delta: number) => {
    const next = (at + delta + outstanding.length) % Math.max(1, outstanding.length)
    setCursor(next)
    const fill = outstanding[next]
    if (fill) highlight(fill.fieldId)
  }

  if (plan.fills.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Nothing filled" onBack={onBack ?? onDone} />
        <ScreenBody className="flex flex-col">
          <div className="flex flex-1 flex-col items-center justify-center px-7 py-10 text-center">
            <Mascot expression="happy" size={52} />
            <h2 className="mt-4 font-display text-lg font-bold text-ink">Nothing was written</h2>
            <p className="mt-1.5 max-w-[32ch] text-sm leading-relaxed text-ink-muted">
              No field here could be answered. Add more about yourself in My info and that will
              change it.
            </p>
          </div>
        </ScreenBody>
      </Screen>
    )
  }

  return (
    <Screen>
      {/* Not "N need a look". Nothing is wrong, and six pending items read as six errors. */}
      <ScreenHeader
        title={`Filled ${written} ${plural(written, 'field')}`}
        onBack={onBack ?? onDone}
      />

      {/*
        Plain block flow, not `flex flex-col`.

        As a column flex container, every section became a shrinkable flex item — and the ledger,
        which clips its own corners with `overflow-hidden`, was squeezed below its content height
        and quietly ate the last row's detail line. Stacked blocks inside a scrolling body have no
        such failure mode.
      */}
      <ScreenBody>
        <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-border-muted">
          <RowGroup>
            {/*
              No chip, no tick, nothing. The Unmarked Fact Rule: an answer that came from what
              the user told us asks nothing of them, so the interface asks nothing back.
            */}
            {stated.length > 0 && (
              <Row
                icon={<IconCheck className="size-4 text-positive" />}
                title={`${stated.length} from what you told us`}
                {...(stated.length > 0 ? { onClick: () => setShowStated((v) => !v) } : {})}
                value={showStated ? 'hide' : 'show'}
              />
            )}
            {judged.length > 0 && (
              <Row
                icon={<IconSparkle className="size-4 text-accent" />}
                title={`${judged.length} I judged`}
                detail={
                  outstanding.length > 0
                    ? `${outstanding.length} still to look at`
                    : 'all looked at'
                }
              />
            )}
            {plan.skipped.length > 0 && (
              <Row
                title={`${plan.skipped.length} left blank`}
                detail="nothing on file answers it"
              />
            )}
            {refused.size > 0 && (
              <Row
                icon={<IconAlert className="size-4" />}
                tone="danger"
                title={`${refused.size} the page refused`}
                detail="nothing was written to these"
              />
            )}
          </RowGroup>
        </div>

        {showStated && stated.length > 0 && (
          <div className="mx-4 mt-1.5 space-y-1">
            {stated.map((fill) => (
              <div
                key={fill.fieldId}
                className="rounded-xl border border-border-muted px-gutter py-2.5"
              >
                <p className="text-xs font-semibold text-ink-muted">
                  {fill.label || 'Untitled field'}
                </p>
                <p className="mt-1 line-clamp-3 text-sm leading-snug text-ink">
                  {draft.values[fill.fieldId] ?? fill.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {judged.length > 0 && (
          <div className="mx-4 mt-4">
            <p className="mb-2 text-xs font-semibold text-ink-dim">
              These I worked out. Open one to change it
            </p>
            <div className="overflow-hidden rounded-2xl border border-border-muted">
              <RowGroup>
                {judged.map((fill) => {
                  const verdict = draft.verdicts[fill.fieldId] ?? 'open'
                  return (
                    <Row
                      key={fill.fieldId}
                      title={fill.label || 'Untitled field'}
                      detail={
                        verdict === 'cleared'
                          ? 'you cleared this'
                          : (draft.values[fill.fieldId] ?? fill.value)
                      }
                      onClick={() => openOnPage(fill.fieldId)}
                      onHover={() => highlight(fill.fieldId)}
                      trailing={
                        verdict !== 'open' ? (
                          <Chip className="bg-positive-muted text-positive">
                            <IconCheck className="size-3" />
                            done
                          </Chip>
                        ) : (
                          <Chip className="bg-accent-muted text-accent">
                            {fill.inferred ? 'I guessed' : 'not sure'}
                          </Chip>
                        )
                      }
                    />
                  )
                })}
              </RowGroup>
            </div>
          </div>
        )}

        {plan.skipped.length > 0 && (
          <details className="mx-4 mt-3">
            <summary className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted">
              Why {plan.skipped.length} {plural(plan.skipped.length, 'field')} stayed blank
            </summary>
            <div className="mt-1 space-y-1">
              {plan.skipped.map((skip) => (
                <div key={skip.fieldId} className="rounded-xl border border-border-muted px-3 py-2">
                  <p className="text-xs leading-snug text-ink-dim">
                    {skip.detail ?? SKIP_REASON[skip.reason] ?? 'Left blank'}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </ScreenBody>

      {/*
        The stepper. Walks the judgement calls one at a time and opens each on the page, so the
        panel points and the form edits — rather than both holding a copy of the same answer.
      */}
      <ScreenFooter>
        {outstanding.length > 0 ? (
          <div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => step(-1)} aria-label="Previous">
                ‹
              </Button>
              <span className="flex-1 text-center text-xs font-medium text-ink-muted">
                {at + 1} of {outstanding.length} to look at
              </span>
              <Button size="sm" variant="ghost" onClick={() => step(1)} aria-label="Next">
                ›
              </Button>
            </div>
            <Button
              variant="primary"
              block
              size="lg"
              className="mt-2"
              onClick={() => {
                const fill = outstanding[at]
                if (fill) openOnPage(fill.fieldId)
              }}
            >
              <IconSparkle className="size-4" />
              Open it on the page
            </Button>
            <p className="mt-2 text-center text-xs text-ink-dim">
              Or leave them. Submitting the form is still yours to do.
            </p>
          </div>
        ) : (
          <div>
            <Button variant="primary" block size="lg" onClick={onDone}>
              <IconCheck className="size-4" />
              Done
            </Button>
            <p className="mt-2 text-center text-xs text-ink-dim">
              Submitting the form is still yours to do.
            </p>
          </div>
        )}
      </ScreenFooter>
    </Screen>
  )
}
