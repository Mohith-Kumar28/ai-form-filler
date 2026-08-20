import { Reveal } from '@/components/Reveal'

const FAQS = [
  {
    q: 'Is Fillaform really free?',
    a: 'Yes — the Free plan gives you 5 form fills every month, forever. No credit card. Upgrade to Pro or Ultra when you need more.',
  },
  {
    q: 'Does it submit forms on its own?',
    a: 'Never. Fillaform fills the fields, then shows you every answer for review. Submitting is always yours to do.',
  },
  {
    q: 'What makes it different from browser autofill?',
    a: 'Browser autofill remembers your name and address. Fillaform answers open-ended questions — “why do you want to work here?” — from your own material, in your own voice.',
  },
  {
    q: 'What does “guessed” mean?',
    a: 'A hot-pink badge means Fillaform made a judgement call rather than reading the answer straight off your profile. Review those before submitting.',
  },
  {
    q: 'What happens to my data?',
    a: 'Your sources are stored so Fillaform can search them at fill time. You can delete anything, or everything, from the extension settings. We never sell it or use it to train models.',
  },
  {
    q: 'Which sites does it work on?',
    a: 'Greenhouse, Lever, Ashby, Google Forms, and a generic adapter for anything else with form fields — event registrations, surveys, contact forms.',
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
            Fair questions, honest answers
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
