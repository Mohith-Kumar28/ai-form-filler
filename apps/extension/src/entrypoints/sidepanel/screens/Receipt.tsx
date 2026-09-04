import type { ApplyReport, FillPlan } from '@aff/shared'
import { REVIEW_CONFIDENCE_THRESHOLD } from '@aff/shared/constants'
import { useState } from 'react'
import { plural } from '../../../lib/format.js'
import { sendMessage } from '../../../lib/messaging.js'
import { useReviewDraft } from '../../../lib/review-store.js'
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  ListCard,
  Row,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  SectionLabel,
  Stat,
} from '../components.js'
import { IconBack, IconCheck, IconChevronDown, IconChevronRight, IconSparkle } from '../icons.js'

/**
 * What the fill did, and a way back to anything worth a second look.
 *
 * This screen does not edit answers. There is one editor and it is the answer card, on the page,
 * under the question it belongs to. This does the two things a 400px panel beside a form is
 * good at: saying what happened, and pointing at the things that might need the person.
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

/** A collapsed group of rows, for the parts of the receipt nobody needs to read every time. */
function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 px-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <IconChevronDown className="size-3.5 -rotate-90 transition-transform group-open:rotate-0" />
        {summary}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  )
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
          <EmptyState
            mascot="flat"
            title="Nothing was written"
            body="No field here could be answered. Add more about yourself in Profile and that will change."
          />
        </ScreenBody>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScreenHeader
        title={`Filled ${written} ${plural(written, 'field')}`}
        onBack={onBack ?? onDone}
      />

      <ScreenBody className="px-gutter pb-3">
        {/* The count of each kind, at a glance. Stated needs nothing from the user, so it is quiet. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat value={stated.length} label="from your info" tone="positive" />
          <Stat value={judged.length} label="guessed" tone={judged.length > 0 ? 'accent' : 'dim'} />
          <Stat
            value={plan.skipped.length + refused.size}
            label={refused.size > 0 ? 'blank or refused' : 'left blank'}
            tone="dim"
          />
        </div>

        {judged.length > 0 && (
          <>
            <SectionLabel>
              Check these
              {outstanding.length > 0 && (
                <span className="tnum ml-1.5 font-normal normal-case tracking-normal text-ink-dim">
                  · {outstanding.length} to go
                </span>
              )}
            </SectionLabel>
            <ListCard>
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
                          <IconSparkle className="size-3" />
                          {fill.inferred ? 'I guessed' : 'not sure'}
                        </Chip>
                      )
                    }
                  />
                )
              })}
            </ListCard>
          </>
        )}

        <div className="mt-3 space-y-1">
          {stated.length > 0 && (
            <Disclosure summary={`${stated.length} from your info`}>
              <ListCard>
                {stated.map((fill) => (
                  <div key={fill.fieldId} className="px-3 py-2">
                    <p className="text-2xs font-medium text-ink-dim">
                      {fill.label || 'Untitled field'}
                    </p>
                    <p className="line-clamp-2 text-sm text-ink">
                      {draft.values[fill.fieldId] ?? fill.value}
                    </p>
                  </div>
                ))}
              </ListCard>
            </Disclosure>
          )}

          {plan.skipped.length > 0 && (
            <Disclosure
              summary={`Why ${plan.skipped.length} ${plural(plan.skipped.length, 'field')} stayed blank`}
            >
              <ListCard>
                {plan.skipped.map((skip) => (
                  <p key={skip.fieldId} className="px-3 py-2 text-xs text-ink-muted">
                    {skip.detail ?? SKIP_REASON[skip.reason] ?? 'Left blank'}
                  </p>
                ))}
              </ListCard>
            </Disclosure>
          )}

          {refused.size > 0 && (
            <p className="px-1 py-1.5 text-xs text-danger">
              {refused.size} {plural(refused.size, 'field')} refused the value; nothing was written
              there.
            </p>
          )}
        </div>
      </ScreenBody>

      {/* The stepper walks the guesses one at a time and opens each on the page. */}
      <ScreenFooter>
        {outstanding.length > 0 ? (
          <div className="flex items-center gap-2">
            <IconButton label="Previous" onClick={() => step(-1)}>
              <IconBack className="size-4" />
            </IconButton>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                const fill = outstanding[at]
                if (fill) openOnPage(fill.fieldId)
              }}
            >
              Check {at + 1} of {outstanding.length} on the page
            </Button>
            <IconButton label="Next" onClick={() => step(1)}>
              <IconChevronRight className="size-4" />
            </IconButton>
          </div>
        ) : (
          <Button variant="primary" block onClick={onDone}>
            <IconCheck className="size-4" />
            Done
          </Button>
        )}
        <p className="mt-2 text-center text-2xs text-ink-dim">
          Submitting the form is still yours to do.
        </p>
      </ScreenFooter>
    </Screen>
  )
}
