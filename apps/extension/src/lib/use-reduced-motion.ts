import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether this person asked their OS for less movement.
 *
 * The stylesheet handles CSS animations on its own (see the `prefers-reduced-motion` block in
 * `assets/tailwind.css`), so this is for the motion CSS cannot switch off: SVG `<animate>`
 * elements, which are markup rather than style, and animations driven from JavaScript. Live
 * rather than read once, because the setting can change while the panel is open.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia(QUERY).matches)

  useEffect(() => {
    const query = matchMedia(QUERY)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
