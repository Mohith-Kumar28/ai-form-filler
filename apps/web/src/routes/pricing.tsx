import { createFileRoute } from '@tanstack/react-router'
import { PricingCards } from '@/components/PricingCards'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Pricing'
const description =
  'Fillaform pricing: Free (5 forms/month), Pro (50 forms/month, $12), Ultra (300 forms/month, $30). Start free, upgrade when you need more.'

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
            Start with 5 free forms a month. Upgrade to Pro or Ultra when you need more. Cancel
            anytime.
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
                <strong className="text-ink">Can I switch plans?</strong> Yes. Upgrade or downgrade
                any time. Your form count resets at the start of each billing month.
              </p>
              <p>
                <strong className="text-ink">What counts as a form?</strong> Each time you click
                &ldquo;Fill&rdquo; and Fillaform processes a page, that is one form fill, regardless
                of how many fields.
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
