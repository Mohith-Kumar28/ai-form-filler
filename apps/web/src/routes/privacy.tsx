import { createFileRoute } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Privacy Policy'
const description =
  'How Fillaform handles your data — what we collect, how it is used, and how you can delete it.'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: buildMeta({ title: `${title} — ${site.name}`, description, path: '/privacy' }),
    links: [canonicalLink('/privacy')],
  }),
  component: PrivacyPage,
})

const SECTION_CLASS = 'space-y-3 text-[14px] leading-relaxed text-ink-muted'

function PrivacyPage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-[13px] text-ink-dim">
            Last updated: August 2026 · Effective immediately
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="space-y-12">
            <Section title="What Fillaform is">
              <p>
                Fillaform is a Chrome extension that fills web forms from your own knowledge base.
                It ingests material you choose to provide — a resume, links, pasted notes — and uses
                it to answer fields on web forms you visit, in your own writing voice.
              </p>
            </Section>

            <Section title="What we collect">
              <p>
                <strong className="text-ink">Your Google account</strong> — name and email,
                used to identify you and manage your plan. We do not access your Google Drive,
                contacts, or any other Google data.
              </p>
              <p>
                <strong className="text-ink">Your profile</strong> — identity fields you
                enter (name, email, phone, links) and custom facts.
              </p>
              <p>
                <strong className="text-ink">Your sources</strong> — the documents, links,
                text, and images you upload. These are stored so Fillaform can search them at fill
                time.
              </p>
              <p>
                <strong className="text-ink">Fill logs</strong> — which forms you filled and
                basic usage counts, used for quota enforcement and cost accounting.
              </p>
            </Section>

            <Section title="How your data is used">
              <p>
                Your data is used for exactly one purpose: to fill forms for you. When you click
                &ldquo;Fill&rdquo;, the form&rsquo;s structure and relevant parts of your profile
                are sent to a language model to generate answers. We never sell your data, and we
                never use it to train models.
              </p>
            </Section>

            <Section title="What we do not do">
              <p>
                We do not auto-submit forms. Every answer is shown for your review first. We do not
                sell or rent your information. We do not scan pages until you trigger a fill.
              </p>
            </Section>

            <Section title="Data retention & deletion">
              <p>
                You can delete any source or your entire profile at any time from the extension
                settings. Deleting your account removes your profile, sources, and fill logs from
                our servers.
              </p>
            </Section>

            <Section title="Payments">
              <p>
                Payments are processed by Dodo Payments. We do not store your card details. Dodo
                Payments&rsquo; own privacy policy applies to payment information.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about this policy? Email{' '}
                <a
                  href={`mailto:${site.supportEmail}`}
                  className="text-accent no-underline hover:underline"
                >
                  {site.supportEmail}
                </a>
                .
              </p>
            </Section>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

function Section({ title: sTitle, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">{sTitle}</h2>
      <div className={`mt-3 ${SECTION_CLASS}`}>{children}</div>
    </section>
  )
}
