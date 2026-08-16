import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Footer } from '@/components/Footer'
import { Navbar } from '@/components/Navbar'
import { buildMeta, canonicalLink, softwareAppSchema } from '@/lib/seo'
import { site } from '@/lib/site'
import appCss from '@/styles/globals.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'color-scheme', content: 'light dark' },
      ...buildMeta({
        title: `${site.name} — ${site.tagline}`,
        description: site.description,
        path: '/',
      }),
    ],
    links: [
      { rel: 'canonical', href: `${site.domain}/` },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: appCss },
    ],
    scripts: [softwareAppSchema()],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Navbar />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
