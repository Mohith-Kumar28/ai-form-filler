import { isAuthError } from '@aff/shared/constants'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useGetAccount } from '../../generated/endpoints/account/account.js'
import { useGetProfile } from '../../generated/endpoints/profile/profile.js'
import { hasSession } from '../../lib/auth.js'
import { onSessionEnded } from '../../lib/session.js'
import { useActivePage } from '../../lib/use-active-page.js'
import { useFill } from '../../lib/use-fill.js'
import { Screen, ScreenBody, ScreenHeader, SkeletonRow } from './components.js'
import { NavigationProvider, useNavigation } from './navigation.js'
import { AddSource } from './screens/AddSource.js'
import { Filling } from './screens/Filling.js'
import { Home } from './screens/Home.js'
import { Profile } from './screens/Profile.js'
import { Review } from './screens/Review.js'
import { SourceDetail } from './screens/SourceDetail.js'
import { Sources } from './screens/Sources.js'
import { Welcome } from './screens/Welcome.js'

function useSignedIn() {
  const queryClient = useQueryClient()

  /**
   * The session can end during a request the panel never made — a fill running in the
   * background, or a press on the page chip. Without this the panel keeps rendering the
   * signed-in view and shows whatever the failed request threw.
   */
  useEffect(
    () =>
      onSessionEnded(() => {
        queryClient.setQueryData(['session'], false)
        // Drop the cached account and profile: they belong to a session that is over.
        queryClient.clear()
      }),
    [queryClient],
  )

  return useQuery({ queryKey: ['session'], queryFn: hasSession })
}

/**
 * Navigation follows the fill, rather than the fill hijacking whatever screen is open.
 *
 * A fill can start from the page as easily as from Home, so this watches the state machine
 * instead of hanging the transitions off the button: starting pushes the progress screen, and
 * finishing *replaces* it with the review, so Back from a review lands on Home rather than on
 * a progress list for work that is already over.
 */
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
      nav.replace({ name: 'review' })
    }
  }, [status, nav])
}

function Stack() {
  const nav = useNavigation()
  const account = useGetAccount({
    query: {
      // The plan flips server-side via webhook, which the panel cannot observe directly.
      // Poll so a completed checkout is reflected without a manual panel reopen.
      refetchInterval: 5000,
    },
  })
  const profile = useGetProfile()
  const page = useActivePage()
  const fill = useFill()

  useFillNavigation(fill.state.status)

  if (account.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Form Filler" />
        <ScreenBody aria-busy>
          <SkeletonRow />
          <SkeletonRow />
        </ScreenBody>
      </Screen>
    )
  }

  /**
   * An auth failure renders nothing at all.
   *
   * `onSessionEnded` is already swapping the whole panel to the signed-out view, so an error
   * here would flash red for one frame on the way to a sign-in button the user is about to
   * see anyway.
   */
  if (isAuthError((account.error as { code?: string } | null)?.code)) return null

  if (account.isError || !account.data) {
    return (
      <Screen>
        <ScreenHeader title="Form Filler" />
        <ScreenBody className="flex items-center justify-center px-6">
          <p className="text-center text-[12.5px] leading-relaxed text-alert" role="alert">
            {account.error?.message ?? 'Could not load your account.'}
          </p>
        </ScreenBody>
      </Screen>
    )
  }

  const screen = nav.screen

  switch (screen.name) {
    case 'profile':
      return <Profile account={account.data} />

    case 'sources':
      return <Sources profile={profile.data} />

    case 'addSource':
      return <AddSource />

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

    case 'review':
      return fill.state.plan ? (
        <Review
          plan={fill.state.plan}
          report={fill.state.report}
          tabId={fill.state.tabId ?? page.tabId}
          onDone={() => {
            fill.reset()
            nav.home()
          }}
        />
      ) : (
        <Home
          account={account.data}
          profile={profile.data}
          page={page}
          hasLastFill={false}
          onFill={() => void fill.start({ overwriteExisting: false })}
        />
      )

    default:
      return (
        <Home
          account={account.data}
          profile={profile.data}
          page={page}
          hasLastFill={fill.state.status === 'done' && fill.state.plan !== undefined}
          onFill={() => void fill.start({ overwriteExisting: false })}
        />
      )
  }
}

export function App() {
  const session = useSignedIn()

  if (session.isPending) return <div className="h-full bg-stock" />
  if (!session.data) return <Welcome />

  return (
    <NavigationProvider>
      <Stack />
    </NavigationProvider>
  )
}
