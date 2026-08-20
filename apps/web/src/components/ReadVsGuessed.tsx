import { Reveal } from '@/components/Reveal'
import { GuessedBadge, IconCheck, IconSparkle, ReadBadge } from '@/components/ui'

export function ReadVsGuessed() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
                Why you can trust it
              </p>
              <h2 className="display mt-3 text-[32px] leading-tight text-ink md:text-[42px]">
                A wrong answer you didn&rsquo;t notice is worse than a blank field
              </h2>
              <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-ink-muted">
                Most autofill tools stop at your name and email. Fillaform also answers the written
                questions — and every answer comes labelled with where it came from.
              </p>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-muted">
                Answers taken straight from your details are left alone. Anything it worked out for
                itself gets a small tag you can click to read, edit, or rewrite. Then you submit —
                Fillaform never does.
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
                  taken straight from your details
                </div>
              </div>

              <div className="rounded-2xl border border-accent/30 bg-accent-muted/40 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-ink-muted">
                    Why do you want to work here?
                  </p>
                  <GuessedBadge />
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink">
                  I spent four years rebuilding a claims pipeline nobody wanted to touch — the part
                  I liked was the archaeology of working out why a system ended up the way it had.
                </p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border-muted pt-3 text-[12px] text-accent">
                  <IconSparkle className="size-3.5" />
                  Fillaform worked this one out &mdash; worth a read
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
