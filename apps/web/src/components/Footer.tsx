import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/Logo'
import { site } from '@/lib/site'
import { IconSparkle } from '@/components/ui'

const footerNav = [
  { label: 'How it works', to: '/how-it-works' },
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Compare', to: '/compare' },
  { label: 'Blog', to: '/blog' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
]

export function Footer() {
  return (
    <footer className="border-t border-border-muted bg-surface-muted">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-[36ch] text-[13px] leading-relaxed text-ink-muted">
              The hype friend who does the boring homework. Fill any form in your own voice —
              and always know what it read vs. what it guessed.
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

          <nav className="flex flex-col gap-2.5 md:pt-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim">Pages</p>
            {footerNav.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[13px] text-ink-muted no-underline transition-colors duration-150 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 md:pt-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim">Stay in touch</p>
            <a href={`mailto:${site.supportEmail}`} className="text-[13px] text-ink-muted no-underline hover:text-ink">
              {site.supportEmail}
            </a>
            <p className="text-[13px] text-ink-dim">Made with a sparkle and a lot of form-filling empathy.</p>
          </div>
        </div>

        <div className="mt-12 border-t border-border-muted pt-6 text-center text-[12px] text-ink-dim">
          &copy; {new Date().getFullYear()} {site.legalName}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}