import { createFileRoute } from '@tanstack/react-router'
import { Hero } from '@/components/Hero'
import { ExtensionDemo } from '@/components/ExtensionDemo'
import { HowItWorks } from '@/components/HowItWorks'
import { FeaturesGrid } from '@/components/FeaturesGrid'
import { ReadVsGuessed } from '@/components/ReadVsGuessed'
import { WhereItWorks } from '@/components/WhereItWorks'
import { PricingCards } from '@/components/PricingCards'
import { FAQ } from '@/components/FAQ'
import { ChromeCTA } from '@/components/ChromeCTA'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink, jsonLd } from '@/lib/seo'
import { site } from '@/lib/site'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      ...buildMeta({
        title: `${site.name} — Fill any form, in your own voice`,
        description: site.description,
        path: '/',
      }),
    ],
    links: [canonicalLink('/')],
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: site.domain,
        description: site.description,
      }),
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <>
      <Hero />

      {/* Demo section — peaks up into the hero so ~25% of the card is visible on load */}
      <section id="demo" className="relative -mt-32 pb-20 md:-mt-56 md:pb-28">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
            Click the launcher to watch it fill
          </p>
          <ExtensionDemo />
        </div>
      </section>

      <section id="how-it-works">
        <HowItWorks />
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
              Features
            </p>
            <h2 className="display mt-3 text-center text-[30px] text-ink md:text-[42px]">
              Everything it fills
            </h2>
          </Reveal>
          <div className="mt-14">
            <FeaturesGrid />
          </div>
        </div>
      </section>

      <ReadVsGuessed />
      <WhereItWorks />

      <section className="border-t border-border-muted bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-accent">
              Pricing
            </p>
            <h2 className="display mt-3 text-center text-[30px] text-ink md:text-[42px]">
              Pick your pace
            </h2>
          </Reveal>
          <div className="mt-16">
            <PricingCards />
          </div>
        </div>
      </section>

      <FAQ />
      <ChromeCTA />
    </>
  )
}