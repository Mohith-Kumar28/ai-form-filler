import { type ReactNode, useEffect, useState } from 'react'
import { formatCount } from '../../../lib/format.js'
import { useReducedMotion } from '../../../lib/use-reduced-motion.js'
import { AiBadge, Card, type Expression } from '../components.js'
import { IconAudio, IconCheck, IconDocument, IconLink, IconSparkle, IconText } from '../icons.js'

/*
  The four things worth saying before asking for anything.

  Each one is a claim the product has to make good on, demonstrated rather than described: the
  suggestion appearing in a field, the correction being remembered, a link being *read* rather than
  stored, and an answer admitting it was a guess. A screenshot would say all of this faster, but a
  screenshot of a 400px panel inside a 400px panel is unreadable — so these are small live
  reconstructions, built from the same components the real surfaces use.

  Every demo loops on a timer rather than a CSS animation. A CSS loop can animate one property
  beautifully and cannot sequence four states, and these are all sequences: type, accept, correct,
  remember. Reduced motion pins each one at its last frame, which is the frame that makes the
  point.
*/

/** Steps a demo through its states on a timer. Reduced motion holds the last one. */
function useCycle(length: number, everyMs = 1500): number {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduced || length < 2) return
    const timer = setInterval(() => setIndex((current) => (current + 1) % length), everyMs)
    return () => clearInterval(timer)
  }, [length, everyMs, reduced])

  return reduced ? length - 1 : index
}

/** The shell every demo sits in: a card the width of the screen, with a quiet caption. */
function Demo({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="mt-5">
      <Card className="overflow-hidden p-3.5">{children}</Card>
      {caption && <p className="mt-2 px-1 text-2xs leading-snug text-ink-dim">{caption}</p>}
    </div>
  )
}

/** A form field as it looks on somebody else's page — label above, filled control below. */
function MockField({
  label,
  children,
  tone = 'plain',
}: {
  label: string
  children: ReactNode
  tone?: 'plain' | 'known' | 'guessed'
}) {
  const ring =
    tone === 'known'
      ? 'border-positive/60 shadow-[0_0_0_3px_var(--color-positive-muted)]'
      : tone === 'guessed'
        ? 'border-accent/60 shadow-[0_0_0_3px_var(--color-accent-muted)]'
        : 'border-border'

  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-dim">{label}</p>
      <div
        className={`mt-1.5 flex min-h-9 items-center gap-2 rounded-xl border bg-surface px-2.5 text-sm text-ink transition-[border-color,box-shadow] duration-300 ${ring}`}
      >
        {children}
      </div>
    </div>
  )
}

/* ── 2 · the inline suggestion ────────────────────────────────────────────── */

/**
 * Focus a field, and the answer is already there.
 *
 * Three beats: empty and focused, the value typing in, then accepted and marked as read from
 * their own info. The "Tab" key cap is the part people miss in the real product, so it is the one
 * piece of chrome the demo bothers to draw.
 */
function InlineDemo() {
  const beat = useCycle(3, 1600)

  return (
    <Demo caption="Works on any form, before you ask for anything.">
      <MockField label="Email" tone={beat === 2 ? 'known' : 'plain'}>
        {beat === 0 ? (
          <span className="caret text-accent">|</span>
        ) : (
          <>
            <span
              className={beat === 1 ? 'type-in text-ink-dim' : 'text-ink'}
              style={{ '--chars': '22ch', '--steps': 22 } as React.CSSProperties}
            >
              ifeoma@fastmail.com
            </span>
            {beat === 1 ? (
              <span className="ml-auto shrink-0 rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-2xs font-bold text-ink-muted">
                Tab
              </span>
            ) : (
              <span className="ml-auto flex shrink-0 items-center gap-1 text-2xs font-bold text-positive">
                <IconCheck className="size-3" />
                From your info
              </span>
            )}
          </>
        )}
      </MockField>
    </Demo>
  )
}

/* ── 3 · learning from a correction ───────────────────────────────────────── */

/**
 * The correction, and the next form.
 *
 * This is the feature that is hardest to believe and easiest to show: the same question, asked
 * again somewhere else, already carrying the answer the user fixed by hand. Two rows, and the
 * second one only appears once the first has been remembered.
 */
function LearnDemo() {
  const beat = useCycle(4, 1500)

  return (
    <Demo caption="Corrections are the strongest signal there is. Nothing you fix is asked twice.">
      <MockField label="Notice period · greenhouse.io">
        {beat === 0 ? (
          <span className="text-ink-dim">1 month</span>
        ) : (
          <>
            <span className="text-ink">2 months</span>
            {beat >= 2 && (
              <span className="pop ml-auto flex shrink-0 items-center gap-1 rounded-full bg-positive-muted px-2 py-0.5 text-2xs font-bold text-positive">
                <IconCheck className="size-3" />
                Remembered
              </span>
            )}
          </>
        )}
      </MockField>

      {/*
        The second form is always drawn, empty, rather than appearing at the end.

        It held its space with `opacity-0` first, which left a third of the card blank for three
        beats out of four — a card that looks broken until the animation happens to be at the right
        moment. An empty field is also the more honest picture: this is the next form you open, and
        it is empty until the answer you fixed is carried into it.
      */}
      <div className="mt-3 border-t border-border-muted pt-3">
        <MockField label="Notice period · lever.co" tone={beat === 3 ? 'known' : 'plain'}>
          {beat === 3 ? (
            <>
              <span className="text-ink">2 months</span>
              <span className="ml-auto shrink-0 text-2xs font-bold text-positive">
                Already knew
              </span>
            </>
          ) : (
            <span className="text-ink-dim">Not asked yet</span>
          )}
        </MockField>
      </div>
    </Demo>
  )
}

