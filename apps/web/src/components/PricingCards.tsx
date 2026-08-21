import { Reveal } from '@/components/Reveal'
import { IconCheck, IconMascot } from '@/components/ui'
import { cn } from '@/lib/cn'
import { pricing, site } from '@/lib/site'

export function PricingCards() {
  return (
    <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
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
              {plan.actions.toLocaleString('en-US')} form fields / month
            </p>
            {plan.trialDays > 0 && (
              <p
                className={cn(
                  'mt-1 text-[12.5px]',
                  plan.highlighted ? 'text-white/80' : 'text-ink-dim',
                )}
              >
                Free for the first {plan.trialDays} days
              </p>
            )}
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

            {/*
              Both cards point at the Web Store, because that is where checkout actually starts:
              the trial is taken inside the extension, against a signed-in account. Sending someone
              to a payment page before they have installed anything sells them a subscription to
              something they cannot yet run.
            */}
            <a
              href={site.chromeWebStoreUrl}
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
              <span className="inline-flex items-center gap-1.5">
                <IconMascot className="size-4" />
                {plan.cta}
              </span>
            </a>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
