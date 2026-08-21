import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconCheck, IconClose, IconMascot, IconPen, IconSparkle } from '@/components/ui'
import { cn } from '@/lib/cn'

/**
 * A working replica of the extension's on-page overlay.
 *
 * Everything here mirrors `apps/extension/src/overlay/*` — the launcher's three shapes, the
 * mark states, the provenance tab's wording, and the answer card. If the extension's behaviour
 * changes, this is the other place to change.
 *
 * The two rules that are easy to get wrong, both from `markers.ts`:
 *
 *   • **The Unmarked Fact Rule.** An answer read straight off the profile settles green and
 *     then leaves *nothing behind*. The absence is the notation. Only judged answers keep a
 *     ring, and only judged answers get a tab.
 *   • **The tab is a label, not a chore.** It says what is true about the answer — "I guessed"
 *     or "not sure" — never "needs a look", which reads as six errors on a six-field form.
 */

/* ── The form being filled ────────────────────────────────────────────────── */

type FieldKind = 'text' | 'email' | 'select' | 'radio' | 'checkbox' | 'longtext'

/** Why an answer is what it is. `stated` was read off the profile; the rest are judgements. */
type Provenance = 'stated' | 'inferred' | 'unsure'

interface DemoField {
  id: string
  label: string
  kind: FieldKind
  answer: string
  provenance: Provenance
  options?: string[]
  required?: boolean
  /** Alternates the rewrite chips cycle through, so a nudge visibly changes something. */
  variants?: string[]
}

const FIELDS: DemoField[] = [
  { id: 'name', label: 'Full name', kind: 'text', answer: 'Ifeoma Balogun', provenance: 'stated' },
  {
    id: 'email',
    label: 'Email address',
    kind: 'email',
    answer: 'ifeoma.balogun@fastmail.com',
    provenance: 'stated',
  },
  {
    id: 'visa',
    label: 'Do you need visa sponsorship?',
    kind: 'radio',
    options: ['Yes', 'No'],
    answer: 'No',
    provenance: 'stated',
  },
  {
    id: 'heard',
    label: 'How did you hear about this role?',
    kind: 'select',
    options: ['LinkedIn', 'A friend', 'Our careers page', 'A recruiter', 'Other'],
    answer: 'LinkedIn',
    provenance: 'unsure',
  },
  {
    id: 'skills',
    label: 'Which of these have you worked with?',
    kind: 'checkbox',
    options: ['Postgres', 'Kubernetes', 'Terraform', 'TypeScript', 'Go'],
    answer: 'Postgres, Terraform, TypeScript',
    provenance: 'inferred',
  },
  {
    id: 'start',
    label: 'Earliest start date',
    kind: 'text',
    answer: '3 November 2026',
    provenance: 'stated',
    variants: ['Early November 2026', 'From 3 November, or sooner if needed'],
  },
  {
    id: 'why',
    label: 'Why do you want to work at Alderman & Roe?',
    kind: 'longtext',
    required: true,
    provenance: 'inferred',
    answer:
      'I spent four years at Kestrel Health rebuilding a claims pipeline nobody wanted to touch, and the part I liked was the archaeology of working out why a system had ended up the way it had before changing it. Your engineering posts read like people who do that on purpose.',
    variants: [
      'Four years at Kestrel Health, mostly rebuilding a claims pipeline nobody else wanted. What I liked was the archaeology: understanding why a system ended up the way it did before touching it. Your engineering posts read like people who work that way too.',
      'I rebuilt a claims pipeline at Kestrel Health over four years. The work I enjoy is figuring out why a system is the way it is before changing it, which is what your engineering writing sounds like.',
    ],
  },
  {
    id: 'salary',
    label: 'Salary expectations',
    kind: 'text',
    answer: '£72,000',
    provenance: 'unsure',
    variants: ['£72,000, negotiable for the right team', '£68,000 – £78,000'],
  },
]

