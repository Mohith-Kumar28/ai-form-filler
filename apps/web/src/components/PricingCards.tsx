import { Reveal } from '@/components/Reveal'
import { IconCheck, IconSparkle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { pricing } from '@/lib/site'

export function PricingCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {pricing.map((plan, idx) => (
        <Reveal key={plan.plan} delay={idx * 0.1} className="h-full">
          <div
            className={cn(
              'relative flex h-full flex-col rounded-3xl border p-7',
              plan.highlighted
                ? 'border-transparent text-white shadow-card'
                : 'border-border-muted bg-surface-raised',
            )}
            style={
              plan.highlighted
                ? {
                    background:
                      'linear-gradient(160deg, var(--sparkle), var(--accent) 68%, var(--sun) 150%)',
                  }
                : undefined
            }
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent shadow-glow">
                Most popular
              </span>
            )}

            <h3 className={cn('display text-[20px]', plan.highlighted ? 'text-white' : 'text-ink')}>
              {plan.name}
            </h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span
                className={cn(
                  'display text-[44px] leading-none',
                  plan.highlighted ? 'text-white' : 'text-ink',
                )}
              >
                ${plan.price}
              </span>
              <span
                className={cn('text-[13px]', plan.highlighted ? 'text-white/80' : 'text-ink-dim')}
              >
                / {plan.cadence}
              </span>
            </div>
            <p
              className={cn(
                'mt-2 text-[13px] font-medium',
                plan.highlighted ? 'text-white/90' : 'text-ink-dim',
              )}
            >
              {plan.forms} forms / month
            </p>
            <p
              className={cn(
                'mt-3 text-[13.5px] leading-relaxed',
                plan.highlighted ? 'text-white/90' : 'text-ink-muted',
              )}
            >
              {plan.description}
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13.5px]">
                  <span
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                      plan.highlighted
                        ? 'bg-white/25 text-white'
                        : 'bg-positive-muted text-positive',
                    )}
                  >
                    <IconCheck className="size-3" />
                  </span>
                  <span className={plan.highlighted ? 'text-white' : 'text-ink-muted'}>{f}</span>
                </li>
              ))}
            </ul>

            <a
              href={plan.plan === 'free' ? '#demo' : '/pricing'}
              className={cn(
                'mt-7 flex min-h-11 items-center justify-center rounded-full px-4 text-center text-[14px] font-semibold no-underline transition-all duration-150',
                plan.highlighted
                  ? 'bg-white text-accent hover:brightness-95'
                  : 'text-white shadow-glow hover:brightness-110',
              )}
              style={
                plan.highlighted
                  ? undefined
                  : { background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }
              }
            >
              {plan.plan === 'free' ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconSparkle className="size-4" />
                  {plan.cta}
                </span>
              ) : (
                plan.cta
              )}
            </a>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
