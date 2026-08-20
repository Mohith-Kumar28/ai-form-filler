import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/Logo'
import { IconSparkle } from '@/components/ui'
import { site } from '@/lib/site'

/* Two short columns — eight links in one stack left the footer badly lopsided. */
const footerColumns = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Compare', to: '/compare' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', to: '/contact' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border-muted bg-surface-muted">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-[36ch] text-[13px] leading-relaxed text-ink-muted">
              A Chrome extension that fills any web form with your own answers, and tells you which
              ones it had to guess.
            </p>
            <a
              href={site.chromeWebStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white no-underline shadow-glow transition-[filter] duration-150 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
            >
              <IconSparkle className="size-3.5" />
              Add to Chrome
            </a>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading} className="flex flex-col gap-2.5 md:pt-1">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                {column.heading}
              </p>
              {column.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="w-fit text-[13px] text-ink-muted no-underline transition-colors duration-150 hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}

          <div className="flex flex-col gap-3 md:pt-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
              Stay in touch
            </p>
            <a
              href={`mailto:${site.supportEmail}`}
              className="text-[13px] text-ink-muted no-underline hover:text-ink"
            >
              {site.supportEmail}
            </a>
            <p className="text-[13px] text-ink-dim">
              Questions, bugs, or a site that won&rsquo;t fill? Tell us and we&rsquo;ll fix it.
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-border-muted pt-6 text-center text-[12px] text-ink-dim">
          &copy; {new Date().getFullYear()} {site.legalName}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
