import { useEffect, useRef, useState } from 'react'
import { createStageWalk, type StageWalk, stageIndex } from '../../../lib/stage-walk.js'
import type { FillState } from '../../../lib/use-fill.js'
import {
  Button,
  type Expression,
  Mascot,
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
} from '../components.js'
import { IconAlert, IconCheck } from '../icons.js'

/**
 * The four things that actually happen, in order.
 *
 * A list that resolves as each stage completes says the same thing once and then proves it, and
 * the mascot's face changes with the beat so the wait reads as progress. The face carries the
 * warmth; the labels name the step. "Reading the room…" and "Slapping them in…" were a voice
 * doing the work the progress list was already doing, and neither told you what was happening.
 *
 * `reading` is here because it is the step that explains the product. The extension reads the
 * page's own text so the answers can come from *this* page, and a list that jumped from finding
 * the form straight to writing made the most distinctive thing it does invisible — the user saw
 * a pause and no reason for it. It also splits what "Reading the form…" used to conflate:
 * finding the fields and reading the page are two different steps taking different amounts of
 * time, which is why `detecting` now says `Finding`.
 *
 * `routing` is deliberately absent: classification and generation are one HTTP call, so the
 * client cannot honestly tell them apart, and a stage that never resolves is worse than one
 * that was never claimed. `reading` survives that test — the client performs it itself — with
 * one wrinkle handled below: a single-field refill skips the scrape, so the stage never arrives
 * and the index maths has to treat it as passed rather than pending.
 */
const STAGES = [
  {
    key: 'detecting',
    label: 'Finding the form…',
    mascot: 'think' as Expression,
    note: () => 'Looking for the questions on this page',
  },
  {
    key: 'reading',
    label: 'Reading the page…',
    mascot: 'think' as Expression,
    note: () => 'Taking in what this page is actually about',
  },
  {
    key: 'generating',
    label: 'Writing your answers…',
    mascot: 'think' as Expression,
    note: (fields: number) =>
      fields > 0
        ? `Answering ${fields} ${fields === 1 ? 'question' : 'questions'} from what you know`
        : 'Answering from what you know',
  },
  {
    key: 'applying',
    label: 'Filling the fields…',
    mascot: 'party' as Expression,
    note: () => 'Putting each answer where it goes',
  },
] as const

/**
 * The line under the title, per stage, replacing one static count.
 *
 * "5 fields on this page" was true for the whole wait and therefore said nothing about it — the
 * screen it appeared on was a spinner with a number beside it. Each stage now says what is being
 * done *now*, which is the only thing worth reading during a pause it cannot shorten.
 */
function noteFor(index: number, fieldCount: number): string {
  return (STAGES[index] ?? STAGES[0]).note(fieldCount)
}

/**
 * The displayed stage, paced so each reported step is visible.
 *
 * The stage the pipeline is *on* is not the stage to render. Finding the form and reading the
 * page both finish within milliseconds of each other, so this screen used to open already sitting
 * on step three with the first two pre-ticked — the user saw a list that had skipped ahead and no
 * evidence the work in front of it had happened at all. `createStageWalk` holds each reported
 * stage on screen for a beat before releasing the next; see that module for why this paces the
 * display and never the fill, and why it refuses to show a stage nobody reported.
 *
 * `drain` on leaving `running` is what stops a queued label from arriving after the answers do.
 */
function useDisplayedStage(state: FillState): string {
  const [shown, setShown] = useState<string>('detecting')
  const walk = useRef<StageWalk | null>(null)

  useEffect(() => {
    const created = createStageWalk(setShown)
    walk.current = created
    return () => {
      created.stop()
      walk.current = null
    }
  }, [])

  useEffect(() => {
    if (state.stage) walk.current?.report(state.stage)
  }, [state.stage])

  useEffect(() => {
    if (state.status !== 'running') walk.current?.drain()
  }, [state.status])

  return shown
}