/**
 * What the launcher's rail cycles through while the model works. From `STAGE_MESSAGES` in
 * `launcher.ts` — one line per stage there, flattened here because the demo's clock is fake
 * and runs through all three whatever the model is doing.
 */
const LOADING_MESSAGES = ['Reading the form…', 'Writing your answers…', 'Filling the fields…']

/**
 * The keyboard shortcut the extension suggests, written the way each platform writes it.
 *
 * Set after mount rather than at module scope: this page is server-rendered, and a Mac
 * visitor would otherwise get "Alt+F" in the HTML and "⌥F" from the first client
 * render, which React reports as a hydration mismatch. The extension itself reads the real
 * binding out of `chrome.commands`, so the demo shows the default it ships with.
 */
const SHORTCUT_DEFAULT = 'Alt+F'
const SHORTCUT_MAC = '\u2325F'

/** The tab's two words. From `TAB_LABEL` in `markers.ts`. */
const TAB_LABEL: Record<'inferred' | 'unsure', string> = {
  inferred: 'I guessed',
  unsure: 'not sure',
}

/** The card header's wording. From `REASON_LABEL` in `card.ts`. */
const REASON_LABEL: Record<Provenance, string> = {
  inferred: 'I guessed',
  unsure: 'not sure',
  stated: 'your answer',
}

/** Chip labels from `packages/shared/src/rewrite.ts` — keep the two lists in step. */
const TONES = ['warmer', 'confident', 'plainer', 'more formal']
const LENGTHS = ['shorter', 'expand']

/* ── State ────────────────────────────────────────────────────────────────── */

type Phase = 'idle' | 'thinking' | 'filling' | 'done'
/** Mirrors `MarkState` in `markers.ts`, minus `failed` (nothing fails in a demo). */
type MarkState = 'active' | 'stated' | 'judged'

const isJudged = (p: Provenance) => p !== 'stated'

