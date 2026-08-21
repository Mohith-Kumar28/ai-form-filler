import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Account, Profile } from '../../../generated/model/index.js'
import { factCount, reconcile } from '../../../lib/fact-catalog.js'
import { formatCount, plural } from '../../../lib/format.js'
import { Button, type Expression, Mascot, Screen, ScreenBody, ScreenFooter } from '../components.js'
import { IconBack, IconCheck, IconMascot, IconSparkle } from '../icons.js'
import { BASICS_REQUIRED, Basics, countBasics } from './basics.js'
import { BlobBackdrop, BlobMascot, useMascotGaze } from './blob.js'
import { Sources } from './sources.js'
import { STORY } from './story.js'

/*
  First run, in eight screens.

  The order is the argument. Five screens explain what the thing does — with the features
  demonstrated rather than listed — and then two ask the user to do the work: answer the questions
  every form asks, and hand over something to read. The last one shows them what they have built.

  Why in this order, and why the asking comes last: nobody hands over a résumé to a tool they have
  not seen work, and nobody presses "Fill" on an empty profile and gets anything worth having. So
  the flow spends its first half earning the right to ask, and its second half being asked. By the
  end the account holds facts and sources, which is exactly the state in which the product's one
  action — Fill — does something impressive rather than nothing.

  It is also, deliberately, work the user does themselves. Someone who has typed their own notice
  period and watched their own résumé being read has a profile they are attached to; that is the
  same reason a flat-pack wardrobe you assembled is harder to throw out than one you bought built.
  Nothing here is busywork — every field is one a form will ask — but the effort is the point as
  much as the data is.

  Money is not mentioned anywhere in here. Not once, not in passing: the panel says nothing about
  plans or prices until the first fill is attempted (see `usePaywallSeen`), and this flow ends one
  button short of that moment.
*/

type StepKind = 'story' | 'basics' | 'sources' | 'done'

interface Step {
  kind: StepKind
  /** Index into `STORY`, for the teaching screens. */
  story?: number
}

const STEPS: Step[] = [
  ...STORY.map((_, index) => ({ kind: 'story' as const, story: index })),
  { kind: 'basics' },
  { kind: 'sources' },
  { kind: 'done' },
]

export const ONBOARDING_STEP_COUNT = STEPS.length

