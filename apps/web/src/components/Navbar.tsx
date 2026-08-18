import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { IconSparkle } from '@/components/ui'
import { navLinks, site } from '@/lib/site'

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-border-muted bg-surface/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="no-underline" aria-label="Fillaform home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-ink-muted no-underline transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
              activeProps={{ className: 'bg-surface-muted text-ink' }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={site.chromeWebStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white no-underline shadow-glow transition-[filter] duration-150 hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }}
          >
            <IconSparkle className="size-4" />
            Add to Chrome
          </a>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <svg
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <path d="M3 3 L13 13 M13 3 L3 13" />
              ) : (
                <path d="M2 4 H14 M2 8 H14 M2 12 H14" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border-muted bg-surface px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="rounded-full px-3 py-2 text-[14px] font-medium text-ink-muted no-underline hover:bg-surface-muted hover:text-ink"
                activeProps={{ className: 'bg-surface-muted text-ink' }}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