export function ExtensionDemo() {
  const reduce = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('idle')
  const [values, setValues] = useState<Record<string, string>>({})
  const [marks, setMarks] = useState<Record<string, MarkState | undefined>>({})
  const [progress, setProgress] = useState(0)
  const [loadingIndex, setLoadingIndex] = useState(0)

  /** The field the pointer is in, which is what shows the sparkle/pen trigger. */
  const [activeField, setActiveField] = useState<string | null>(null)
  /** The field whose answer card is open. Only one at a time, as in the extension. */
  const [openCard, setOpenCard] = useState<string | null>(null)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  // Rotating reassurance while the model thinks.
  useEffect(() => {
    if (phase !== 'thinking') return
    const id = setInterval(() => setLoadingIndex((i) => i + 1), 1400)
    return () => clearInterval(id)
  }, [phase])

  const reset = useCallback(() => {
    clearTimers()
    setPhase('idle')
    setValues({})
    setMarks({})
    setProgress(0)
    setLoadingIndex(0)
    setOpenCard(null)
    setActiveField(null)
  }, [clearTimers])

  const startFill = useCallback(() => {
    clearTimers()
    setOpenCard(null)
    setValues({})
    setMarks({})
    setProgress(0)
    setLoadingIndex(0)
    setPhase('thinking')

    // Think first, then write the fields one at a time.
    const THINK = reduce ? 300 : 2200
    const STEP = reduce ? 90 : 460

    after(THINK, () => setPhase('filling'))

    FIELDS.forEach((field, i) => {
      const at = THINK + i * STEP
      after(at, () => setMarks((m) => ({ ...m, [field.id]: 'active' })))
      after(at + STEP * 0.6, () => {
        setValues((v) => ({ ...v, [field.id]: field.answer }))
        setProgress(i + 1)
        setMarks((m) => ({ ...m, [field.id]: isJudged(field.provenance) ? 'judged' : 'stated' }))
        // The Unmarked Fact Rule: a stated answer settles, then leaves nothing behind.
        if (!isJudged(field.provenance)) {
          after(1500, () => setMarks((m) => ({ ...m, [field.id]: undefined })))
        }
      })
    })

    after(THINK + FIELDS.length * STEP + 400, () => setPhase('done'))
  }, [after, clearTimers, reduce])

  const stop = useCallback(() => {
    clearTimers()
    setPhase('idle')
    setMarks({})
    setProgress(0)
  }, [clearTimers])

  const setValue = useCallback((id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }))
  }, [])

  const clearField = useCallback((id: string) => {
    setValues((v) => ({ ...v, [id]: '' }))
    setMarks((m) => ({ ...m, [id]: undefined }))
  }, [])

  const judgedCount = FIELDS.filter((f) => isJudged(f.provenance)).length

  return (
    <div className="relative">
      {/* The page being filled */}
      <div className="rounded-2xl border border-border-muted bg-surface p-5 pr-16 sm:p-6 md:p-8">
        <div className="mb-6 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
            Job application
          </p>
          <h3 className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">
            Engineering Manager
          </h3>
          <p className="text-[13px] text-ink-muted">Alderman &amp; Roe · Bristol, UK · Remote</p>
        </div>

        <div className="space-y-5">
          {FIELDS.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              value={values[field.id] ?? ''}
              mark={marks[field.id]}
              active={activeField === field.id}
              cardOpen={openCard === field.id}
              onActivate={() => setActiveField(field.id)}
              onOpenCard={() => setOpenCard(field.id)}
              onCloseCard={() => setOpenCard(null)}
              onChange={(next) => setValue(field.id, next)}
              onClear={() => clearField(field.id)}
            />
          ))}
        </div>
      </div>

      <Launcher
        phase={phase}
        judgedCount={judgedCount}
        progress={progress}
        total={FIELDS.length}
        message={LOADING_MESSAGES[loadingIndex % LOADING_MESSAGES.length] ?? LOADING_MESSAGES[0]}
        onFill={startFill}
        onStop={stop}
        onReset={reset}
      />
    </div>
  )
}

/* ── The launcher ─────────────────────────────────────────────────────────────
 *
 * A circle with a rail running from it to the right edge, exactly as in `launcher.ts`.
 * The circle is the button; the rail carries the one thing there is to say — the keyboard
 * shortcut when idle, the stage while it thinks, `done/total` and a stop button while
 * answers land, and what is left to check when it finishes.
 *
 * The rail replaced a field-count pill and a stop button that hung *below* the circle: both
 * were wider than the 38px they hung from and both spent their lives being nudged away from
 * falling off the right of the window. On a real page the rail meets the edge of the viewport;
 * here it meets the edge of the card, which is that page's stand-in.
 */

/**
 * The nudge that tells you the demo is yours to drive.
 *
 * A replica of the overlay is not self-evidently interactive: it looks like a screenshot, so
 * people read it and scroll past. This is the one piece with no counterpart in the extension,
 * where the launcher arrives on a page the person came to fill and needs no invitation.
 *
 * It shows only in `idle`, so it is gone the moment the demo is running and comes back with
 * the reset.
 */
function ClickMe() {
  const reduce = useReducedMotion()

  return (
    <motion.span
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, 5, 0] }}
      exit={{ opacity: 0 }}
      transition={
        reduce
          ? { duration: 0.2 }
          : {
              x: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
              opacity: { duration: 0.4 },
            }
      }
      className="pointer-events-none relative flex items-center rounded-full bg-ink py-1.5 pr-3 pl-3 text-[11.5px] font-bold whitespace-nowrap text-surface shadow-card"
    >
      Click me to fill it
      {/* The arrowhead, pointing at the button on its right. */}
      <span
        aria-hidden
        className="absolute top-1/2 -right-[5px] size-2.5 -translate-y-1/2 rotate-45 rounded-[2px] bg-ink"
      />
    </motion.span>
  )
}

