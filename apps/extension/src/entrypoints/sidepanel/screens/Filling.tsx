import type { FillState } from '../../../lib/use-fill.js'
import { Button, Screen, ScreenBody, ScreenFooter, ScreenHeader } from '../components.js'
import { IconAlert, IconCheck } from '../icons.js'

/**
 * The three things that actually happen, in order.
 *
 * The old surface put one rotating line in the page dock and swapped its wording every 2.4
 * seconds for the whole ten-to-twenty second run, which is a progress indicator that reports
 * nothing and a reading task the person did not ask for. A list that resolves as each stage
 * completes says the same thing once and then proves it.
 *
 * `routing` is deliberately absent: classification and generation are one HTTP call, so the
 * client cannot honestly tell them apart, and a stage that never resolves is worse than one
 * that was never claimed.
 */
const STAGES = [
  { key: 'detecting', label: 'Reading the page' },
  { key: 'generating', label: 'Writing your answers' },
  { key: 'applying', label: 'Filling the form' },
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

  return (
    <Screen>
      <ScreenHeader title="Filling" onBack={onCancel} />

      <ScreenBody className="px-4 py-5">
        <p className="doc-label">In progress</p>
        <p className="mt-1.5 text-[14px] font-semibold tracking-[-0.01em] text-ink">
          {fieldCount > 0 ? `${fieldCount} fields on this page` : 'Working through the form'}
        </p>

        <ol className="mt-5 space-y-0 border-y border-guilloche">
          {STAGES.map(({ key, label }, index) => {
            const done = index < current || state.status === 'done'
            const active = index === current && state.status === 'running'

            return (
              <li
                key={key}
                className="flex items-center gap-2.5 border-b border-guilloche-soft py-3 last:border-b-0"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {done ? (
                    <IconCheck className="size-4 text-ink" />
                  ) : active ? (
                    <Ticking />
                  ) : (
                    <span className="size-1.5 rounded-full bg-guilloche" />
                  )}
                </span>
                <span
                  className={`flex-1 text-[13px] ${
                    done ? 'text-ink2' : active ? 'font-medium text-ink' : 'text-ink3'
                  }`}
                >
                  {label}
                </span>
                {active && key === 'applying' && state.stageTotal ? (
                  <span className="mrz text-[11.5px] text-ink2">
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
            className="mt-4 flex items-start gap-1.5 text-[12.5px] leading-snug text-endorse"
          >
            <IconAlert className="mt-px size-3.5 shrink-0" />
            <span>{state.error?.message ?? 'Something went wrong.'}</span>
          </p>
        ) : (
          <p className="mt-4 text-[12px] leading-relaxed text-ink3">
            Answers are written into the page as they arrive. Nothing is submitted — that stays
            yours.
          </p>
        )}
      </ScreenBody>

      <ScreenFooter>
        <Button block variant={failed ? 'plate' : 'quiet'} onClick={onCancel}>
          {failed ? 'Back' : 'Stop'}
        </Button>
      </ScreenFooter>
    </Screen>
  )
}

/**
 * The one moving part on the screen.
 *
 * A rotating border ring is the generic spinner; this is the seal being impressed — a mark
 * that grows and settles on the beat of the work rather than spinning free of it.
 */
function Ticking() {
  return (
    <span className="relative flex size-3.5 items-center justify-center" aria-hidden>
      <span className="absolute size-3.5 rounded-full border border-query opacity-40" />
      <span className="size-1.5 animate-pulse rounded-full bg-query" />
    </span>
  )
}
