import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * A tiny navigation model: three root tabs and a stack of screens that push on top of them.
 *
 * The panel is a docked control surface, not a website, so there are no URLs to parse. The
 * three tabs are the whole app — Fill, My info, Account — and everything else (filling in
 * progress, a review, adding a source, a source's detail) pushes on top of whichever tab is
 * current and pops back to it.
 */

export type TabName = 'home' | 'yourInfo' | 'account'

export type Screen =
  | { name: 'home' }
  | { name: 'yourInfo' }
  | { name: 'account' }
  | { name: 'filling' }
  | { name: 'review' }
  | { name: 'addInfo' }
  | { name: 'sourceDetail'; sourceId: string }

export type ScreenName = Screen['name']

/** Root tab order, used to pick a slide direction when switching tabs. */
const TAB_ORDER: TabName[] = ['home', 'yourInfo', 'account']

function isTab(screen: Screen): screen is { name: TabName } {
  return TAB_ORDER.includes(screen.name as TabName)
}

interface NavigationValue {
  screen: Screen
  /** Which root tab is underneath, or `null` while a pushed screen is on top. */
  tab: TabName | null
  depth: number
  push: (screen: Screen) => void
  /** Swaps the top of the stack, so Back skips the screen being left behind. */
  replace: (screen: Screen) => void
  back: () => void
  /** Switches root tabs. */
  goToTab: (tab: TabName) => void
  /** Unwinds to the Fill tab. */
  home: () => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

const HOME: Screen = { name: 'home' }

/**
 * Direction is written to the document element, not held in React state.
 *
 * The view transition's pseudo-elements live outside the React tree, so the only way to give
 * a push and a pop different animations is a selector on an ancestor. Reading it from state
 * would also be a frame late — `startViewTransition` snapshots before React commits.
 */
function runTransition(direction: 'forward' | 'back', commit: () => void): void {
  const root = document.documentElement

  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    commit()
    return
  }

  root.dataset.nav = direction
  const transition = document.startViewTransition(commit)
  void transition.finished.finally(() => {
    delete root.dataset.nav
  })
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([HOME])

  /**
   * Guards against a second transition starting inside the first.
   *
   * `startViewTransition` throws if one is already running, and a double-tap on a row is
   * enough to produce that — which would leave `data-nav` set and every later push animating
   * in the wrong direction.
   */
  const transitioning = useRef(false)

  const navigate = useCallback(
    (direction: 'forward' | 'back', next: (prev: Screen[]) => Screen[]) => {
      if (transitioning.current) return
      transitioning.current = true
      runTransition(direction, () => setStack(next))
      requestAnimationFrame(() => {
        transitioning.current = false
      })
    },
    [],
  )

  const value = useMemo<NavigationValue>(() => {
    const screen = stack[stack.length - 1] ?? HOME
    const tab = isTab(screen) ? screen.name : (stack.findLast(isTab)?.name ?? 'home')

    return {
      screen,
      tab,
      depth: stack.length - 1,
      push: (next) => navigate('forward', (prev) => [...prev, next]),
      replace: (next) => navigate('forward', (prev) => [...prev.slice(0, -1), next]),
      back: () => navigate('back', (prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
      goToTab: (next) =>
        navigate(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 'forward' : 'back', () => [
          screenForTab(next),
        ]),
      home: () => navigate('back', () => [HOME]),
    }
  }, [stack, navigate])

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

function screenForTab(tab: TabName): Screen {
  return { name: tab }
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useNavigation must be used inside NavigationProvider')
  return value
}