/**
 * One strip of text, running from the circle to the right edge — the whole of what the
 * launcher says. Square where it meets the frame, round where it meets the circle, tucked
 * under it by half a radius so the pair reads as one object rather than two.
 */
function Rail({
  children,
  tone = 'quiet',
}: {
  children: React.ReactNode
  tone?: 'quiet' | 'loud'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-l-full py-0 pr-3 pl-7 text-[11px] font-semibold shadow-card',
        // -ml-6 puts its left end under the circle; pl-7 brings the text back out again.
        '-ml-6',
        tone === 'loud'
          ? 'bg-[linear-gradient(135deg,var(--sparkle),var(--accent))] font-bold text-white'
          : // The hairline is what stops the strip disappearing into a light page — see the
            // same note on `.launcher-rail` in the extension's `host.ts`. Nothing on the right:
            // that edge is the frame, and a line along it reads as a seam.
            'border border-r-0 border-border-muted bg-surface-raised text-ink-dim',
      )}
    >
      {children}
    </motion.div>
  )
}

function Launcher({
  phase,
  judgedCount,
  progress,
  total,
  message,
  onFill,
  onStop,
  onReset,
}: {
  phase: Phase
  judgedCount: number
  progress: number
  total: number
  message: string
  onFill: () => void
  onStop: () => void
  onReset: () => void
}) {
  const filling = phase === 'filling'
  const thinking = phase === 'thinking'
  const done = phase === 'done'

  // See SHORTCUT_DEFAULT — set after mount so server and first client render agree.
  const [shortcut, setShortcut] = useState(SHORTCUT_DEFAULT)
  useEffect(() => {
    if (/mac/i.test(navigator.platform || navigator.userAgent)) setShortcut(SHORTCUT_MAC)
  }, [])

  return (
    <div className="absolute top-16 right-0 z-20 flex items-center">
      <AnimatePresence>{phase === 'idle' && <ClickMe key="nudge" />}</AnimatePresence>

      {/* The grabber. Decorative here — on a real page it drags the launcher up and down. */}
      <span className="mr-1 grid grid-cols-2 gap-[3px] opacity-40" aria-hidden>
        {/* Six, in two columns of three — the grabber glyph. Three in a line is a kebab menu. */}
        {['a', 'b', 'c', 'd', 'e', 'f'].map((dot) => (
          <span key={dot} className="size-[3px] rounded-full bg-ink-dim" />
        ))}
      </span>

      <button
        type="button"
        onClick={done ? onReset : filling || thinking ? undefined : onFill}
        disabled={filling || thinking}
        aria-label={
          done ? 'Fill again' : filling || thinking ? 'Filling this form' : 'Fill this form'
        }
        title={done ? 'Fill again' : `Fill all fields (${shortcut})`}
        className={cn(
          'relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-card transition-all duration-200',
          thinking && 'animate-pulse-soft',
          // Idle, the ring breathes so the eye lands on the one thing worth clicking.
          phase === 'idle' && 'ring-4 ring-accent/25 animate-pulse-soft',
          !filling && !thinking && 'hover:brightness-110',
        )}
        style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
      >
        <IconMascot className={cn('size-5 shrink-0', thinking && 'animate-spin-slow')} />
      </button>

      {thinking && (
        <Rail>
          <span
            className="size-[5px] shrink-0 animate-pulse rounded-full"
            style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
            aria-hidden
          />
          {message}
        </Rail>
      )}

      {filling && (
        <Rail>
          <span className="font-display tabular-nums">
            {progress}/{total}
          </span>
          {/* Stop, at the rail's right end, where it is pinned to the frame and cannot move.
              It used to hang below a pill whose width changed with every digit of the count. */}
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop filling"
            className="-mr-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-[filter] hover:brightness-110"
          >
            <IconClose className="size-2.5" />
          </button>
        </Rail>
      )}

      {done && <Rail>{judgedCount} to check</Rail>}

      {/* Idle: the shortcut, as a key cap. A number of fields is not something anyone acts on;
          a key is, so the key gets the pixels and the count goes to the button's tooltip. */}
      {phase === 'idle' && (
        <Rail>
          <kbd className="rounded-[5px] border border-border bg-surface px-1.5 py-[3px] font-sans text-[10.5px] font-bold text-ink">
            {shortcut}
          </kbd>
        </Rail>
      )}
    </div>
  )
}

