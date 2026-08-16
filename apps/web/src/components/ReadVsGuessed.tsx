import { Reveal } from '@/components/Reveal'
import { GuessedBadge, ReadBadge, IconSparkle, IconCheck } from '@/components/ui'

export function ReadVsGuessed() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
                The trust layer
              </p>
              <h2 className="display mt-3 text-[32px] leading-tight text-ink md:text-[42px]">
                A wrong-but-confident answer is worse than a blank field
              </h2>
              <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-ink-muted">
                Other autofillers answer your name and email and stop. Fillaform answers the
                judgement calls — <em>“why do you want to work here?”</em> — and tells you
                exactly what it <span className="font-semibold text-positive">read</span> from your
                profile and what it <span className="font-semibold text-accent">guessed</span>.
              </p>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-muted">
                You review the guesses before anything is submitted. No surprises, ever.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-muted bg-surface-raised p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-ink-muted">Full name</p>
                  <ReadBadge />
                </div>
                <p className="mt-2 text-[15px] text-ink">Ifeoma Balogun</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border-muted pt-3 text-[12px] text-positive">
                  <IconCheck className="size-3.5" />
                  read straight off what you told it
                </div>
              </div>

              <div className="rounded-2xl border border-accent/30 bg-accent-muted/40 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-ink-muted">Why do you want to work here?</p>
                  <GuessedBadge />
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">
                  I spent four years rebuilding a claims pipeline nobody wanted to touch — the part
                  I liked was the archaeology of working out why a system ended up the way it had.
                </p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border-muted pt-3 text-[12px] text-accent">
                  <IconSparkle className="size-3.5" />
                  a judgement call it made for you — check me
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}