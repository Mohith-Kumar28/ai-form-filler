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
 * A nine-screen stack, not a router.
 *
 * `@tanstack/react-router` was a dependency of this package and imported nowhere; adopting it
 * would buy URL parsing, route trees and code splitting for a surface with no URLs, no deep
 * links and nine screens. What is actually needed is a push/pop stack whose transition this
 * file can author directly, which is about sixty lines.
 *
 * The old panel had no navigation at all — screens appeared by state precedence inside one
 * component's early returns, so nothing had a back gesture and the review had to be rendered
 * above the account gates to keep its edits alive.
 */

export type Screen =
  | { name: 'home' }
  | { name: 'filling' }
  | { name: 'review' }
  | { name: 'knowledge' }
  | { name: 'addSource' }
  | { name: 'sourceDetail'; sourceId: string }
  | { name: 'profile' }
  | { name: 'aboutYou' }

export type ScreenName = Screen['name']

interface NavigationValue {
  screen: Screen
  depth: number
  push: (screen: Screen) => void
  /** Swaps the top of the stack, so Back skips the screen being left behind. */
  replace: (screen: Screen) => void
  back: () => void
  /** Unwinds to Home. Used when a screen's subject stops existing under it. */
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
      // One frame is enough: the commit has run and React has the new stack.
      requestAnimationFrame(() => {
        transitioning.current = false
      })
    },
    [],
  )

  const value = useMemo<NavigationValue>(
    () => ({
      screen: stack[stack.length - 1] ?? HOME,
      depth: stack.length - 1,
      push: (screen) => navigate('forward', (prev) => [...prev, screen]),
      replace: (screen) => navigate('forward', (prev) => [...prev.slice(0, -1), screen]),
      back: () => navigate('back', (prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
      home: () => navigate('back', () => [HOME]),
    }),
    [stack, navigate],
  )

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useNavigation must be used inside NavigationProvider')
  return value
}
