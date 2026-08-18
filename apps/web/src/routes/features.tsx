import { createFileRoute } from '@tanstack/react-router'
import { FeaturesGrid } from '@/components/FeaturesGrid'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Features'
const description =
  'Fillaform fills any web form — job applications, Google Forms, event registrations and surveys — in your own writing voice, with read-vs-concluded stamps on every answer.'

export const Route = createFileRoute('/features')({
  head: () => ({
    meta: buildMeta({ title: `${title} — ${site.name}`, description, path: '/features' }),
    links: [canonicalLink('/features')],
  }),
  component: FeaturesPage,
})

function FeaturesPage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-center text-accent">
            Features
          </p>
          <h1 className="mt-4 text-center text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-[56ch] text-center text-[15px] leading-relaxed text-ink-muted">
            {description}
          </p>
        </Reveal>

        <div className="mt-16">
          <FeaturesGrid />
        </div>
      </div>
    </div>
  )
}
