import { createFileRoute } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Contact'
const description = 'Get in touch with the Fillaform team — support, feedback, and partnerships.'

export const Route = createFileRoute('/contact')({
  head: () => ({
    meta: buildMeta({ title: `${title} — ${site.name}`, description, path: '/contact' }),
    links: [canonicalLink('/contact')],
  }),
  component: ContactPage,
})

function ContactPage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-2xl px-6">
        <Reveal>
          <h1 className="text-center text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-[44ch] text-center text-[15px] leading-relaxed text-ink-muted">
            {description}
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="space-y-4">
            <a
              href={`mailto:${site.supportEmail}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-6 py-5 no-underline transition-colors duration-150 hover:bg-surface-muted"
            >
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                  Email
                </p>
                <p className="mt-1 text-[14px] text-ink">{site.supportEmail}</p>
              </div>
              <span className="text-ink-dim">→</span>
            </a>

            <a
              href={site.chromeWebStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-6 py-5 no-underline transition-colors duration-150 hover:bg-surface-muted"
            >
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                  Chrome Web Store
                </p>
                <p className="mt-1 text-[14px] text-ink">Fillaform on the Chrome Web Store</p>
              </div>
              <span className="text-ink-dim">→</span>
            </a>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