/** The progress track: one segment per screen, filled up to where you are. */
function Progress({ index }: { index: number }) {
  return (
    <div className="flex flex-1 items-center gap-1" aria-hidden>
      {STEPS.map((step, position) => (
        <span
          key={`${step.kind}-${step.story ?? position}`}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            position <= index ? '' : 'bg-surface-muted'
          }`}
          style={
            position <= index
              ? { background: 'linear-gradient(90deg, var(--color-sparkle), var(--color-accent))' }
              : undefined
          }
        />
      ))}
    </div>
  )
}

/** The header of a working step: the mark, small, still talking. */
function StepHeading({
  expression,
  title,
  body,
}: {
  expression: Expression
  title: string
  body: string
}) {
  return (
    <div className="flex gap-3">
      <Mascot expression={expression} size={34} blink className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <h1 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  )
}

/** One number the user has just made true. Three of them are the last screen's whole content. */
function Tally({ value, label, tone }: { value: string; label: string; tone?: 'accent' }) {
  return (
    <div className="pop rounded-2xl border border-border-muted bg-surface-raised p-3 text-center">
      <p
        className={`font-display text-xl font-bold tabular-nums ${
          tone === 'accent' ? 'sunset-text' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-2xs leading-snug text-ink-dim">{label}</p>
    </div>
  )
}

/**
 * The last screen: what they built, in three numbers, and the one button that spends it.
 *
 * The numbers are read off the profile rather than counted as the user goes, so they are the same
 * numbers My info will show a minute from now. `characters read` is the one people react to — it is
 * the difference between "I gave it a link" and "it read my site".
 */
function Done({ profile }: { profile: Profile | undefined }) {
  const reconciled = reconcile(profile ?? { identity: {}, custom: {} })
  const facts = factCount(reconciled)
  const sources = profile?.sources ?? []
  const read = sources.reduce((total, source) => total + (source.extractedChars ?? 0), 0)

  return (
    <div className="text-center">
      <BlobMascot expression="party" size={116} className="mx-auto" />

      <h1 className="mt-3 font-display text-xl font-bold tracking-[-0.02em] text-ink">
        That is everything I need
      </h1>
      <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-muted">
        Open a form and press Fill. I will answer what I can from this, mark anything I guessed, and
        learn from whatever you change.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tally value={String(facts)} label={plural(facts, 'fact', 'facts')} />
        <Tally value={String(sources.length)} label={plural(sources.length, 'source')} />
        <Tally value={formatCount(read)} label="characters read" tone="accent" />
      </div>

      <ul className="mt-4 space-y-2 text-left">
        {[
          'Click any field on any form — your answer is already there',
          'Press Fill for the whole form, long answers included',
          'Add more about yourself any time in My info',
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-positive-muted text-positive">
              <IconCheck className="size-2.5" />
            </span>
            <span className="text-sm leading-snug text-ink-muted">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Onboarding({
  account,
  profile,
  step,
  onStep,
  onFinish,
}: {
  account: Account
  profile: Profile | undefined
  step: number
  onStep: (step: number) => void
  onFinish: () => void
}) {
  const index = Math.min(Math.max(0, step), STEPS.length - 1)
  const current = STEPS[index] ?? { kind: 'story' as const, story: 0 }
  const story = current.story !== undefined ? STORY[current.story] : undefined

  const stage = useRef<HTMLDivElement>(null)
  const look = useMascotGaze(stage)

  /**
   * How many of the basics are answered, as its own screen reports it.
   *
   * Held here because the footer is here: the button that gates on five filled fields cannot live
   * inside the scrolling body without becoming a button people scroll past. Seeded from the stored
   * profile so a returning user is not told to answer five questions they answered yesterday.
   */
  const [basicsFilled, setBasicsFilled] = useState(() => countBasics(profile))

  // Scroll to the top on every step. Without this, arriving at a short screen from a long one
  // starts you halfway down a blank page.
  const body = useRef<HTMLDivElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step *is* the trigger
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [index])

  const sourceCount = (profile?.sources ?? []).length

  const next = () => (index === STEPS.length - 1 ? onFinish() : onStep(index + 1))

  /** What the footer's one button says and whether it can be pressed. */
  const action: { label: string; disabled?: boolean; note?: ReactNode } =
    current.kind === 'basics'
      ? {
          label: 'Next: something to read',
          disabled: basicsFilled < BASICS_REQUIRED,
          note:
            basicsFilled < BASICS_REQUIRED
              ? `${BASICS_REQUIRED - basicsFilled} more ${plural(BASICS_REQUIRED - basicsFilled, 'answer')} and we are through the typing.`
              : undefined,
        }
      : current.kind === 'sources'
        ? {
            label: sourceCount > 0 ? 'Done — see what I know' : 'Add one thing to carry on',
            disabled: sourceCount === 0,
            note:
              sourceCount === 0
                ? 'One file, link or note. Without something to read I can only answer the fields you typed above.'
                : undefined,
          }
        : current.kind === 'done'
          ? { label: 'Take me to my first form' }
          : { label: index === 0 ? 'Show me' : 'Next' }

  return (
    <Screen>
      <header className="relative z-10 flex shrink-0 items-center gap-2 px-gutter py-3">
        <button
          type="button"
          onClick={() => onStep(index - 1)}
          aria-label="Back"
          disabled={index === 0}
          className="-ml-2.5 flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-0"
        >
          <IconBack className="size-4" />
        </button>

        <Progress index={index} />

        {/*
          A way out that is not a dead end.

          The two working steps gate their Continue button, and a gate with no bypass is a trap —
          somebody who does not want to type their phone number into a browser panel on first
          meeting is a user, not an obstacle. "Later" ends the flow and drops them on Fill, where
          My info is one tab away. The story steps get "Skip" for the same reason.
        */}
        {current.kind !== 'done' && (
          <button
            type="button"
            onClick={current.kind === 'story' ? () => onStep(STORY.length) : () => onFinish()}
            className="shrink-0 rounded-full px-2 py-1 text-2xs font-semibold text-ink-dim transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {current.kind === 'story' ? 'Skip the tour' : 'Later'}
          </button>
        )}
      </header>

      <ScreenBody ref={body} className="relative">
        {/* The weather only comes out for the screens that are mostly mascot. */}
        {current.kind !== 'basics' && current.kind !== 'sources' && (
          <BlobBackdrop className="opacity-70" />
        )}

        <div
          ref={stage}
          key={index}
          className="step-in relative px-gutter pb-6 pt-2"
          style={{ '--in': '40ms' } as React.CSSProperties}
        >
          {current.kind === 'story' && story && (
            <>
              <BlobMascot
                expression={story.expression}
                look={look}
                size={index === 0 ? 148 : 116}
                className="breathe mx-auto"
              />
              <h1 className="mt-4 text-center font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-ink">
                {story.title}
              </h1>
              <p className="mx-auto mt-2.5 max-w-[34ch] text-center text-base leading-relaxed text-ink-muted">
                {story.body}
              </p>
              {story.demo}
            </>
          )}

          {current.kind === 'basics' && (
            <>
              <StepHeading
                expression="happy"
                title="Now — who are you?"
                body="These are the questions every form asks. Answer five and I can start; the rest can wait."
              />
              <div className="mt-4">
                <Basics account={account} profile={profile} onCountChange={setBasicsFilled} />
              </div>
            </>
          )}

          {current.kind === 'sources' && (
            <>
              <StepHeading
                expression="wow"
                title="Give me something to read"
                body="Your résumé is the best one. I pull out your history, your writing and how you describe your work — and use it for the questions no field can answer on its own."
              />
              <div className="mt-4">
                <Sources />
              </div>
            </>
          )}

          {current.kind === 'done' && <Done profile={profile} />}
        </div>
      </ScreenBody>

      <ScreenFooter>
        {action.note && (
          <p className="mb-2 text-2xs leading-snug text-ink-dim" aria-live="polite">
            {action.note}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          block
          disabled={action.disabled}
          onClick={next}
          autoFocus={current.kind === 'story'}
        >
          {current.kind === 'done' ? (
            <IconMascot className="size-4" />
          ) : (
            <IconSparkle className="size-4" />
          )}
          {action.label}
        </Button>
      </ScreenFooter>
    </Screen>
  )
}
