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
  DeletedFarewell,
  Screen,
  ScreenBody,
  ScreenHeader,
  SkeletonRow,
  TabBar,
  UpgradeSheet,
} from './components.js'
import { NavigationProvider, useNavigation } from './navigation.js'
import { Onboarding } from './onboarding/index.js'
import { AddSource } from './screens/AddSource.js'
import { Facts } from './screens/Facts.js'
import { Filling } from './screens/Filling.js'
import { Home } from './screens/Home.js'
import { Profile } from './screens/Profile.js'
import { Receipt } from './screens/Receipt.js'
import { SourceDetail } from './screens/SourceDetail.js'
import { Sources } from './screens/Sources.js'
import { Welcome } from './screens/Welcome.js'

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

function useFillNavigation(status: string) {
  const nav = useNavigation()
  const previous = useRef(status)

  useEffect(() => {
    const was = previous.current
    previous.current = status

    if (status === was) return

    if (status === 'running' && nav.screen.name !== 'filling') {
      nav.push({ name: 'filling' })
      return
    }

    if (status === 'done' && (nav.screen.name === 'filling' || nav.screen.name === 'home')) {
      nav.replace({ name: 'receipt' })
    }
  }, [status, nav])
}

/**
 * The offer, when the *page* asked for it.
 *
 * Pressing the launcher on a form with nothing left to spend opens this panel and leaves a note
 * saying which offer to show; this renders it over whatever screen the panel happened to be on.
 * It lives here rather than in `Home` because the panel does not necessarily open on Home, and a
 * refusal that opens the panel to silence is worse than the small card it replaced.
 *
 * Meeting it marks the paywall as seen, exactly as pressing Fill in here does — from this point the
 * account screen carries a permanent way back to it.
 */
function PageRequestedPaywall({
  account,
  suppressed = false,
}: {
  account: Account
  /**
   * Take the note and drop it, showing nothing.
   *
   * For the one screen where the offer must not land: somebody in the middle of first-run setup who
   * reached over and pressed the launcher on their form. Interrupting the setup with a price is
   * both the wrong moment and the wrong order — the panel opening on their own half-finished
   * profile is answer enough, and the offer arrives at their first real Fill. Consuming the note
   * rather than ignoring it is what stops the sheet appearing minutes later, out of nowhere.
   */
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
  const account = useGetAccount({
    query: { refetchInterval: 5000 },
  })
  const profile = useGetProfile()
  const page = useActivePage()
  const fill = useFill()

  /**
   * Whether this account has anything in it, which is how a new user is told from an old one.
   *
   * `undefined` until the profile has loaded, which holds the first-run flow at `loading` rather
   * than letting it flash onto the screen of somebody with twelve sources. See `useOnboarding`.
   */
  const hasContent =
    profile.data === undefined
      ? undefined
      : (profile.data.sources ?? []).length > 0 || factCount(reconcile(profile.data)) > 0
  const onboarding = useOnboarding(hasContent)

  useFillNavigation(fill.state.status)

  if (account.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Fillaform" />
        <ScreenBody aria-busy>
          <SkeletonRow />
          <SkeletonRow />
        </ScreenBody>
      </Screen>
    )
  }

  if (isAuthError((account.error as { code?: string } | null)?.code)) return null

  if (account.isError || !account.data) {
    return (
      <Screen>
        <ScreenHeader title="Fillaform" />
        <ScreenBody className="flex items-center justify-center px-6">
          <p className="text-center text-xs leading-relaxed text-danger" role="alert">
            {account.error?.message ?? 'Could not load your account.'}
          </p>
        </ScreenBody>
      </Screen>
    )
  }

  const accountData = account.data

  /*
    First run takes the whole panel, tab bar included.

    Deliberately not a screen in the navigation stack: it is a sequence with its own progress and
    its own back button, and putting it on the stack would give it a second one — plus three tabs
    inviting the user out of the middle of it. It also renders before `Home` can, which matters,
    because Home's one button does nothing worth seeing on an empty account.
  */
  if (onboarding.status === 'running') {
    return (
      <>
        <Onboarding
          account={accountData}
          profile={profile.data}
          step={onboarding.step}
          onStep={onboarding.go}
          onFinish={onboarding.finish}
        />
        <PageRequestedPaywall account={accountData} suppressed />
      </>
    )
  }

  const screen = nav.screen
  const isRoot = nav.tab !== null

  function render() {
    switch (screen.name) {
      case 'account':
        return (
          <Profile
            account={accountData}
            sourceCount={profile.data?.sources?.length ?? 0}
            onReplayTour={onboarding.restart}
            onDeleted={onAccountDeleted}
          />
        )

      case 'yourInfo':
        // Facts is the default half: what it knows is what people come here to check.
        return screen.view === 'sources' ? (
          <Sources profile={profile.data} />
        ) : (
          <Facts profile={profile.data} />
        )

      case 'addInfo':
        return <AddSource initial={screen.initial} />

      case 'sourceDetail':
        return <SourceDetail sourceId={screen.sourceId} profile={profile.data} />

      case 'filling':
        return (
          <Filling
            state={fill.state}
            fieldCount={page.fieldCount}
            onCancel={() => {
              fill.reset()
              nav.home()
            }}
          />
        )

      case 'receipt':
        return fill.state.plan ? (
          <Receipt
            plan={fill.state.plan}
            report={fill.state.report}
            tabId={fill.state.tabId ?? page.tabId}
            onBack={() => {
              fill.reset()
              nav.home()
            }}
            onDone={() => {
              fill.reset()
              window.close()
            }}
          />
        ) : (
          <Home
            account={accountData}
            profile={profile.data}
            page={page}
            hasLastFill={false}
            onFill={() => void fill.start({ overwriteExisting: false })}
          />
        )

      default:
        return (
          <Home
            account={accountData}
            profile={profile.data}
            page={page}
            hasLastFill={fill.state.status === 'done' && fill.state.plan !== undefined}
            onFill={() => void fill.start({ overwriteExisting: false })}
          />
        )
    }
  }

  return (
    <Screen>
      {render()}
      {isRoot && <TabBar />}
      <PageRequestedPaywall account={accountData} />
    </Screen>
  )
}

export function App() {
  const session = useSignedIn()

  /**
   * The deletion receipt, held here and nowhere lower down.
   *
   * A finished deletion clears the session token, which every context watching that key reads as
   * the session ending — so the signed-in tree, including the dialog that asked for the deletion,
   * is replaced by `Welcome` in the same tick the request succeeds. `App` survives that swap
   * because it is the component doing the swapping, which makes it the only place a message about
   * what just happened can outlive the thing that caused it.
   *
   * Checked before the signed-out branch on purpose: by the time there is a report to show, the
   * session is already gone, so a `Welcome` screen returned first would win every time.
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
