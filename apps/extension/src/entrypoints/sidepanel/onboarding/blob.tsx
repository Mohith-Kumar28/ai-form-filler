import { type RefObject, useEffect, useId, useState } from 'react'
import { useReducedMotion } from '../../../lib/use-reduced-motion.js'
import { type Expression, MascotFace, MascotGradient } from '../components.js'

/*
  The mascot, at hero size, refusing to hold still.

  Everywhere else in the panel the mark is a 22–56px circle: small, calm, one of several things on
  a row. Onboarding is the one place it is the subject rather than a bullet — the first screen is
  the product introducing itself — so here the body is a blob that morphs between four silhouettes
  while the face stays put and does the talking.

  Morphing is an SVG `<animate>` on the path's `d`, not a CSS animation, because CSS cannot
  interpolate a path. That has one hard requirement: every value in the list must have the *same
  command structure*, or the browser gives up and snaps between them. Which is why the paths are
  generated from one function rather than drawn by hand — `blobPath` always emits `M` plus six
  cubics plus `Z`, so any two of its outputs interpolate cleanly.
*/

/** Catmull-Rom → Bézier tension. 1/6 is the value that reproduces the spline exactly. */
const TENSION = 1 / 6

const round = (value: number) => Math.round(value * 100) / 100

/**
 * A closed, smooth blob from one radius per point, in a 100×100 box centred on (50, 50).
 *
 * Radii are in user units, so anything up to 46 stays inside the box. Uniform radii give a
 * circle — the wobble is entirely in how much the radii disagree. Six points is organic; four
 * reads as a rounded diamond.
 */
export function blobPath(radii: number[]): string {
  const points = radii.map((radius, index) => {
    const angle = (index / radii.length) * Math.PI * 2 - Math.PI / 2
    return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius }
  })

  // The modulo keeps every lookup in range; the fallback is only here to satisfy
  // `noUncheckedIndexedAccess`, and a centre point would be visible at once if it ever ran.
  const at = (index: number) => points[(index + points.length) % points.length] ?? { x: 50, y: 50 }

  const first = at(0)
  let path = `M${round(first.x)} ${round(first.y)}`
  for (let index = 0; index < points.length; index++) {
    const previous = at(index - 1)
    const current = at(index)
    const next = at(index + 1)
    const after = at(index + 2)

    const c1x = current.x + (next.x - previous.x) * TENSION
    const c1y = current.y + (next.y - previous.y) * TENSION
    const c2x = next.x - (after.x - current.x) * TENSION
    const c2y = next.y - (after.y - current.y) * TENSION

    path += `C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(next.x)} ${round(next.y)}`
  }
  return `${path}Z`
}

/**
 * The four silhouettes it cycles through, plus a repeat of the first so the loop closes.
 *
 * Deliberately gentle: eight points, all between 39 and 42, so it stays recognisably the round mark
 * rather than becoming an amoeba. Six points was the first attempt and it was visibly wrong — at 60°
 * apart, two neighbours of different radii tilt the tangent enough to leave a corner, and the mark
 * grew a pointed chin. The last entry is the first, because an `<animate>` list that does not return
 * home snaps back at the end of every cycle.
 */
const RESTING = [41, 39, 42, 40, 41, 39, 42, 40]

/** The resting shape, for reduced motion and for anything that wants a still blob. */
export const BLOB_STILL = blobPath(RESTING)

const MORPH = [
  RESTING,
  [39, 42, 40, 41, 39, 42, 40, 41],
  [42, 40, 39, 42, 41, 39, 41, 42],
  [40, 41, 42, 39, 42, 41, 39, 40],
  RESTING,
]
  .map(blobPath)
  .join(';')

export function BlobMascot({
  expression = 'happy',
  size = 132,
  look,
  className = '',
}: {
  expression?: Expression
  size?: number
  look?: { x: number; y: number }
  className?: string
}) {
  const reduced = useReducedMotion()
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '')
  const grad = `blob-${raw}`
  const glow = `glow-${raw}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <MascotGradient id={grad} extent={100} />
        <radialGradient id={glow}>
          <stop stopColor="var(--color-accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The light it sits in. Bleeds past the body, so the blob never looks pasted on. */}
      <circle cx="50" cy="52" r="49" fill={`url(#${glow})`} />

      <path d={BLOB_STILL} fill={`url(#${grad})`}>
        {/*
          Markup, not style — so this is the one animation in the project that has to be switched
          off in React rather than in the stylesheet. `keyTimes` is left implicit: the values are
          evenly spaced, which is exactly what the default does.
        */}
        {!reduced && (
          <animate
            attributeName="d"
            dur="11s"
            repeatCount="indefinite"
            calcMode="spline"
            keyTimes="0;0.25;0.5;0.75;1"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
            values={MORPH}
          />
        )}
      </path>

      {/* The face rides on top at the mark's own scale, so it is the same face as the 22px one. */}
      <g transform="scale(2.5)">
        <MascotFace expression={expression} look={look} blink />
      </g>
    </svg>
  )
}

/**
 * Weather behind the mascot: three blurred lozenges of the palette, drifting.
 *
 * Blurred and low-contrast on purpose. This sits under headings and body copy, and a busy
 * background behind text somebody is reading for the first time is a tax on the one thing the
 * screen is for.
 */
export function BlobBackdrop({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="blob-drift absolute -left-10 -top-14 size-48 rounded-full opacity-30 blur-2xl"
        style={{ background: 'var(--color-sparkle)', '--drift': '0s' } as React.CSSProperties}
      />
      <div
        className="blob-drift absolute -right-14 top-10 size-44 rounded-full opacity-25 blur-2xl"
        style={{ background: 'var(--color-accent)', '--drift': '-4.5s' } as React.CSSProperties}
      />
      <div
        className="blob-drift absolute -left-6 top-40 size-40 rounded-full opacity-20 blur-2xl"
        style={{ background: 'var(--color-sun)', '--drift': '-9s' } as React.CSSProperties}
      />
    </div>
  )
}

/**
 * Eyes that follow the pointer. Returns a `look` to hand to the mascot.
 *
 * The same trick the site plays, and worth the eight lines here for the same reason: a face that
 * tracks you is the difference between an illustration and a character. Off under reduced motion,
 * and centred when the pointer is anywhere near the middle, so it never reads as twitchy.
 */
export function useMascotGaze(ref: RefObject<HTMLElement | null>): { x: number; y: number } {
  const reduced = useReducedMotion()
  const [look, setLook] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (reduced) return

    let frame = 0
    const onMove = (event: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const node = ref.current
        if (!node) return
        const box = node.getBoundingClientRect()
        const cx = box.left + box.width / 2
        const cy = box.top + box.height / 2
        // Saturates over ~220px: the panel is 400px wide, so a longer run would mean the eyes
        // never reach the edge of their travel at all.
        setLook({
          x: Math.max(-1, Math.min(1, (event.clientX - cx) / 220)) * 3,
          y: Math.max(-1, Math.min(1, (event.clientY - cy) / 220)) * 2.5,
        })
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, reduced])

  return look
}
