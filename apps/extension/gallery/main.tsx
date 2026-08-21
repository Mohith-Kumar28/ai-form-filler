import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gallery.css'
import { TabBar, UpgradeSheet } from '../src/entrypoints/sidepanel/components.js'
import { NavigationProvider } from '../src/entrypoints/sidepanel/navigation.js'
import { AddSource } from '../src/entrypoints/sidepanel/screens/AddSource.js'
import { Facts } from '../src/entrypoints/sidepanel/screens/Facts.js'
import { Filling } from '../src/entrypoints/sidepanel/screens/Filling.js'
import { Home } from '../src/entrypoints/sidepanel/screens/Home.js'
import { Profile } from '../src/entrypoints/sidepanel/screens/Profile.js'
import { Receipt } from '../src/entrypoints/sidepanel/screens/Receipt.js'
import { SourceDetail } from '../src/entrypoints/sidepanel/screens/SourceDetail.js'
import { Sources } from '../src/entrypoints/sidepanel/screens/Sources.js'
import { Welcome } from '../src/entrypoints/sidepanel/screens/Welcome.js'
import { cssName, DARK, LIGHT, TOKEN_NAMES } from '../src/lib/tokens.js'
import './stub-chrome.js'
import {
  ACCOUNT,
  ACCOUNT_LOW_QUOTA,
  ACCOUNT_NO_LONGFORM,
  ACCOUNT_ON_HOLD,
  ACCOUNT_ONBOARDING,
  EMPTY_PROFILE,
  MESSY_PROFILE,
  PLAN,
  PROFILE,
  REPORT,
} from './fixtures.js'

const scheme = new URLSearchParams(location.search).get('scheme') === 'dark' ? DARK : LIGHT
const style = document.createElement('style')
style.textContent = `:root { color-scheme: ${scheme === DARK ? 'dark' : 'light'}; ${TOKEN_NAMES.map(
  (token) => `--color-${cssName(token)}: ${scheme[token]};`,
).join(' ')} }`
document.head.appendChild(style)
document.body.style.background = scheme.surface

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

function Frame({
  label,
  note,
  width = 400,
  children,
}: {
  label: string
  note?: string
  width?: number
  children: ReactNode
}) {
  return (
    <figure className="m-0 flex flex-col gap-2" style={{ width }}>
      <figcaption className="px-1">
        <span className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-dim">
          {label}
        </span>
        {note && <span className="ml-2 text-2xs text-ink-dim">{note}</span>}
      </figcaption>
      <div
        className="h-[720px] overflow-hidden rounded-xl border border-border-muted bg-surface"
        style={{ width }}
      >
        <NavigationProvider>{children}</NavigationProvider>
      </div>
    </figure>
  )
}

/**
 * The sheet needs a positioned ancestor and a screen behind it.
 *
 * `UpgradeSheet` is `absolute inset-0` — in the panel it renders inside `Screen`, over whatever the
 * user was looking at. Rendering it bare in a frame would collapse it, so this reproduces the
 * arrangement it is designed for.
 */
function SheetHost({ mode }: { mode: 'trial' | 'compare' }) {
  return (
    <div className="relative h-full">
      <Home
        account={mode === 'trial' ? ACCOUNT_ONBOARDING : ACCOUNT_LOW_QUOTA}
        profile={PROFILE}
        page={PAGE_WITH_FORM}
        hasLastFill={false}
        onFill={() => undefined}
      />
      <UpgradeSheet
        mode={mode}
        onClose={() => undefined}
        reason={
          mode === 'trial'
            ? 'Start the trial and it will answer this form from the 5 sources you added.'
            : "You've used all 600 AI actions this month. They reset on the 1st."
        }
      />
    </div>
  )
}

function Gallery() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-surface p-8">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-10">
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

          <Frame label="Receipt" note="a ledger, and a stepper for the judgement calls">
            <Receipt plan={PLAN} report={REPORT} tabId={1} onDone={() => undefined} />
          </Frame>

          <Frame label="Facts" note="grouped into sections">
            <Facts profile={PROFILE} />
          </Frame>

          <Frame label="Facts" note="dragged wider — two-up past 480px" width={620}>
            <Facts profile={PROFILE} />
          </Frame>

          <Frame label="Account" note="dragged wider" width={620}>
            <Profile account={ACCOUNT} />
          </Frame>

          <Frame label="Facts" note="duplicated and messy — must show one row per fact">
            <Facts profile={MESSY_PROFILE} />
          </Frame>

          <Frame label="Facts" note="nothing on file yet">
            <Facts profile={EMPTY_PROFILE} />
          </Frame>

          <Frame label="Sources" note="one ready, one reading, one failed">
            <Sources profile={PROFILE} />
          </Frame>

          <Frame label="Sources" note="empty">
            <Sources profile={EMPTY_PROFILE} />
          </Frame>

          <Frame label="Add source" note="file mode">
            <AddSource />
          </Frame>

          <Frame label="Source detail" note="pdf, no preview offline">
            <SourceDetail sourceId="src_1" profile={PROFILE} />
          </Frame>

          <Frame label="Account">
            <Profile account={ACCOUNT} />
          </Frame>

          {/*
            The states that had no frame at all, which is why several of them were wrong.

            An onboarding account is the one the panel must say nothing about money in — no meter,
            no badge, no plan card — so it is worth being able to see that emptiness on purpose
            rather than discovering it in the extension.
          */}
          <Frame label="Home" note="onboarding — nothing about money yet">
            <Home
              account={ACCOUNT_ONBOARDING}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              hasLastFill={false}
              onFill={() => undefined}
            />
          </Frame>

          <Frame label="Account" note="onboarding — no billing section">
            <Profile account={ACCOUNT_ONBOARDING} />
          </Frame>

          <Frame label="Account" note="out of long answers">
            <Profile account={ACCOUNT_NO_LONGFORM} />
          </Frame>

          <Frame label="Account" note="payment failed">
            <Profile account={ACCOUNT_ON_HOLD} />
          </Frame>

          <Frame label="Upgrade sheet" note="trial, from a first fill attempt">
            <SheetHost mode="trial" />
          </Frame>

          <Frame label="Upgrade sheet" note="compare, from a spent allowance">
            <SheetHost mode="compare" />
          </Frame>

          {/*
            The tab bar had no frame, which is why its icons went unreviewed.

            It lives in `App.tsx` rather than in any screen, so every frame here rendered the panel
            without its own navigation. Three glyphs at 20px are exactly the kind of thing that
            needs looking at rather than reasoning about.
          */}
          <Frame label="Tab bar" note="the three roots">
            <div className="flex h-full flex-col justify-end">
              <TabBar />
            </div>
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