/* ── One field, with everything the overlay draws on it ───────────────────── */

function FieldRow({
  field,
  value,
  mark,
  active,
  cardOpen,
  onActivate,
  onOpenCard,
  onCloseCard,
  onChange,
  onClear,
}: {
  field: DemoField
  value: string
  mark: MarkState | undefined
  active: boolean
  cardOpen: boolean
  onActivate: () => void
  onOpenCard: () => void
  onCloseCard: () => void
  onChange: (next: string) => void
  onClear: () => void
}) {
  const filled = value !== ''
  const judged = mark === 'judged'
  const multiline = field.kind === 'longtext'

  // The ring the overlay paints over the field. `stated` settles and is then removed
  // upstream, leaving nothing — see the Unmarked Fact Rule.
  const ring =
    mark === 'active'
      ? 'border-accent ring-2 ring-accent/25'
      : mark === 'stated'
        ? 'border-positive ring-2 ring-positive/25'
        : judged
          ? 'border-accent/60'
          : 'border-border'

  const control = cn(
    'w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-left text-[13px] text-ink transition-all duration-300 outline-none',
    ring,
  )

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[12px] font-semibold text-ink-muted">{field.label}</span>
        {field.required && <span className="text-[10px] text-ink-dim">required</span>}
      </div>

      <div className="relative">
        {/* The provenance tab. Above the border, right-aligned — the fallback placement
            from `placeTab`, since a full-width field has no gutter beside it. */}
        <AnimatePresence>
          {judged && field.provenance !== 'stated' && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={onOpenCard}
              aria-label="Check this answer"
              className="absolute -top-[22px] right-0 z-10 inline-flex h-[18px] items-center gap-1 rounded-t-md rounded-b-[2px] bg-accent px-[7px] text-[10.5px] font-bold leading-none text-white shadow-glow"
            >
              <IconSparkle className="size-2.5" />
              {TAB_LABEL[field.provenance]}
            </motion.button>
          )}
        </AnimatePresence>

        {field.kind === 'radio' || field.kind === 'checkbox' ? (
          <ChoiceControl field={field} value={value} className={control} onActivate={onActivate} />
        ) : multiline ? (
          <button type="button" onClick={onActivate} className={cn(control, 'min-h-[104px]')}>
            <span className={cn('block leading-relaxed', !filled && 'text-ink-dim')}>
              {value || ' '}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className={cn(control, 'flex h-[42px] items-center')}
          >
            <span className={!filled ? 'text-ink-dim' : undefined}>
              {value || (field.kind === 'select' ? 'Select…' : '')}
            </span>
          </button>
        )}

        {/* The field trigger. Sparkle on an empty field ("Fill this field"); a pen on one
            that already has an answer ("Rewrite this answer"). From `mountFieldTrigger`. */}
        <AnimatePresence>
          {active && !cardOpen && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.16, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={onOpenCard}
              aria-label={filled ? 'Rewrite this answer' : 'Fill this field'}
              title={filled ? 'Rewrite this answer' : 'Fill this field'}
              className={cn(
                'absolute right-2 z-10 flex size-[22px] items-center justify-center rounded-full transition-colors',
                multiline ? 'bottom-2' : 'top-1/2 -translate-y-1/2',
                filled
                  ? 'border border-border bg-surface text-ink-dim shadow-glow hover:border-accent hover:text-accent'
                  : 'text-white shadow-glow',
              )}
              style={
                filled
                  ? undefined
                  : { background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }
              }
            >
              {filled ? <IconPen className="size-3" /> : <IconSparkle className="size-3" />}
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {cardOpen && (
            <AnswerCard
              field={field}
              value={value}
              onChange={onChange}
              onClear={onClear}
              onClose={onCloseCard}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Radio and checkbox groups, drawn the way the page itself would draw them. */
function ChoiceControl({
  field,
  value,
  className,
  onActivate,
}: {
  field: DemoField
  value: string
  className: string
  onActivate: () => void
}) {
  const chosen = new Set(
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  const multiple = field.kind === 'checkbox'

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(className, 'flex flex-wrap items-center gap-x-4 gap-y-2 py-3')}
    >
      {(field.options ?? []).map((option) => {
        const on = chosen.has(option)
        return (
          <span key={option} className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center border-2 transition-all',
                multiple ? 'rounded-[4px]' : 'rounded-full',
                on ? 'border-accent bg-accent text-white' : 'border-border',
              )}
            >
              {on &&
                (multiple ? (
                  <IconCheck className="size-2.5" />
                ) : (
                  <span className="size-1.5 rounded-full bg-white" />
                ))}
            </span>
            {option}
          </span>
        )
      })}
    </button>
  )
}

