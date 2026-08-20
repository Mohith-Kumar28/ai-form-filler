import { isAuthError } from '@aff/shared/constants'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useGetAccount } from '../../generated/endpoints/account/account.js'
import { useGetProfile } from '../../generated/endpoints/profile/profile.js'
import { hasSession } from '../../lib/auth.js'
import { onSessionEnded } from '../../lib/session.js'
import { useActivePage } from '../../lib/use-active-page.js'
import { useFill } from '../../lib/use-fill.js'
import { Screen, ScreenBody, ScreenHeader, SkeletonRow, TabBar } from './components.js'
import { NavigationProvider, useNavigation } from './navigation.js'
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

function Stack() {
  const nav = useNavigation()
  const account = useGetAccount({
    query: { refetchInterval: 5000 },
  })
  const profile = useGetProfile()
  const page = useActivePage()
  const fill = useFill()

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

  const screen = nav.screen
  const isRoot = nav.tab !== null
  const accountData = account.data

  function render() {
    switch (screen.name) {
      case 'account':
        return <Profile account={accountData} />

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
    </Screen>
  )
}

export function App() {
  const session = useSignedIn()

  if (session.isPending) return <div className="h-full bg-surface" />
  if (!session.data) return <Welcome />

  return (
    <NavigationProvider>
      <Stack />
    </NavigationProvider>
  )
}
