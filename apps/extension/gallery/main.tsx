import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gallery.css'
import {
  DeleteAccountSheet,
  DeletedFarewell,
  UpgradeSheet,
} from '../src/entrypoints/sidepanel/components.js'
import { NavigationProvider } from '../src/entrypoints/sidepanel/navigation.js'
import { AddDocument } from '../src/entrypoints/sidepanel/screens/AddDocument.js'
import { Document } from '../src/entrypoints/sidepanel/screens/Document.js'
import { Knowledge } from '../src/entrypoints/sidepanel/screens/Knowledge.js'
import { Page } from '../src/entrypoints/sidepanel/screens/Page.js'
import { Settings } from '../src/entrypoints/sidepanel/screens/Settings.js'
import { Welcome } from '../src/entrypoints/sidepanel/screens/Welcome.js'
import { Setup } from '../src/entrypoints/sidepanel/setup/index.js'
import { getGetAccountQueryKey } from '../src/generated/endpoints/account/account.js'
import { getGetProfileQueryKey } from '../src/generated/endpoints/profile/profile.js'
import { cssName, DARK, LIGHT, TOKEN_NAMES } from '../src/lib/tokens.js'
import type { FillState } from '../src/lib/use-fill.js'
import './stub-chrome.js'
import {
  ACCOUNT,
  ACCOUNT_FREE_GRANT,
  ACCOUNT_FREE_SPENT,
  ACCOUNT_LOW_QUOTA,
  ACCOUNT_NO_LONGFORM,
  ACCOUNT_ON_HOLD,
  ACCOUNT_ONBOARDING,
  EMPTY_PROFILE,
  FORM,
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
queryClient.setQueryData(getGetProfileQueryKey(), PROFILE)
queryClient.setQueryData(getGetAccountQueryKey(), ACCOUNT)

const WIDTH = Number(new URLSearchParams(location.search).get('width') ?? 360)

const PAGE_WITH_FORM = {
  status: 'ready' as const,
  tabId: 1,
  origin: 'boards.greenhouse.io',
  fieldCount: FORM.fields.length,
  form: FORM,
  refresh: () => undefined,
}
const PAGE_WITHOUT_FORM = {
  status: 'ready' as const,
  tabId: 1,
  origin: 'en.wikipedia.org',
  fieldCount: 0,
  form: null,
  refresh: () => undefined,
}
const PAGE_UNAVAILABLE = {
  status: 'unavailable' as const,
  tabId: 1,
  origin: null,
  fieldCount: 0,
  form: null,
  refresh: () => undefined,
}

const IDLE: FillState = { status: 'idle' }
const RUNNING: FillState = {
  status: 'running',
  stage: 'generating',
  stageDone: 0,
  stageTotal: 12,
  tabId: 1,
}
const FAILED: FillState = {
  status: 'error',
  error: { code: 'INTERNAL', message: 'The fill was interrupted. Try again.' },
  tabId: 1,
}
const DONE: FillState = { status: 'done', plan: PLAN, report: REPORT, tabId: 1 }

function Frame({
  label,
  note,
  width = WIDTH,
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
        className="h-[680px] overflow-hidden rounded-xl border border-border-muted bg-surface"
        style={{ width }}
      >
        <NavigationProvider>
          <div className="relative h-full">{children}</div>
        </NavigationProvider>
      </div>
    </figure>
  )
}

const noop = () => undefined

function Gallery() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-surface p-8">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-10">
          <Frame label="Welcome" note="signed out">
            <Welcome />
          </Frame>

          <Frame label="Page" note="before a fill — the ledger">
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="filling">
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={RUNNING}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="failed">
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={FAILED}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="after a fill — the receipt">
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={DONE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="nothing saved yet — nothing known">
            <Page
              account={ACCOUNT_ONBOARDING}
              profile={EMPTY_PROFILE}
              page={PAGE_WITH_FORM}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="free grant spent">
            <Page
              account={ACCOUNT_FREE_SPENT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="no form here">
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITHOUT_FORM}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="page cannot be read">
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_UNAVAILABLE}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Page" note="narrowest Chrome allows" width={320}>
            <Page
              account={ACCOUNT}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={DONE}
              onFill={noop}
              onReset={noop}
            />
          </Frame>

          <Frame label="Knowledge" note="sources">
            <Knowledge profile={PROFILE} />
          </Frame>

          <Frame label="Knowledge" note="facts — the whole catalogue, grouped">
            <Knowledge profile={PROFILE} initialView="facts" />
          </Frame>

          <Frame label="Knowledge" note="facts — duplicated and messy">
            <Knowledge profile={MESSY_PROFILE} initialView="facts" />
          </Frame>

          <Frame label="Knowledge" note="empty">
            <Knowledge profile={EMPTY_PROFILE} />
          </Frame>

          <Frame label="Add a document">
            <AddDocument />
          </Frame>

          <Frame label="Document" note="pdf, no preview offline">
            <Document id={(PROFILE.sources ?? [])[0]?.id ?? ''} profile={PROFILE} />
          </Frame>

          <Frame label="Settings" note="mid-trial">
            <Settings account={ACCOUNT} onReplaySetup={noop} />
          </Frame>

          <Frame label="Settings" note="onboarding — no money yet">
            <Settings account={ACCOUNT_ONBOARDING} onReplaySetup={noop} />
          </Frame>

          <Frame label="Settings" note="free grant, barely touched">
            <Settings account={ACCOUNT_FREE_GRANT} onReplaySetup={noop} />
          </Frame>

          <Frame label="Settings" note="free grant spent">
            <Settings account={ACCOUNT_FREE_SPENT} onReplaySetup={noop} />
          </Frame>

          <Frame label="Settings" note="quota nearly out">
            <Settings account={ACCOUNT_LOW_QUOTA} onReplaySetup={noop} />
          </Frame>

          <Frame label="Settings" note="out of long answers">
            <Settings account={ACCOUNT_NO_LONGFORM} onReplaySetup={noop} />
          </Frame>

          <Frame label="Settings" note="payment failed">
            <Settings account={ACCOUNT_ON_HOLD} onReplaySetup={noop} />
          </Frame>

          <Frame label="Delete account" note="three gates — click through them">
            <Settings account={ACCOUNT} />
            <DeleteAccountSheet
              email={ACCOUNT.email}
              documentCount={5}
              hasSubscription
              onConfirm={noop}
              onCancel={noop}
            />
          </Frame>

          <Frame label="Deleted" note="the receipt">
            <DeletedFarewell
              report={{ documents: 14, files: 3, subscription: 'cancelled' }}
              onDismiss={noop}
            />
          </Frame>

          <Frame label="Offer" note="trial, from a first fill">
            <Page
              account={ACCOUNT_ONBOARDING}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
            <UpgradeSheet
              mode="trial"
              onClose={noop}
              reason="Your answers are ready. Start the trial and it fills this form."
            />
          </Frame>

          <Frame label="Offer" note="compare, from a spent allowance">
            <Page
              account={ACCOUNT_LOW_QUOTA}
              profile={PROFILE}
              page={PAGE_WITH_FORM}
              fill={IDLE}
              onFill={noop}
              onReset={noop}
            />
            <UpgradeSheet
              mode="compare"
              onClose={noop}
              reason="You've filled all 600 fields your plan covers this month."
            />
          </Frame>

          <Frame label="Setup" note="1 of 2 — nothing added yet">
            <Setup
              account={ACCOUNT_ONBOARDING}
              profile={EMPTY_PROFILE}
              step={0}
              onStep={noop}
              onFinish={noop}
            />
          </Frame>

          <Frame label="Setup" note="1 of 2 — a résumé added">
            <Setup
              account={ACCOUNT_ONBOARDING}
              profile={PROFILE}
              step={0}
              onStep={noop}
              onFinish={noop}
            />
          </Frame>

          <Frame label="Setup" note="2 of 2 — the basics">
            <Setup
              account={ACCOUNT_ONBOARDING}
              profile={PROFILE}
              step={1}
              onStep={noop}
              onFinish={noop}
            />
          </Frame>
        </div>
      </div>
    </QueryClientProvider>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('gallery root is missing')
createRoot(container).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
