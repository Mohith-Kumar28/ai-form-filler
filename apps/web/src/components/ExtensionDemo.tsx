import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  type Expression,
  GuessedBadge,
  IconCheck,
  IconSparkle,
  ReadBadge,
} from '@/components/ui'
import { cn } from '@/lib/cn'

/* ── Demo data (matches the extension's gallery fixtures) ────────────────── */

const FORM_FIELDS = [
  { id: 'f_name', label: 'Full name', kind: 'text', concluded: false, confidence: 0.99 },
  { id: 'f_email', label: 'Email address', kind: 'email', concluded: false, confidence: 0.99 },
  {
    id: 'f_auth',
    label: 'Do you require visa sponsorship?',
    kind: 'radio',
    concluded: false,
    confidence: 0.91,
    options: ['Yes', 'No'],
  },
  {
    id: 'f_hear',
    label: 'How did you hear about this role?',
    kind: 'select',
    concluded: false,
    confidence: 0.63,
    options: ['LinkedIn', 'A friend', 'Our careers page', 'A recruiter', 'Other'],
  },
  {
    id: 'f_notice',
    label: 'When could you start?',
    kind: 'text',
    concluded: false,
    confidence: 0.94,
  },
  {
    id: 'f_why',
    label: 'Why do you want to work at Alderman & Roe?',
    kind: 'longtext',
    concluded: true,
    confidence: 0.58,
  },
  {
    id: 'f_salary',
    label: 'What are your salary expectations?',
    kind: 'text',
    concluded: true,
    confidence: 0.41,
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

type DemoState = 'idle' | 'filling' | 'review' | 'done'
type MarkState = 'idle' | 'active' | 'filled' | 'aiWrote'

export function ExtensionDemo() {
  const [state, setState] = useState<DemoState>('idle')
  const [marks, setMarks] = useState<Record<string, MarkState>>({})
  const [filledFields, setFilledFields] = useState<Set<string>>(new Set())
  const [showReview, setShowReview] = useState(false)
  const [launcherMode, setLauncherMode] = useState<'idle' | 'busy' | 'result'>('idle')
  const [launcherText, setLauncherText] = useState('Fill form')
  const formRef = useRef<HTMLDivElement>(null)

  const startFill = useCallback(() => {
    setState('filling')
    setLauncherMode('busy')

    let step = 0
    const advance = () => {
      if (step < STAGES.length) {
        setLauncherText(`${step}/${STAGES.length}`)
        step++
        setTimeout(advance, step === 2 ? 1400 : 1200)
      } else {
        let fi = 0
        const fillNext = () => {
          const field = FORM_FIELDS[fi]
          if (field) {
            setMarks((prev) => ({ ...prev, [field.id]: 'active' }))
            setTimeout(() => {
              setFilledFields((prev) => new Set([...prev, field.id]))
              setMarks((prev) => ({
                ...prev,
                [field.id]: field.concluded ? 'aiWrote' : 'filled',
              }))
              fi++
              setTimeout(fillNext, 200)
            }, 400)
          } else {
            setTimeout(() => {
              setState('review')
              setLauncherMode('result')
              const concluded = FORM_FIELDS.filter((f) => f.concluded).length
              setLauncherText(`${FORM_FIELDS.length - concluded} filled · ${concluded} need a look`)
            }, 600)
          }
        }
        fillNext()
      }
    }
    setTimeout(advance, 300)
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setFilledFields(new Set())
    setMarks({})
    setShowReview(false)
    setLauncherMode('idle')
    setLauncherText('Fill form')
  }, [])

  // Clear 'filled' marks after a delay (they flash green then disappear)
  useEffect(() => {
    const filled = Object.entries(marks).filter(([_, v]) => v === 'filled')
    if (filled.length === 0) return
    const timeout = setTimeout(() => {
      setMarks((prev) => {
        const next = { ...prev }
        filled.forEach(([id]) => {
          delete next[id]
        })
        return next
      })
    }, 1500)
    return () => clearTimeout(timeout)
  }, [marks])

  return (
    <div className="relative w-full">
      {/* The form — looks like a real job application page */}
      <div ref={formRef} className="rounded-2xl border border-border-muted bg-surface p-6 md:p-8">
        <div className="mb-6 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
            Job application
          </p>
          <h3 className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink">
            Engineering Manager
          </h3>
          <p className="text-[13px] text-ink-muted">Alderman & Roe · Bristol, UK · Remote</p>
        </div>

        <div className="space-y-4">
          {FORM_FIELDS.map((field) => {
            const mark = marks[field.id]
            const isFilled = filledFields.has(field.id)
            const value =
              isFilled || state === 'review' || state === 'done' ? ANSWERS[field.id] : ''

            return (
              <div key={field.id} className="relative space-y-1.5">
                <span className="text-[12px] font-semibold text-ink-muted">
                  {field.label}
                  {field.kind === 'longtext' && (
                    <span className="ml-1.5 text-[11px] font-normal text-ink-dim">required</span>
                  )}
                </span>

                {field.kind === 'longtext' ? (
                  <div
                    className={cn(
                      'min-h-[80px] rounded-xl border px-3 py-2 text-[13px] leading-relaxed transition-all duration-300',
                      mark === 'active' && 'border-accent ring-2 ring-accent/20',
                      mark === 'aiWrote' && 'border-accent/40 bg-accent-muted/20',
                      mark === 'filled' && 'border-positive bg-positive-muted/20',
                      !mark && 'border-border bg-surface-raised',
                    )}
                  >
                    {value}
                  </div>
                ) : field.kind === 'radio' ? (
                  <div className="flex gap-4 pt-1">
                    {field.options?.map((opt) => {
                      const selected = value === opt
                      return (
                        <span
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
                        </span>
                      )
                    })}
                  </div>
                ) : field.kind === 'select' ? (
                  <div
                    className={cn(
                      'rounded-xl border px-3 py-2 text-[13px] transition-all duration-300',
                      mark === 'active' && 'border-accent ring-2 ring-accent/20',
                      mark === 'aiWrote' && 'border-accent/40 bg-accent-muted/20',
                      mark === 'filled' && 'border-positive bg-positive-muted/20',
                      !mark && 'border-border bg-surface-raised',
                      !value && 'text-ink-dim',
                    )}
                  >
                    {value || 'Select…'}
                  </div>
                ) : (
                  <input
                    readOnly
                    value={value}
                    placeholder=" "
                    className={cn(
                      'w-full rounded-xl border px-3 py-2 text-[13px] text-ink transition-all duration-300 outline-none',
                      mark === 'active' && 'border-accent ring-2 ring-accent/20',
                      mark === 'aiWrote' && 'border-accent/40 bg-accent-muted/20',
                      mark === 'filled' && 'border-positive bg-positive-muted/20',
                      !mark && 'border-border bg-surface-raised',
                    )}
                  />
                )}

                {/* Field mark pill — appears on AI-written fields */}
                {mark === 'aiWrote' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                    className="absolute -top-2 right-2"
                  >
                    <button
                      type="button"
                      onClick={() => setState('review')}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent-muted/80"
                    >
                      <IconSparkle className="size-2.5" />
                      needs a look
                    </button>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Launcher pill — sticky on the right edge */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="absolute right-4 top-1/2 -translate-y-1/2"
      >
        <button
          type="button"
          onClick={
            state === 'idle'
              ? startFill
              : state === 'review'
                ? () => setShowReview(true)
                : state === 'done'
                  ? reset
                  : undefined
          }
          disabled={state === 'filling'}
          className={cn(
            'flex items-center gap-2 rounded-full border border-border-muted bg-surface-raised px-4 py-2.5 text-[13px] font-semibold shadow-card transition-all duration-200',
            launcherMode === 'idle' && 'hover:bg-surface-muted',
            launcherMode === 'busy' && 'cursor-wait opacity-80',
            launcherMode === 'result' && 'border-accent/30 bg-accent-muted/30 text-accent',
          )}
        >
          {launcherMode === 'busy' ? (
            <>
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </span>
              <span className="text-ink-muted">{launcherText}</span>
            </>
          ) : launcherMode === 'result' ? (
            <>
              <IconSparkle className="size-3.5" />
              <span>{launcherText}</span>
            </>
          ) : (
            <>
              <IconSparkle className="size-3.5 text-accent" />
              <span>{launcherText}</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Side panel — slides in from the right when review is shown */}
      <AnimatePresence>
        {showReview && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 top-0 h-full w-[320px] overflow-y-auto rounded-2xl border border-border-muted bg-surface-raised p-4 shadow-card md:w-[380px]"
          >
            <ReviewPanel
              onDone={() => {
                setShowReview(false)
                setState('done')
              }}
              showSettled={showReview}
              onToggleSettled={() => setShowReview((v) => !v)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 border-b border-border-muted pb-3">
        <button
          type="button"
          onClick={onToggleSettled}
          className="flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
        >
          ←
        </button>
        <h3 className="flex-1 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
          {checkable.length} worth checking
        </h3>
      </div>

      <p className="mb-3 text-[12px] font-medium text-ink-muted">{FORM_FIELDS.length} written</p>

      {checkable.length > 0 && (
        <div className="flex flex-col gap-px">
          <p className="mb-2 text-[11px] font-semibold uppercase text-ink-dim">
            check these — I guessed
          </p>
          {checkable.map((field) => (
            <Card
              key={field.id}
              className="!rounded-none first:rounded-t-2xl last:rounded-b-2xl border-b-0"
            >
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-[12px] font-semibold text-ink">{field.label}</p>
                  {field.concluded && <GuessedBadge />}
                  {!field.concluded && field.confidence < 0.7 && (
                    <GuessedBadge label={`unsure · ${Math.round(field.confidence * 100)}%`} />
                  )}
                </div>

                <div className="mt-2">
                  {field.kind === 'radio' || field.kind === 'select' ? (
                    <div className="flex flex-wrap gap-1">
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
                              'rounded-full border px-2 py-1 text-[11px] font-medium',
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
                    <div className="rounded-lg border border-border-muted px-2 py-1.5 text-[12px] leading-relaxed text-ink">
                      {ANSWERS[field.id]}
                    </div>
                  )}
                </div>

                {field.concluded && (
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-dim">
                    <IconSparkle className="size-2.5 text-accent" />i
                    {field.confidence < 0.5
                      ? "'m not sure"
                      : field.confidence < 0.7
                        ? ' think so'
                        : "'m pretty sure"}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary">
                    <IconCheck className="size-3" />
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
        <div className="mt-3">
          <button
            type="button"
            onClick={onToggleSettled}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-muted"
          >
            <IconCheck className="size-3.5 shrink-0 text-positive" />
            <span className="flex-1 text-[12px] font-medium text-ink-muted">
              {settled.length} answers read straight off
            </span>
            <span className="text-[10px] font-semibold uppercase text-ink-dim">
              {showSettled ? 'hide' : 'show'}
            </span>
          </button>

          {showSettled && (
            <div className="mt-1 space-y-1">
              {settled.map((field) => (
                <div key={field.id} className="rounded-lg border border-border-muted px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-ink-muted">{field.label}</p>
                    <ReadBadge />
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-ink">{ANSWERS[field.id]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-border-muted pt-3">
        <Button variant="primary" block size="md" onClick={onDone}>
          <IconSparkle className="size-3.5" />
          Done
        </Button>
        <p className="mt-2 text-center text-[10px] text-ink-dim">
          Submitting the form is still yours to do.
        </p>
      </div>
    </div>
  )
}