/* ── The answer card ─────────────────────────────────────────────────────────
 *
 * The one place an answer can be changed. Opens below the field, left edge flush with
 * it — `place(…, 'start')` in `card.ts`, so the tab, the field and the card line up.
 * Prose gets a textarea and the rewrite controls; a choice gets its options.
 */

function AnswerCard({
  field,
  value,
  onChange,
  onClear,
  onClose,
}: {
  field: DemoField
  value: string
  onChange: (next: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const prose = !field.options?.length
  const multiple = field.kind === 'checkbox'

  const [history, setHistory] = useState<string[]>([])
  const [note, setNote] = useState<{ text: string; tone?: 'good' } | null>(null)
  const [rewriting, setRewriting] = useState(false)
  const [variant, setVariant] = useState(0)

  // Escape closes it, and the last field's card opens upward so it stays on screen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const flipUp = field.id === 'salary' || field.id === 'why'

  const commit = (next: string) => {
    setHistory((h) => [...h, value])
    onChange(next)
    setNote({ text: 'saved to the page', tone: 'good' })
  }

  const rewrite = () => {
    if (!field.variants?.length) return
    setRewriting(true)
    setNote({ text: 'rewriting…' })
    setTimeout(() => {
      const next = field.variants?.[variant % field.variants.length]
      setVariant((v) => v + 1)
      setRewriting(false)
      if (next) commit(next)
    }, 1100)
  }

  const toggleOption = (option: string) => {
    if (!multiple) {
      commit(option)
      return
    }
    const set = new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    if (set.has(option)) set.delete(option)
    else set.add(option)
    commit((field.options ?? []).filter((o) => set.has(o)).join(', '))
  }

  const chosen = new Set(
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

  return (
    <motion.div
      role="dialog"
      aria-label={field.label}
      initial={{ opacity: 0, y: flipUp ? 6 : -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: flipUp ? 6 : -6, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className={cn(
        'absolute left-0 z-30 w-[min(340px,calc(100vw-2.5rem))] rounded-xl border border-border bg-surface-raised p-3 shadow-card',
        flipUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
      )}
    >
      {/* head */}
      <div className="flex items-start gap-2 border-b border-border-muted pb-2.5">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-bold text-accent">
            <IconSparkle className="size-2.5" />
            {REASON_LABEL[field.provenance]}
          </span>
          <p className="mt-1.5 text-[12px] font-semibold leading-snug text-ink">{field.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-dim hover:bg-surface-muted hover:text-ink"
        >
          <IconClose className="size-3.5" />
        </button>
      </div>

      {/* the answer */}
      <div className="mt-2.5">
        {prose ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Answer"
            aria-busy={rewriting}
            rows={field.kind === 'longtext' ? 5 : 2}
            className={cn(
              'w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] leading-relaxed text-ink outline-none focus:border-accent',
              rewriting && 'opacity-50',
            )}
          />
        ) : (
          /*
           * Toggle buttons, not radios.
           *
           * This carried `role={multiple ? 'checkbox' : 'radio'}` with `aria-checked`, which is
           * right at runtime and unverifiable statically — and chasing it with literal roles only
           * moves the complaint along, because a checkbox role properly wants a real
           * `<input type="checkbox">`. `aria-pressed` is supported on a bare `<button>`, needs no
           * role on the button or its container, and announces exactly what these are: a row of
           * chips you press. Real radios would be the answer in a real form; this is the demo on
           * the marketing page, mirroring the overlay.
           */
          <fieldset aria-label={field.label} className="flex min-w-0 flex-wrap gap-1.5">
            {(field.options ?? []).map((option) => {
              const on = chosen.has(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleOption(option)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    on
                      ? 'border-accent bg-accent text-white'
                      : 'border-border text-ink-muted hover:border-accent/40 hover:text-ink',
                  )}
                >
                  {option}
                </button>
              )
            })}
          </fieldset>
        )}
      </div>

      {/* rewrite controls — prose only */}
      {prose && field.variants?.length ? (
        <div className="mt-2.5 space-y-1.5">
          <ChipRow label="Tone" chips={TONES} disabled={rewriting} onPick={rewrite} />
          <ChipRow label="Length" chips={LENGTHS} disabled={rewriting} onPick={rewrite} />
          <form
            onSubmit={(event) => {
              event.preventDefault()
              rewrite()
            }}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface pr-1 pl-3"
          >
            <input
              type="text"
              maxLength={200}
              placeholder="tell it what to change"
              aria-label="Tell it what to change"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[11.5px] text-ink outline-none placeholder:text-ink-dim"
            />
            <button
              type="submit"
              aria-label="Rewrite it"
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
            >
              <IconSparkle className="size-3" />
            </button>
          </form>
        </div>
      ) : null}

      {/* note + actions */}
      <p
        aria-live="polite"
        className={cn(
          'mt-2 h-3.5 text-[10.5px]',
          note?.tone === 'good' ? 'text-positive' : 'text-ink-dim',
        )}
      >
        {note?.text ?? ''}
      </p>

      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
        >
          Keep
        </button>
        <button
          type="button"
          disabled={history.length === 0}
          onClick={() => {
            const previous = history[history.length - 1]
            setHistory((h) => h.slice(0, -1))
            if (previous !== undefined) onChange(previous)
            setNote(null)
          }}
          className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => {
            setHistory((h) => [...h, value])
            onClear()
            setNote(null)
          }}
          className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          Clear
        </button>
      </div>
    </motion.div>
  )
}

function ChipRow({
  label,
  chips,
  disabled,
  onPick,
}: {
  label: string
  chips: string[]
  disabled: boolean
  onPick: () => void
}) {
  return (
    /*
     * `<fieldset>` rather than `<div role="group">`: same semantics, carried by the element
     * instead of an attribute. Tailwind's preflight already zeroes a fieldset's UA margin,
     * padding and border, so this renders identically; `min-w-0` overrides the one UA style it
     * does not reset, `min-width: min-content`, which would otherwise stop the row shrinking.
     */
    <fieldset aria-label={label} className="flex min-w-0 flex-wrap gap-1">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={onPick}
          className="rounded-full border border-border-muted px-2 py-0.5 text-[10.5px] font-medium text-ink-muted transition-colors hover:border-accent/40 hover:text-ink disabled:opacity-40"
        >
          {chip}
        </button>
      ))}
    </fieldset>
  )
}
