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
 * A stack of screens with one root: the page the person is on.
 *
 * There are no tabs. The panel is a control surface for the form beside it, and everything
 * else — what it knows about you, settings — is somewhere you go and come back from. A pushed
 * screen has a Back; the root has none. No URLs, because a docked panel is not a website.
 */

export type DocumentMode = 'upload' | 'link' | 'text' | 'voice'

export type Screen =
  | { name: 'page' }
  | { name: 'knowledge'; view?: 'sources' | 'facts' }
  | { name: 'settings' }
  | { name: 'addDocument'; initial?: DocumentMode }
  | { name: 'document'; id: string }

export type ScreenName = Screen['name']

interface NavigationValue {
  screen: Screen
  depth: number
  push: (screen: Screen) => void
  back: () => void
  /** Unwinds to the page. */
  home: () => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

const ROOT: Screen = { name: 'page' }

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
  const [stack, setStack] = useState<Screen[]>([ROOT])

  /** `startViewTransition` throws if one is already running; a double-tap is enough. */
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

  const value = useMemo<NavigationValue>(
    () => ({
      screen: stack[stack.length - 1] ?? ROOT,
      depth: stack.length - 1,
      push: (next) => navigate('forward', (prev) => [...prev, next]),
      back: () => navigate('back', (prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
      home: () => navigate('back', () => [ROOT]),
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
