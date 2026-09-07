import type { DeletionReport } from '@aff/shared'
import { isAuthError } from '@aff/shared/constants'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useGetAccount } from '../../generated/endpoints/account/account.js'
import { useGetProfile } from '../../generated/endpoints/profile/profile.js'
import type { Account } from '../../generated/model/index.js'
import { hasSession } from '../../lib/auth.js'
import { factCount, reconcile } from '../../lib/fact-catalog.js'
import { useOnboarding } from '../../lib/onboarding.js'
import { usePaywallSeen, usePendingPaywall } from '../../lib/paywall.js'
import { onSessionEnded } from '../../lib/session.js'
import { useActivePage } from '../../lib/use-active-page.js'
import { useFill } from '../../lib/use-fill.js'
import {
  Body,
  DeletedFarewell,
  Header,
  Note,
  Screen,
  SkeletonRows,
  UpgradeSheet,
} from './components.js'
import { NavigationProvider, useNavigation } from './navigation.js'
import { AddDocument } from './screens/AddDocument.js'
import { Document } from './screens/Document.js'
import { Knowledge } from './screens/Knowledge.js'
import { Page } from './screens/Page.js'
import { Settings } from './screens/Settings.js'
import { Welcome } from './screens/Welcome.js'
import { Setup } from './setup/index.js'

function useSignedIn() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      onSessionEnded(() => {
        queryClient.setQueryData(['session'], false)
        queryClient.clear()
      }),
    [queryClient],
  )
  return useQuery({ queryKey: ['session'], queryFn: hasSession })
}

/**
 * The offer, when the *page* asked for it.
 *
 * Pressing the launcher on a form with nothing left to spend opens this panel and leaves a note
 * saying which offer to show; this renders it over whatever screen the panel is on. Meeting it
 * marks the paywall as seen, exactly as pressing Fill in here does.
 *
 * `suppressed` takes the note and drops it: somebody in the middle of first-run setup who
 * reached over and pressed the launcher should not be interrupted with a price.
 */
function PageRequestedPaywall({
  account,
  suppressed = false,
}: {
  account: Account
  suppressed?: boolean
}) {
  const { pending, clear } = usePendingPaywall()
  const { markSeen } = usePaywallSeen()

  useEffect(() => {
    if (pending && !suppressed) markSeen()
  }, [pending, suppressed, markSeen])

  if (!pending || suppressed) return null
  const { limit } = account.quota

  return (
    <UpgradeSheet
      mode={pending.mode}
      onClose={clear}
      reason={
        pending.mode === 'trial'
          ? 'Your answers are ready. Start the trial and it will fill the form you were looking at.'
          : `You've filled all ${limit} fields your plan covers this month. They reset on the 1st.`
      }
    />
  )
}

function Stack({ onAccountDeleted }: { onAccountDeleted: (report: DeletionReport) => void }) {
  const nav = useNavigation()
  const account = useGetAccount({ query: { refetchInterval: 5000 } })
  const profile = useGetProfile()
  const page = useActivePage()
  const fill = useFill()

  /**
   * Whether this account has anything in it, which is how a new user is told from an old one.
   * `undefined` until the profile has loaded, so first-run setup cannot flash onto the screen
   * of somebody with twelve documents.
   */
  const hasContent =
    profile.data === undefined
      ? undefined
      : (profile.data.sources ?? []).length > 0 || factCount(reconcile(profile.data)) > 0
  const onboarding = useOnboarding(hasContent)

  /*
    A fill that finishes while the person is elsewhere in the panel brings them back to the
    page: the receipt is the reason the fill was started. A fill in progress does not.
  */
  const navRef = useRef(nav)
  navRef.current = nav
  const status = fill.state.status
  useEffect(() => {
    if (status === 'done' && navRef.current.screen.name !== 'page') navRef.current.home()
  }, [status])

  if (account.isPending) {
    return (
      <Screen>
        <Header title="Fillaform" />
        <Body className="px-gutter pt-1">
          <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
            <SkeletonRows count={2} />
          </div>
        </Body>
      </Screen>
    )
  }

  if (isAuthError((account.error as { code?: string } | null)?.code)) return null

  if (account.isError || !account.data) {
    return (
      <Screen>
        <Header title="Fillaform" />
        <Body className="px-gutter pt-1">
          <Note tone="danger">{account.error?.message ?? 'Could not load your account.'}</Note>
        </Body>
      </Screen>
    )
  }

  const accountData = account.data

  /*
    First run takes the whole panel. Deliberately not a screen in the stack: it is a sequence
    with its own progress and its own Back, and it renders before the page can, because the
    page's one button does nothing worth seeing on an empty account.
  */
  if (onboarding.status === 'running') {
    return (
      <div className="relative h-full">
        <Setup
          account={accountData}
          profile={profile.data}
          step={onboarding.step}
          onStep={onboarding.go}
          onFinish={onboarding.finish}
        />
        <PageRequestedPaywall account={accountData} suppressed />
      </div>
    )
  }

  const screen = nav.screen

  function render() {
    switch (screen.name) {
      case 'knowledge':
        return <Knowledge profile={profile.data} initialView={screen.view} />
      case 'settings':
        return (
          <Settings
            account={accountData}
            documentCount={profile.data?.sources?.length ?? 0}
            onReplaySetup={() => {
              nav.home()
              onboarding.restart()
            }}
            onDeleted={onAccountDeleted}
          />
        )
      case 'addDocument':
        return <AddDocument initial={screen.initial} />
      case 'document':
        return <Document id={screen.id} profile={profile.data} />
      default:
        return (
          <Page
            account={accountData}
            profile={profile.data}
            page={page}
            fill={fill.state}
            onFill={() => void fill.start({ overwriteExisting: false })}
            onReset={fill.reset}
          />
        )
    }
  }

  return (
    <div className="relative h-full">
      {render()}
      <PageRequestedPaywall account={accountData} />
    </div>
  )
}

export function App() {
  const session = useSignedIn()

  /**
   * The deletion receipt, held here and nowhere lower down: a finished deletion clears the
   * session, so the signed-in tree — including the dialog that asked — is replaced by Welcome
   * in the same tick. `App` survives that swap because it is the component doing the swapping.
   */
  const [farewell, setFarewell] = useState<DeletionReport | null>(null)

  if (session.isPending) return <div className="h-full bg-surface" />
  if (farewell) return <DeletedFarewell report={farewell} onDismiss={() => setFarewell(null)} />
  if (!session.data) return <Welcome />

  return (
    <NavigationProvider>
      <Stack onAccountDeleted={setFarewell} />
    </NavigationProvider>
  )
}
