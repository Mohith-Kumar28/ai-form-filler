import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gallery.css'
import { NavigationProvider } from '../src/entrypoints/sidepanel/navigation.js'
import { AboutYou } from '../src/entrypoints/sidepanel/screens/AboutYou.js'
import { AddSource } from '../src/entrypoints/sidepanel/screens/AddSource.js'
import { Filling } from '../src/entrypoints/sidepanel/screens/Filling.js'
import { Home } from '../src/entrypoints/sidepanel/screens/Home.js'
import { Knowledge } from '../src/entrypoints/sidepanel/screens/Knowledge.js'
import { Profile } from '../src/entrypoints/sidepanel/screens/Profile.js'
import { Review } from '../src/entrypoints/sidepanel/screens/Review.js'
import { SourceDetail } from '../src/entrypoints/sidepanel/screens/SourceDetail.js'
import { Welcome } from '../src/entrypoints/sidepanel/screens/Welcome.js'
import { cssName, DARK, LIGHT, TOKEN_NAMES } from '../src/lib/tokens.js'
import './stub-chrome.js'
import { ACCOUNT, ACCOUNT_LOW_QUOTA, EMPTY_PROFILE, PLAN, PROFILE, REPORT } from './fixtures.js'

/**
 * The review gallery.
 *
 * Every screen at its real width, with real content, in one page — because the finish review
 * happens against screenshots, and a reviewer with no browser can only check what it is shown.
 * The alternative was reviewing nine screens one signed-in session at a time.
 *
 * The scheme is declared explicitly from `tokens.ts` rather than left to
 * `prefers-color-scheme`. Headless Chrome answers that query `dark` and offers no flag to
 * change it, so a "light" capture would silently have been a second dark one — which is
 * exactly the kind of thing a screenshot review is supposed to catch, not produce.
 */

const scheme = new URLSearchParams(location.search).get('scheme') === 'dark' ? DARK : LIGHT
const style = document.createElement('style')
style.textContent = `:root { color-scheme: ${scheme === DARK ? 'dark' : 'light'}; ${TOKEN_NAMES.map(
  (token) => `--color-${cssName(token)}: ${scheme[token]};`,
).join(' ')} }`
document.head.appendChild(style)
document.body.style.background = scheme.stock

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
})

const PAGE_WITH_FORM = {
  status: 'ready' as const,
  tabId: 1,
  origin: 'boards.greenhouse.io',
  fieldCount: 12,
  form: null,
}

const PAGE_WITHOUT_FORM = {
  status: 'ready' as const,
  tabId: 1,
  origin: 'en.wikipedia.org',
  fieldCount: 0,
  form: null,
}

function Frame({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="px-1">
        <span className="mrz text-[11px] font-medium uppercase tracking-[0.1em] text-ink">
          {label}
        </span>
        {note && <span className="ml-2 text-[11px] text-ink3">{note}</span>}
      </figcaption>
      <div className="h-[720px] w-[400px] overflow-hidden border border-guilloche bg-stock">
        <NavigationProvider>{children}</NavigationProvider>
      </div>
    </figure>
  )
}

function Gallery() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-stock p-8">
        <div className="grid grid-cols-[repeat(auto-fill,400px)] gap-x-8 gap-y-10">
          <Frame label="Welcome" note="signed out, first run">
            <Welcome />
          </Frame>

          <Frame label="Home" note="form detected">
            <Home
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              hasLastFill
              onFill={() => undefined}
            />
          </Frame>

          <Frame label="Home" note="no form, quota nearly out">
            <Home
              account={ACCOUNT_LOW_QUOTA}
              profile={PROFILE}
              page={PAGE_WITHOUT_FORM}
              hasLastFill={false}
              onFill={() => undefined}
            />
          </Frame>

          <Frame label="Home" note="nothing on file yet">
            <Home
              account={{ ...ACCOUNT, profileReady: false }}
              profile={EMPTY_PROFILE}
              page={PAGE_WITH_FORM}
              hasLastFill={false}
              onFill={() => undefined}
            />
          </Frame>

          <Frame label="Filling" note="mid-run">
            <Filling
              state={{ status: 'running', stage: 'applying', stageDone: 7, stageTotal: 12 }}
              fieldCount={12}
              onCancel={() => undefined}
            />
          </Frame>

          <Frame label="Filling" note="failed">
            <Filling
              state={{
                status: 'error',
                stage: 'generating',
                error: { code: 'UPSTREAM_ERROR', message: 'The model did not answer in time.' },
              }}
              fieldCount={12}
              onCancel={() => undefined}
            />
          </Frame>

          <Frame label="Review" note="two concluded, one unsure">
            <Review plan={PLAN} report={REPORT} tabId={1} onDone={() => undefined} />
          </Frame>

          <Frame label="Knowledge" note="mixed states, one failed">
            <Knowledge profile={PROFILE} />
          </Frame>

          <Frame label="Knowledge" note="empty">
            <Knowledge profile={EMPTY_PROFILE} />
          </Frame>

          <Frame label="Add source" note="file mode">
            <AddSource />
          </Frame>

          <Frame label="Source detail" note="pdf, no preview offline">
            <SourceDetail sourceId="src_1" profile={PROFILE} />
          </Frame>

          <Frame label="Profile">
            <Profile account={ACCOUNT} />
          </Frame>

          <Frame label="About you">
            <AboutYou profile={PROFILE} />
          </Frame>
        </div>
      </div>
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
