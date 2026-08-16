import { getOverlayHost, prefersReducedMotion } from './host.js'

/**
 * A tiny confetti burst, for the moment a fill lands.
 *
 * The product's whole job is taking the dread out of a miserable task, and the completion is
 * the one moment it can feel like a win rather than a chore. Pure DOM, no library, ~20
 * absolutely-positioned scraps that fly outward and vanish. Reduced motion skips it entirely.
 */

const COLORS = ['var(--aff-sparkle)', 'var(--aff-accent)', 'var(--aff-sun)', 'var(--aff-positive)']

export function burstConfetti(x: number, y: number): void {
  if (prefersReducedMotion()) return
  const { root } = getOverlayHost()

  const count = 18
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6
    const distance = 42 + Math.random() * 52
    const piece = document.createElement('span')
    piece.className = 'confetti'
    piece.style.left = `${x}px`
    piece.style.top = `${y}px`
    piece.style.setProperty('--dx', `${Math.round(Math.cos(angle) * distance)}px`)
    piece.style.setProperty('--dy', `${Math.round(Math.sin(angle) * distance - 18)}px`)
    piece.style.setProperty('--rot', `${Math.round(Math.random() * 320 - 160)}deg`)
    piece.style.background = COLORS[i % COLORS.length] ?? 'var(--aff-accent)'
    root.appendChild(piece)
    piece.addEventListener('animationend', () => piece.remove())
    // Fallback in case the animation never settles on a host that paused it.
    setTimeout(() => piece.remove(), 1000)
  }
}
