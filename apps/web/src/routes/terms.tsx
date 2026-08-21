import { createFileRoute } from '@tanstack/react-router'
import { Reveal } from '@/components/Reveal'
import { buildMeta, canonicalLink } from '@/lib/seo'
import { site } from '@/lib/site'

const title = 'Terms of Service'
const description = 'The terms that govern your use of the Fillaform Chrome extension.'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: buildMeta({ title: `${title} | ${site.name}`, description, path: '/terms' }),
    links: [canonicalLink('/terms')],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
          <p className="mt-4 text-[13px] text-ink-dim">Last updated: August 2026</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="space-y-8 text-[14px] leading-relaxed text-ink-muted">
            <p>By installing and using the Fillaform Chrome extension, you agree to these terms.</p>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Use of the service</h2>
              <p>
                Fillaform fills web forms with answers derived from material you provide. You are
                responsible for reviewing all answers before submitting any form. You agree not to
                use Fillaform to impersonate another person or to submit fraudulent applications.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Plans and billing</h2>
              <p>
                New accounts may start a 14-day free trial of the Pro plan. A payment method is
                required to begin the trial; nothing is charged during it, and the first payment is
                taken when it ends unless you cancel first. Only one trial is available per person.
                Plans are metered per calendar month in form fields answered &mdash; one field
                filled by the AI, one rewrite, or one source added or reprocessed &mdash; and each
                plan also carries a separate monthly limit on long written answers. Fields answered
                from information you have already saved do not count. Billing is monthly through
                Dodo Payments. You can cancel at any time; access continues until the end of the
                current billing period.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Fair use</h2>
              <p>
                We may limit or suspend accounts that abuse the service, including excessive
                automated use or attempts to circumvent quotas.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Disclaimer</h2>
              <p>
                The service is provided &ldquo;as is&rdquo;. Fillaform does not guarantee that any
                answer will be accepted by a form, employer, or third party. You use it at your own
                risk.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">Contact</h2>
              <p>
                Questions about these terms? Email{' '}
                <a
                  href={`mailto:${site.supportEmail}`}
                  className="text-accent no-underline hover:underline"
                >
                  {site.supportEmail}
                </a>
                .
              </p>
            </section>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
