import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useState } from 'react'
import {
  Button,
  Card,
  type Expression,
  GuessedBadge,
  IconCheck,
  IconSparkle,
  Mascot,
  ReadBadge,
} from '@/components/ui'
import { cn } from '@/lib/cn'

/* ── Demo data (matches the extension's gallery fixtures) ────────────────── */

const FORM_FIELDS = [
  {
    id: 'f_name',
    label: 'Full name',
    value: '',
    kind: 'text',
    concluded: false,
    confidence: 0.99,
    tier: 0,
  },
  {
    id: 'f_email',
    label: 'Email address',
    value: '',
    kind: 'email',
    concluded: false,
    confidence: 0.99,
    tier: 0,
  },
  {
    id: 'f_auth',
    label: 'Do you require visa sponsorship?',
    value: '',
    kind: 'radio',
    concluded: false,
    confidence: 0.91,
    tier: 0,
    options: ['Yes', 'No'],
  },
  {
    id: 'f_hear',
    label: 'How did you hear about this role?',
    value: '',
    kind: 'select',
    concluded: false,
    confidence: 0.63,
    tier: 1,
    options: ['LinkedIn', 'A friend', 'Our careers page', 'A recruiter', 'Other'],
  },
  {
    id: 'f_notice',
    label: 'When could you start?',
    value: '',
    kind: 'text',
    concluded: false,
    confidence: 0.94,
    tier: 0,
  },
  {
    id: 'f_why',
    label: 'Why do you want to work at Alderman & Roe?',
    value: '',
    kind: 'longtext',
    concluded: true,
    confidence: 0.58,
    tier: 3,
  },
  {
    id: 'f_salary',
    label: 'What are your salary expectations?',
    value: '',
    kind: 'text',
    concluded: true,
    confidence: 0.41,
    tier: 2,
  },
]

const ANSWERS: Record<string, string> = {
  f_name: 'Ifeoma Balogun',
  f_email: 'ifeoma.balogun@fastmail.com',
  f_auth: 'No',
  f_hear: 'LinkedIn',
  f_notice: '3 November 2026',
  f_why:
    'I spent four years at Kestrel Health rebuilding a claims pipeline that nobody wanted to touch, and the part I liked was the archaeology — working out why a system had ended up the way it had before changing it. Your engineering posts read like people who do that on purpose rather than under duress.',
  f_salary: '£72,000',
}

const STAGES = [
  { key: 'detecting', label: 'Reading the room…', mascot: 'think' as Expression },
  { key: 'generating', label: 'Writing your answers…', mascot: 'think' as Expression },
  { key: 'applying', label: 'Slapping them in…', mascot: 'party' as Expression },
]

type DemoState = 'home' | 'filling' | 'review' | 'done'

