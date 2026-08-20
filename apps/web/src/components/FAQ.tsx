import { Reveal } from '@/components/Reveal'

const FAQS = [
  {
    q: 'Is Fillaform really free?',
    a: 'Yes. The free plan fills 5 forms every month, with no card and no time limit. Upgrade to Pro or Ultra only if you need more.',
  },
  {
    q: 'Does it submit forms on its own?',
    a: 'No. Fillaform fills the fields and stops. You read the answers and press submit yourself.',
  },
  {
    q: 'What makes it different from browser autofill?',
    a: 'Browser autofill only repeats things you have typed before, like your name and address. Fillaform also answers written questions such as “why do you want to work here?”, using your CV and notes.',
  },
  {
    q: 'What does “guessed” mean?',
    a: 'Some answers come straight from details you gave it. Others it works out for itself, and those get a small tag reading “I guessed” or “not sure”. Click the tag to read, edit or rewrite the answer.',
  },
  {
    q: 'What happens to my data?',
    a: 'Your CV and notes are stored so Fillaform can look things up while filling. You can delete any of it, or all of it, from the extension settings. We do not sell your data or use it to train models.',
  },
  {
    q: 'Which sites does it work on?',
    a: 'Greenhouse, Lever, Ashby and Google Forms have purpose-built support. Everything else, including registrations, surveys and contact forms, is handled by a general fallback.',
  },
]

export function FAQ() {
  return (
    <section className="border-t border-border-muted py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
            FAQ
          </p>
          <h2 className="display mt-3 text-center text-[30px] text-ink md:text-[40px]">
            Common questions
          </h2>
        </Reveal>

        <div className="mt-14 space-y-3">
          {FAQS.map((faq, idx) => (
            <Reveal key={faq.q} delay={idx * 0.05}>
              <details className="group rounded-2xl border border-border-muted bg-surface-raised px-5 py-4 transition-colors duration-150 open:border-accent/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="text-ink-dim transition-transform duration-200 group-open:rotate-45">
                    ＋
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{faq.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
