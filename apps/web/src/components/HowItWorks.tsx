import { Reveal } from '@/components/Reveal'
import { Mascot } from '@/components/ui'

const STEPS = [
  {
    n: '1',
    mascot: 'happy' as const,
    title: 'Feed it',
    description:
      'Drop in your résumé, paste a LinkedIn or GitHub link, type a few notes. Fillaform extracts your name, history, skills and preferences — no hand-mapping required.',
  },
  {
    n: '2',
    mascot: 'think' as const,
    title: 'It gets to know you',
    description:
      'Your material becomes a searchable memory. When a form asks an open-ended question, Fillaform retrieves the right facts and writes the answer in your voice.',
  },
  {
    n: '3',
    mascot: 'party' as const,
    title: 'Fill anything',
    description:
      'Open any form, click fill. Every field — text, dropdown, radio, checkbox — gets filled. Hot pink marks what it guessed; lime marks what it read straight off.',
  },
]

export function HowItWorks() {
  return (
    <section className="border-t border-border-muted bg-surface-muted py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
            How it works
          </p>
          <h2 className="display mt-3 text-center text-[32px] text-ink md:text-[42px]">
            Three steps. Zero retyping.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, idx) => (
            <Reveal key={s.n} delay={idx * 0.12}>
              <div className="flex h-full flex-col rounded-2xl border border-border-muted bg-surface-raised p-6 text-center">
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="flex size-9 items-center justify-center rounded-full font-display text-[15px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
                  >
                    {s.n}
                  </span>
                  <Mascot expression={s.mascot} size={40} />
                </div>
                <h3 className="display mt-5 text-[19px] text-ink">{s.title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}