export function ExtensionDemo() {
  const [state, setState] = useState<DemoState>('home')
  const [stage, setStage] = useState(0)
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set())
  const [showReview, setShowReview] = useState(false)

  const startFill = useCallback(() => {
    setState('filling')
    setStage(0)

    let step = 0
    const advance = () => {
      if (step < STAGES.length) {
        setStage(step)
        step++
        setTimeout(advance, step === 2 ? 1400 : 1200)
      } else {
        // Fill fields in sequence
        const fieldIds = FORM_FIELDS.map((f) => f.id)
        let fi = 0
        const fillNext = () => {
          if (fi < fieldIds.length) {
            setFilledFields((prev) => new Set([...prev, fieldIds[fi]!]))
            fi++
            setTimeout(fillNext, 300)
          } else {
            setTimeout(() => {
              setState('review')
            }, 600)
          }
        }
        fillNext()
      }
    }
    setTimeout(advance, 300)
  }, [])

  const reset = useCallback(() => {
    setState('home')
    setStage(0)
    setFilledFields(new Set())
    setShowReview(false)
  }, [])

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <div className="overflow-hidden rounded-2xl border border-border-muted bg-surface-muted shadow-card">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border-muted bg-surface px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full" style={{ background: 'var(--danger)' }} />
            <div className="size-3 rounded-full" style={{ background: 'var(--warning)' }} />
            <div className="size-3 rounded-full" style={{ background: 'var(--positive)' }} />
          </div>
          <div className="mx-auto flex h-7 w-full max-w-[380px] items-center rounded-full border border-border-muted bg-surface-muted px-3">
            <span className="text-[11px] text-ink-dim">
              boards.greenhouse.io/alderman-roe/jobs/engineering-manager
            </span>
          </div>
          <div className="w-[52px]" />
        </div>

        <div className="flex min-h-[540px] flex-col md:flex-row">
          {/* Form area — the web page */}
          <div className="flex-1 border-r border-border-muted bg-surface p-5 md:p-6">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                Job application
              </p>
              <h3 className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
                Engineering Manager
              </h3>
              <p className="text-[12px] text-ink-muted">Alderman & Roe · Bristol, UK · Remote</p>
            </div>

            <div className="mt-5 space-y-3.5">
              {FORM_FIELDS.map((field) => (
                <div key={field.id} className="space-y-1">
                  <label className="text-[12px] font-semibold text-ink-muted">
                    {field.label}
                    {field.kind === 'longtext' && (
                      <span className="ml-1.5 text-[11px] font-normal text-ink-dim">required</span>
                    )}
                  </label>
                  {field.kind === 'longtext' ? (
                    <div
                      className={cn(
                        'min-h-[60px] rounded-xl border px-3 py-2 text-[13px] leading-relaxed transition-all duration-300',
                        filledFields.has(field.id)
                          ? 'border-accent/40 bg-accent-muted/30 text-ink'
                          : 'border-border bg-surface-raised text-transparent',
                      )}
                    >
                      {filledFields.has(field.id) || state === 'review' || state === 'done'
                        ? ANSWERS[field.id]
                        : ''}
                    </div>
                  ) : field.kind === 'radio' ? (
                    <div className="flex gap-4 pt-1">
                      {field.options?.map((opt) => {
                        const selected = filledFields.has(field.id) && ANSWERS[field.id] === opt
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2 text-[13px] text-ink-muted"
                          >
                            <span
                              className={cn(
                                'flex size-4 items-center justify-center rounded-full border-2 transition-all',
                                selected ? 'border-accent bg-accent' : 'border-border',
                              )}
                            >
                              {selected && <span className="size-2 rounded-full bg-white" />}
                            </span>
                            {opt}
                          </label>
                        )
                      })}
                    </div>
                  ) : field.kind === 'select' ? (
                    <div
                      className={cn(
                        'rounded-xl border px-3 py-2 text-[13px] transition-all duration-300',
                        filledFields.has(field.id)
                          ? 'border-accent/40 bg-accent-muted/30 text-ink'
                          : 'border-border bg-surface-raised text-ink-dim',
                      )}
                    >
                      {filledFields.has(field.id) || state === 'review' || state === 'done'
                        ? ANSWERS[field.id]
                        : 'Select…'}
                    </div>
                  ) : (
                    <input
                      readOnly
                      value={
                        filledFields.has(field.id) || state === 'review' || state === 'done'
                          ? ANSWERS[field.id]
                          : ''
                      }
                      placeholder=" "
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-[13px] text-ink transition-all duration-300 outline-none',
                        filledFields.has(field.id)
                          ? 'border-accent/40 bg-accent-muted/30'
                          : 'border-border bg-surface-raised',
                      )}
                    />
                  )}
                </div>
              ))}

              <div className="pt-3 pb-5">
                <div className="h-9 w-28 rounded-full bg-border/40" />
              </div>
            </div>
          </div>

          {/* Side panel — the extension UI, 400px equivalent */}
          <div className="flex w-full shrink-0 flex-col border-t border-border-muted bg-surface md:w-[400px] md:border-t-0 md:border-l">
            <AnimatePresence mode="wait">
              {state === 'home' && <HomePanel key="home" onFill={startFill} />}
              {state === 'filling' && <FillingPanel key="filling" stage={stage} />}
              {state === 'review' && (
                <ReviewPanel
                  key="review"
                  onDone={() => setState('done')}
                  showSettled={showReview}
                  onToggleSettled={() => setShowReview((v) => !v)}
                />
              )}
              {state === 'done' && <DonePanel key="done" onReset={reset} />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function HomePanel({ onFill }: { onFill: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col"
    >
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border-muted px-3">
        <IconSparkle className="size-4 shrink-0 text-accent" />
        <h1 className="flex-1 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
          fillaform
        </h1>
        <span className="flex size-7 items-center justify-center rounded-full text-ink-dim">⚙</span>
      </header>

      <div className="flex flex-1 flex-col p-3">
        <Card className="p-4">
          <p className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
            boards.greenhouse.io
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">7 fields found</p>

          <div className="mt-4">
            <Button variant="primary" size="lg" block onClick={onFill}>
              <IconSparkle className="size-4" />
              Fill this form
            </Button>
          </div>
        </Card>

        <div className="mt-3 divide-y divide-border-muted">
          <div className="flex items-center gap-2.5 px-1 py-3 text-left text-[14px]">
            <IconSparkle className="size-4 text-ink-dim" />
            <span className="flex-1 truncate text-ink">What it knows</span>
            <span className="text-[12px] text-ink-dim">5 sources ready</span>
            <span className="text-ink-dim">→</span>
          </div>
          <div className="flex items-center gap-2.5 px-1 py-3 text-left text-[14px]">
            <span className="flex size-4 items-center justify-center text-ink-dim">♡</span>
            <span className="flex-1 truncate text-ink">Plan</span>
            <span className="text-[12px] text-ink-dim">Free · 13/50 this month</span>
            <span className="text-ink-dim">→</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function FillingPanel({ stage }: { stage: number }) {
  const active = STAGES[Math.min(stage, STAGES.length - 1)] ?? STAGES[0]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col"
    >
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border-muted px-3">
        <button className="flex size-7 items-center justify-center rounded-full text-ink-muted">
          ←
        </button>
        <h1 className="flex-1 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
          On it
        </h1>
      </header>

      <div className="flex flex-1 flex-col items-center px-5 py-6 text-center">
        <Mascot expression={active.mascot} size={64} className="animate-bounce" />

        <p className="mt-4 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
          {active.label}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">7 fields on this page</p>

        <div className="mt-5 w-full space-y-1.5">
          {STAGES.map(({ key, label }, i) => {
            const done = i < stage
            const isActive = i === stage
            return (
              <div
                key={key}
                className="flex items-center gap-2.5 rounded-full border border-border-muted bg-surface-raised px-3 py-2"
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  {done ? (
                    <IconCheck className="size-3.5 text-positive" />
                  ) : isActive ? (
                    <span className="animate-pulse-dot size-2 rounded-full bg-accent" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-border" />
                  )}
                </span>
                <span
                  className={cn(
                    'flex-1 text-left text-[13px]',
                    done ? 'text-ink-dim' : isActive ? 'font-semibold text-ink' : 'text-ink-dim',
                  )}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-ink-dim">
          Answers land on the page as they arrive. Nothing gets submitted — that stays yours.
        </p>
      </div>

      <div className="border-t border-border-muted px-3 py-3">
        <Button variant="ghost" block>
          Stop
        </Button>
      </div>
    </motion.div>
  )
}

function ReviewPanel({
  onDone,
  showSettled,
  onToggleSettled,
}: {
  onDone: () => void
  showSettled: boolean
  onToggleSettled: () => void
}) {
  const checkable = FORM_FIELDS.filter((f) => f.concluded || f.confidence < 0.7)
  const settled = FORM_FIELDS.filter((f) => !f.concluded && f.confidence >= 0.7)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col"
    >
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border-muted px-3">
        <button className="flex size-7 items-center justify-center rounded-full text-ink-muted">
          ←
        </button>
        <h1 className="flex-1 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
          {checkable.length} worth checking
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="px-3 py-2.5 text-[12px] font-medium text-ink-muted">7 written</p>

        {checkable.length > 0 && (
          <div className="mx-3 flex flex-col gap-px">
            <p className="mb-2 text-[12px] font-semibold uppercase text-ink-dim">
              check these — I guessed
            </p>
            {checkable.map((field) => (
              <Card
                key={field.id}
                className="!rounded-none first:rounded-t-2xl last:rounded-b-2xl border-b-0"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-semibold text-ink">
                      {field.label}
                    </p>
                    {field.concluded && <GuessedBadge />}
                    {!field.concluded && field.confidence < 0.7 && (
                      <GuessedBadge label={`unsure · ${Math.round(field.confidence * 100)}%`} />
                    )}
                  </div>

                  <div className="mt-2.5">
                    {field.kind === 'radio' || field.kind === 'select' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          field.options ?? [
                            'LinkedIn',
                            'A friend',
                            'Our careers page',
                            'A recruiter',
                            'Other',
                          ]
                        ).map((opt) => {
                          const selected = ANSWERS[field.id] === opt
                          return (
                            <span
                              key={opt}
                              className={cn(
                                'rounded-full border px-3 py-1.5 text-[12.5px] font-medium',
                                selected
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-border-muted text-ink-muted',
                              )}
                            >
                              {opt}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border-muted px-3 py-2 text-[13px] leading-[1.55] text-ink">
                        {ANSWERS[field.id]}
                      </div>
                    )}
                  </div>

                  {field.concluded && (
                    <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-dim">
                      <IconSparkle className="size-3 text-accent" />i
                      {field.confidence < 0.5
                        ? "'m not sure"
                        : field.confidence < 0.7
                          ? ' think so'
                          : "'m pretty sure"}{' '}
                      about this one
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary">
                      <IconCheck className="size-3.5" />
                      Keep
                    </Button>
                    <Button size="sm" variant="ghost">
                      Rewrite
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {settled.length > 0 && (
          <div className="mx-3 mt-3">
            <button
              type="button"
              onClick={onToggleSettled}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
            >
              <IconCheck className="size-4 shrink-0 text-positive" />
              <span className="flex-1 text-[13px] font-medium text-ink-muted">
                {settled.length} answers read straight off
              </span>
              <span className="text-[12px] font-semibold uppercase text-ink-dim">
                {showSettled ? 'hide' : 'show'}
              </span>
            </button>

            {showSettled && (
              <div className="mt-1 space-y-1">
                {settled.map((field) => (
                  <div key={field.id} className="rounded-xl border border-border-muted px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-ink-muted">{field.label}</p>
                      <ReadBadge />
                    </div>
                    <p className="mt-1 text-[13px] leading-snug text-ink">{ANSWERS[field.id]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border-muted px-3 py-4">
        <Button variant="primary" block size="lg" onClick={onDone}>
          <IconSparkle className="size-4" />
          Done
        </Button>
        <p className="mt-2 text-center text-[12px] text-ink-dim">
          Submitting the form is still yours to do.
        </p>
      </div>
    </motion.div>
  )
}

function DonePanel({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center"
    >
      <Mascot expression="party" size={72} className="animate-bounce" />
      <p className="mt-5 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
        All filled!
      </p>
      <p className="mt-2 max-w-[30ch] text-[13px] leading-relaxed text-ink-muted">
        Every field on the page has been filled. Nothing was auto-submitted — you stay in control.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="primary" size="md" onClick={onReset}>
          <IconSparkle className="size-4" />
          Try again
        </Button>
      </div>
    </motion.div>
  )
}
