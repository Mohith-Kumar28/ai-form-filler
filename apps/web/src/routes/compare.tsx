import { createFileRoute } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Fillaform vs. the rest'
const description =
  'How Fillaform compares to Simplify Copilot, JobWizard, JobFill and LazyApply. Fillaform fills any form, not just job applications, and tells you which answers it had to guess.'

interface ComparisonRow {
  label: string
  /**
   * `true` renders the check and the word "Yes"; a string states the specific answer instead.
   *
   * Every row used to be a plain `true`, and the cell hardcoded "Yes" regardless — so a row whose
   * honest answer is a *quantity* rather than a yes had nowhere to put it. A table of six identical
   * ticks also persuades nobody; the rows that say something concrete are the ones that do work.
   */
  fillaform: boolean | string
  others: string
}

const ROWS: ComparisonRow[] = [
  {
    label: 'Fills any form, not just job applications',
    fillaform: true,
    others: 'Job applications only',
  },
  {
    label: 'Answers open-ended questions ("Why us?")',
    fillaform: true,
    others: 'Limited or generic templates',
  },
  { label: 'Writes answers in your own words', fillaform: true, others: 'Fixed profile fields' },
  { label: 'Labels the answers it guessed', fillaform: true, others: 'No indication' },
  { label: 'Works on Google Forms & surveys', fillaform: true, others: 'ATS-only adapters' },
  {
    label: 'Rewrites an answer in your voice, in place',
    fillaform: true,
    others: 'Regenerate from scratch, or nothing',
  },
  {
    label: 'Learns from the answers you settle on',
    fillaform: true,
    others: 'Static profile; never improves',
  },
  { label: 'Full trial before you pay', fillaform: '14 days of Pro', others: 'Varies' },
]

export const Route = createFileRoute('/compare')({
  head: () => ({
    meta: buildMeta({ title: `${title} | ${site.name}`, description, path: '/compare' }),
    links: [canonicalLink('/compare')],
  }),
  component: ComparePage,
})

function ComparePage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-center text-accent">
            Compare
          </p>
          <h1 className="mt-4 text-center text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-[56ch] text-center text-[15px] leading-relaxed text-ink-muted">
            {description}
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-16">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-6 py-4 text-[13px] font-medium text-ink-dim">Capability</th>
                  <th className="px-6 py-4 text-[13px] font-semibold text-ink">Fillaform</th>
                  <th className="px-6 py-4 text-[13px] font-medium text-ink-dim">
                    Other extensions
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, idx) => (
                  <tr
                    key={row.label}
                    className={idx !== ROWS.length - 1 ? 'border-b border-border-muted' : ''}
                  >
                    <td className="px-6 py-4 text-[13px] text-ink">{row.label}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent">
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="miter"
                          aria-hidden="true"
                        >
                          <path d="M3 8.5 L6.5 12 L13 4.5" />
                        </svg>
                        {typeof row.fillaform === 'string' ? row.fillaform : 'Yes'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-ink-dim">{row.others}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={0.2} className="mt-12">
          <p className="text-center text-[13px] text-ink-dim">
            Compare the full feature set and see Fillaform in action on the{' '}
            <a href="/" className="text-accent no-underline hover:underline">
              homepage
            </a>
            .
          </p>
        </Reveal>
      </div>
    </div>
  )
}
