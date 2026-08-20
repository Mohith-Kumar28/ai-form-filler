import { Reveal } from '@/components/Reveal'
import { Mascot, type MascotShape } from '@/components/ui'

const STEPS = [
  {
    n: '1',
    mascot: 'wow' as const,
    shape: 'circle' as MascotShape,
    title: 'Add your details once',
    description:
      'Upload your CV, paste a LinkedIn or GitHub link, or just type a few notes. Fillaform pulls out your name, contact details, work history and skills. You never map a field by hand.',
  },
  {
    n: '2',
    mascot: 'think' as const,
    shape: 'squircle' as MascotShape,
    title: 'Open any form',
    description:
      'Fillaform spots the fields and reads the questions — text boxes, dropdowns, radio buttons, checkboxes. A launcher appears on the right showing how many fields it found.',
  },
  {
    n: '3',
    mascot: 'party' as const,
    shape: 'blob' as MascotShape,
    title: 'Click fill, then check',
    description:
      'Every field gets an answer, written in your own words. Anything Fillaform had to guess is labelled so you can review it, edit it, or ask for a rewrite. You submit.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-border-muted bg-surface-muted py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
            How it works
          </p>
          <h2 className="display mt-3 text-center text-[32px] text-ink md:text-[42px]">
            Three steps, then never again
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, idx) => (
            <Reveal key={s.n} delay={idx * 0.12} className="h-full">
              <div className="flex h-full flex-col items-center rounded-2xl border border-border-muted bg-surface-raised p-7 text-center">
                {/* One unit: the mascot, with the step number pinned to its corner */}
                <div className="relative">
                  <Mascot
                    expression={s.mascot}
                    shape={s.shape}
                    size={48}
                    blink
                    className="hover-wobble"
                  />
                  <span
                    className="absolute -right-1.5 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-surface-raised font-display text-[12px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
                  >
                    {s.n}
                  </span>
                </div>
                <h3 className="display mt-5 text-[19px] text-ink">{s.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink-muted">{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
