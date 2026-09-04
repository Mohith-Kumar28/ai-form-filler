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
 * `reading` is here because it is the step that explains the product: the extension reads the
 * page's own text so the answers can come from *this* page. `routing` is absent: classification
 * and generation are one HTTP call, and a stage that never resolves is worse than one never
 * claimed.
 */
const STAGES = [
  {
    key: 'detecting',
    label: 'Finding the form',
    mascot: 'think' as Expression,
    note: () => 'Looking for the questions on this page',
  },
  {
    key: 'reading',
    label: 'Reading the page',
    mascot: 'think' as Expression,
    note: () => 'Taking in what this page is about',
  },
  {
    key: 'generating',
    label: 'Writing your answers',
    mascot: 'think' as Expression,
    note: (fields: number) =>
      fields > 0
        ? `Answering ${fields} ${fields === 1 ? 'question' : 'questions'} from what you know`
        : 'Answering from what you know',
  },
  {
    key: 'applying',
    label: 'Filling the fields',
    mascot: 'happy' as Expression,
    note: () => 'Putting each answer where it goes',
  },
] as const

function noteFor(index: number, fieldCount: number): string {
  return (STAGES[index] ?? STAGES[0]).note(fieldCount)
}

/**
 * The displayed stage, paced so each reported step is visible.
 *
 * Finding the form and reading the page both finish within milliseconds of each other, so
 * without pacing this screen opened already on step three. `createStageWalk` holds each stage
 * on screen for a beat; `drain` on leaving `running` stops a queued label arriving late.
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
      <ScreenHeader title={failed ? 'Fill stopped' : 'Filling…'} onBack={onCancel} />

      <ScreenBody className="flex flex-col px-gutter py-5">
        <div className="flex items-center gap-3">
          <Mascot expression={failed ? 'flat' : active.mascot} size={40} blink />
          <div className="min-w-0 flex-1">
            <p className="display text-base text-ink">
              {failed ? 'That did not go through' : `${active.label}…`}
            </p>
            {!failed && (
              /* Keyed on the stage so the line animates in with its label. */
              <p key={active.key} className="step-in text-xs text-ink-muted">
                {noteFor(current, fieldCount)}
              </p>
            )}
          </div>
        </div>

        <ol className="mt-5 overflow-hidden rounded-lg border border-border bg-surface-raised divide-y divide-border-muted">
          {STAGES.map(({ key, label }, index) => {
            const done = index < current || state.status === 'done'
            const isActive = index === current && state.status === 'running'

            return (
              <li
                key={key}
                className="step-in flex h-9 items-center gap-2.5 px-3"
                style={{ '--in': `${index * 45}ms` } as React.CSSProperties}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {done ? (
                    /* Keyed so the tick is a new node the moment the step resolves. */
                    <IconCheck key={`${key}-done`} className="pop size-4 text-positive" />
                  ) : isActive ? (
                    <span className="pulse-dot size-2 rounded-full bg-accent" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-border" />
                  )}
                </span>
                <span
                  className={`flex-1 text-sm ${
                    isActive ? 'font-medium text-ink' : done ? 'text-ink-muted' : 'text-ink-dim'
                  }`}
                >
                  {label}
                </span>
                {isActive && key === 'applying' && state.stageTotal ? (
                  <span className="tnum text-xs text-ink-muted">
                    {state.stageDone ?? 0} / {state.stageTotal}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>

        {failed ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-1.5 rounded-md bg-danger-muted px-3 py-2 text-xs leading-snug text-danger"
          >
            <IconAlert className="mt-px size-3.5 shrink-0" />
            <span>{state.error?.message ?? 'Something went wrong.'}</span>
          </p>
        ) : (
          <p className="mt-4 text-xs text-ink-dim">
            Answers land on the page as they arrive. Nothing is submitted — that stays yours.
          </p>
        )}
      </ScreenBody>

      <ScreenFooter>
        <Button block variant={failed ? 'primary' : 'secondary'} onClick={onCancel}>
          {failed ? 'Back' : 'Stop'}
        </Button>
      </ScreenFooter>
    </Screen>
  )
}
