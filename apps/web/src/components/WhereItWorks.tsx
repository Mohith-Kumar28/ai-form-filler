import { Reveal } from '@/components/Reveal'
import { MascotPattern } from '@/components/ui'

const SITES = [
  'Greenhouse',
  'Lever',
  'Ashby',
  'Google Forms',
  'Workable',
  'SmartRecruiters',
  'Typeform',
  'SurveyMonkey',
  'Eventbrite',
  'Jotform',
  'Every other form',
]

export function WhereItWorks() {
  return (
    <section className="relative overflow-hidden border-t border-border-muted bg-surface-muted py-20 md:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <MascotPattern className="h-full w-full text-ink" cell={64} opacity={0.045} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
            Coverage
          </p>
          <h2 className="display mt-3 text-center text-[28px] text-ink md:text-[36px]">
            Works wherever forms live
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-center text-[14.5px] leading-relaxed text-ink-muted">
            Dedicated adapters for the big ATSes and Google Forms, a generic fallback for everything
            else. If there&rsquo;s a field, it gets filled.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-11 flex flex-wrap items-center justify-center gap-2.5">
            {SITES.map((site) => (
              <span
                key={site}
                className="rounded-full border border-border-muted bg-surface-raised px-4 py-2 text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:border-accent/30 hover:text-ink"
              >
                {site}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
