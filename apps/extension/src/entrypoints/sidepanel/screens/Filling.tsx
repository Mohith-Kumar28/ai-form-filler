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
 * The three things that actually happen, in order.
 *
 * A list that resolves as each stage completes says the same thing once and then proves it, and
 * the mascot's face changes with the beat so the wait reads as progress. The face carries the
 * warmth; the labels name the step. "Reading the room…" and "Slapping them in…" were a voice
 * doing the work the progress list was already doing, and neither told you what was happening.
 *
 * `routing` is deliberately absent: classification and generation are one HTTP call, so the
 * client cannot honestly tell them apart, and a stage that never resolves is worse than one
 * that was never claimed.
 */
const STAGES = [
  { key: 'detecting', label: 'Reading the form…', mascot: 'think' as Expression },
  { key: 'generating', label: 'Writing your answers…', mascot: 'think' as Expression },
  { key: 'applying', label: 'Filling the fields…', mascot: 'party' as Expression },
] as const

const ORDER: Record<string, number> = { detecting: 0, generating: 1, applying: 2 }

export function Filling({
  state,
  fieldCount,
  onCancel,
}: {
  state: FillState
  fieldCount: number
  onCancel: () => void
}) {
  const current = ORDER[state.stage ?? 'detecting'] ?? 0
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
          <p className="mt-1 text-sm text-ink-muted">
            {fieldCount > 0 ? `${fieldCount} fields on this page` : 'Working through the form'}
          </p>
        )}

        <ol className="mt-6 w-full space-y-1.5">
          {STAGES.map(({ key, label }, index) => {
            const done = index < current || state.status === 'done'
            const isActive = index === current && state.status === 'running'

            return (
              <li
                key={key}
                className="flex items-center gap-2.5 rounded-full border border-border-muted bg-surface-raised px-3.5 py-2.5"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {done ? (
                    <IconCheck className="size-4 text-positive" />
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