export function Filling({
  state,
  fieldCount,
  onCancel,
}: {
  state: FillState
  fieldCount: number
  onCancel: () => void
}) {
  const displayed = useDisplayedStage(state)
  const current = Math.max(stageIndex(displayed), 0)
  const failed = state.status === 'error'
  const active = STAGES[Math.min(current, STAGES.length - 1)] ?? STAGES[0]

  return (
    <Screen>
      <ScreenHeader title="Filling" onBack={onCancel} />

      <ScreenBody className="flex flex-col items-center px-6 py-8 text-center">
        <Mascot expression={failed ? 'happy' : active.mascot} size={72} className="bounce" />

        <p className="mt-5 font-display text-lg font-bold tracking-[-0.02em] text-ink">
          {failed ? 'That did not go through.' : active.label}
        </p>

        {!failed && (
          /**
           * Keyed on the stage so React swaps the node rather than the text, which is what lets
           * the line animate in with its label instead of silently changing underneath it.
           */
          <p key={active.key} className="step-in mt-1 text-sm text-ink-muted">
            {noteFor(current, fieldCount)}
          </p>
        )}

        <ol className="mt-6 w-full space-y-1.5">
          {STAGES.map(({ key, label }, index) => {
            const done = index < current || state.status === 'done'
            const isActive = index === current && state.status === 'running'

            return (
              /**
               * Three states, three treatments, and the differences are deliberate rather than
               * decorative: the active row is the only one with an accent edge and full-strength
               * ink, so a glance finds "where am I" without reading; a done row keeps its text
               * dim so the list does not get louder as it fills; a pending row is quiet enough
               * to read as not-yet rather than as disabled.
               *
               * `step-in` with a staggered `--in` deals the rows out on arrival instead of
               * flicking the whole list into place at once. 55ms is under the ~100ms that starts
               * to feel like waiting, and four rows land inside a fifth of a second.
               */
              <li
                key={key}
                className={`step-in flex items-center gap-2.5 rounded-full border px-3.5 py-2.5 transition-colors duration-200 ${
                  isActive ? 'border-accent/40 bg-surface' : 'border-border-muted bg-surface-raised'
                }`}
                style={{ '--in': `${index * 55}ms` } as React.CSSProperties}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {done ? (
                    /**
                     * Keyed so the tick is a *new* node the moment the step resolves, which is
                     * what makes `pop` play. Without the key React reuses the element and the
                     * animation, having already run, never runs again — the check would simply
                     * appear, and the one moment in the whole screen worth marking would be the
                     * one moment with no motion on it.
                     */
                    <IconCheck key={`${key}-done`} className="pop size-4 text-positive" />
                  ) : isActive ? (
                    <span className="pulse-dot size-2.5 rounded-full bg-accent" />
                  ) : (
                    <span className="size-2 rounded-full bg-border" />
                  )}
                </span>
                <span
                  className={`flex-1 text-left text-sm ${
                    done ? 'text-ink-dim' : isActive ? 'font-semibold text-ink' : 'text-ink-dim'
                  }`}
                >
                  {label}
                </span>
                {isActive && key === 'applying' && state.stageTotal ? (
                  <span className="text-xs font-semibold text-ink-muted">
                    {state.stageDone ?? 0}/{state.stageTotal}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>

        {failed ? (
          <p
            role="alert"
            className="mt-5 flex items-start gap-1.5 text-left text-sm leading-snug text-danger"
          >
            <IconAlert className="mt-px size-3.5 shrink-0" />
            <span>{state.error?.message ?? 'Something went wrong.'}</span>
          </p>
        ) : (
          <p className="mt-5 text-xs leading-relaxed text-ink-dim">
            Answers land on the page as they arrive. Nothing gets submitted; that stays yours.
          </p>
        )}
      </ScreenBody>

      <ScreenFooter>
        <Button block variant={failed ? 'primary' : 'ghost'} onClick={onCancel}>
          {failed ? 'Back' : 'Stop'}
        </Button>
      </ScreenFooter>
    </Screen>
  )
}