/* ── 4 · everything you can feed it ───────────────────────────────────────── */

const FEED = [
  { icon: <IconDocument className="size-3.5" />, label: 'Résumé.pdf', read: 18431 },
  { icon: <IconLink className="size-3.5" />, label: 'your-site.com/about', read: 6120 },
  { icon: <IconAudio className="size-3.5" />, label: 'Voice note · 0:42', read: 1980 },
  { icon: <IconText className="size-3.5" />, label: 'Pasted notes', read: 3240 },
]

/**
 * A link is not a bookmark.
 *
 * The whole point of this screen, and the thing users assume we do not do: the page behind a URL
 * is fetched, read, and kept as text — so the counter is the hero of the demo, not the chips.
 * Numbers are the fixture account's real character counts, which is also roughly what one résumé
 * and one about-page actually come to.
 */
function SourcesDemo() {
  // One-based: the cycle never rests on "0 characters read", which is the one frame that makes the
  // screen's whole claim look false.
  const shown = useCycle(FEED.length, 900) + 1
  const read = FEED.slice(0, shown).reduce((total, item) => total + item.read, 0)

  return (
    <Demo caption="Files, links, voice notes, anything pasted. It keeps the contents, not the address.">
      <div className="flex flex-wrap gap-1.5">
        {FEED.map((item, index) => (
          <span
            key={item.label}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-all duration-500 ${
              index < shown
                ? 'border-transparent bg-accent-muted text-accent'
                : 'border-border-muted bg-surface text-ink-dim opacity-50'
            }`}
          >
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${(shown / FEED.length) * 100}%`,
            background: 'linear-gradient(90deg, var(--color-sparkle), var(--color-accent))',
          }}
        />
      </div>

      <p className="mt-2.5 text-xs text-ink-muted">
        <span className="font-display text-lg font-bold tabular-nums text-ink">
          {formatCount(read)}
        </span>{' '}
        characters read into what it knows about you
      </p>
    </Demo>
  )
}

/* ── 5 · when it is not sure ───────────────────────────────────────────────── */

/**
 * Two answers, marked differently, because they are different kinds of thing.
 *
 * Lime for what it read off your own info; pink and sparkled for what it wrote. No animation:
 * this screen is a legend, and a legend that moves is harder to read than one that does not.
 */
function HonestyDemo() {
  return (
    <Demo caption="Nothing is submitted for you. You always press the button.">
      <MockField label="Phone" tone="known">
        <span className="text-ink">+44 7911 248 630</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-2xs font-bold text-positive">
          <IconCheck className="size-3" />
          From your info
        </span>
      </MockField>

      <div className="mt-3">
        <MockField label="Why do you want this role?" tone="guessed">
          <span className="truncate text-ink">I have spent four years shipping…</span>
        </MockField>
        <div className="mt-2 flex items-center gap-2">
          <AiBadge />
          <span className="flex items-center gap-1 text-2xs font-semibold text-accent">
            <IconSparkle className="size-3" />
            Not sure — worth a look
          </span>
        </div>
      </div>
    </Demo>
  )
}

/* ── the story ─────────────────────────────────────────────────────────────── */

export interface StoryStep {
  key: string
  expression: Expression
  title: ReactNode
  body: string
  demo?: ReactNode
}

export const STORY: StoryStep[] = [
  {
    key: 'meet',
    expression: 'excited',
    title: (
      <>
        Hi — I’m <span className="sunset-text">Fillaform</span>.
      </>
    ),
    body: 'Job applications, visa forms, sign-ups — the same twelve questions you have answered a hundred times, and the long written ones too.',
  },
  {
    key: 'inline',
    expression: 'happy',
    title: 'Your answers, already in the field',
    body: 'Click into a field and your answer is waiting there. Press Tab to take it — no button, no waiting. It is your own information.',
    demo: <InlineDemo />,
  },
  {
    key: 'learn',
    expression: 'wink',
    title: 'Fix me once and I keep it',
    body: 'Every answer you change teaches me. Fix “1 month” to “2 months”, and the next form to ask already says two — in your words.',
    demo: <LearnDemo />,
  },
  {
    key: 'sources',
    expression: 'wow',
    title: 'Feed me anything about you',
    body: 'A résumé, a portfolio link, a voice note, notes you paste in. I read what is inside each one and keep the contents — not the address.',
    demo: <SourcesDemo />,
  },
  {
    key: 'honesty',
    expression: 'think',
    title: 'And I tell you when I guessed',
    body: 'Green means I read it straight off your info. Pink with a sparkle means I wrote it — and if I was not sure, I say so.',
    demo: <HonestyDemo />,
  },
]
