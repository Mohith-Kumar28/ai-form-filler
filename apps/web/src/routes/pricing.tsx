import { createFileRoute } from '@tanstack/react-router'
import { PricingCards } from '@/components/PricingCards'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Pricing'
const description =
  'Fillaform pricing: Pro $5/month for 600 form fields, Ultra $15/month for 2,500. Start with a 14-day free trial. Cancel any time.'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: buildMeta({ title: `${title} | ${site.name}`, description, path: '/pricing' }),
    links: [canonicalLink('/pricing')],
  }),
  component: PricingPage,
})

function PricingPage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-center text-accent">
            Pricing
          </p>
          <h1 className="mt-4 text-center text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-5 max-w-[48ch] text-center text-[15px] leading-relaxed text-ink-muted">
            Try Pro free for 14 days. Then $5 a month, or $15 if you fill forms all day. Cancel any
            time.
          </p>
        </Reveal>

        <div className="mt-16">
          <PricingCards />
        </div>

        <Reveal delay={0.2} className="mt-20">
          <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-surface-raised p-7">
            <h3 className="text-[15px] font-semibold text-ink">Frequently asked</h3>
            <div className="space-y-3 text-[13px] leading-relaxed text-ink-muted">
              <p>
                <strong className="text-ink">What counts towards the monthly limit?</strong> One
                field the AI wrote an answer for, one rewrite, or one source added or reprocessed.
                Fields it already knows from your saved information &mdash; your name, your email,
                your phone number &mdash; are answered without asking a model, so they cost nothing
                and are not counted. On a real job application that is usually about a third of the
                page.
              </p>
              <p>
                <strong className="text-ink">Why are long answers counted separately?</strong> A
                paragraph written from scratch costs us roughly a hundred times what a dropdown
                does, so each plan has its own ceiling for essays and rewrites. It is set high
                enough that ordinary use never reaches it &mdash; on the applications we have
                measured, essays are under a tenth of the fields.
              </p>
              <p>
                <strong className="text-ink">How does the free trial work?</strong> Fourteen days of
                Pro, in full. You add a card when you start it, nothing is charged until day 15, and
                cancelling before then costs nothing.
              </p>
              <p>
                <strong className="text-ink">Can I switch plans?</strong> Yes. Upgrade or downgrade
                any time. Your allowance resets at the start of each calendar month.
              </p>
              <p>
                <strong className="text-ink">Do you store my data?</strong> Your sources (resume,
                links, notes) are stored so Fillaform can search them at fill time. You can delete
                everything from the extension settings.
              </p>
              <p>
                <strong className="text-ink">What payment methods do you accept?</strong> All major
                cards and UPI through our payment partner, Dodo Payments.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
