import { useId } from 'react'

/**
 * The mascot: a round body with the brand gradient and a face. One SVG, no image assets.
 *
 * The face is the brand — it is the logo, the favicon and the on-page marks — so its geometry
 * lives here and nowhere else. The body's gradient is the only gradient in the product.
 */

export type Expression = 'happy' | 'think' | 'party' | 'excited' | 'wink' | 'wow' | 'flat'

export const EXPRESSIONS: Expression[] = [
  'happy',
  'think',
  'party',
  'excited',
  'wink',
  'wow',
  'flat',
]

/** The face on its own, in the mark's 40-unit space. `look` moves the eyes, clamped to the body. */
export function MascotFace({
  expression = 'happy',
  look,
  blink = false,
}: {
  expression?: Expression
  look?: { x: number; y: number }
  blink?: boolean
}) {
  const stroke = { stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round' as const, fill: 'none' }
  const lx = look ? Math.max(-3, Math.min(3, look.x)) : 0
  const ly = look ? Math.max(-2.5, Math.min(2.5, look.y)) : 0

  return (
    <>
      <g
        transform={`translate(${lx} ${ly})`}
        className={blink ? 'mascot-eyes' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        <circle cx="14.5" cy="16.5" r="2" fill="#fff" />
        {expression === 'wink' ? (
          <path d="M23.5 16.8q2 1.8 4 0" {...stroke} strokeWidth={1.8} />
        ) : (
          <circle cx="25.5" cy="16.5" r="2" fill="#fff" />
        )}
      </g>

      {expression === 'think' ? (
        <g fill="#fff">
          <circle cx="15" cy="25" r="1.4" />
          <circle cx="20" cy="25" r="1.4" />
          <circle cx="25" cy="25" r="1.4" />
        </g>
      ) : expression === 'party' ? (
        <path d="M13.5 24q6.5 5.5 13 0" {...stroke} />
      ) : expression === 'excited' ? (
        <path d="M14 23.5a6 6 0 0 0 12 0z" fill="#fff" />
      ) : expression === 'wow' ? (
        <circle cx="20" cy="25.5" r="3.2" fill="#fff" />
      ) : expression === 'flat' ? (
        <path d="M15.5 25.5h9" {...stroke} />
      ) : (
        <path d="M15 25q5 4.5 10 0" {...stroke} />
      )}
    </>
  )
}

/**
 * The body paint. A component rather than a copied `<defs>` block: two SVGs declaring the same
 * gradient id in one document is one gradient, and whichever mounted second inherits the first
 * one's coordinates. A `useId` per instance keeps an 18px header mark and a 120px hero apart.
 */
export function MascotGradient({ id, extent = 40 }: { id: string; extent?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={extent} y2={extent} gradientUnits="userSpaceOnUse">
      <stop stopColor="var(--color-sparkle)" />
      <stop offset="1" stopColor="var(--color-sun)" />
    </linearGradient>
  )
}

export function Mascot({
  expression = 'happy',
  size = 40,
  look,
  blink = false,
  className = '',
}: {
  expression?: Expression
  size?: number
  look?: { x: number; y: number }
  blink?: boolean
  className?: string
}) {
  const id = useId()
  const grad = `mascot-${id.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <MascotGradient id={grad} />
      </defs>
      <circle cx="20" cy="20" r="19" fill={`url(#${grad})`} />
      <MascotFace expression={expression} look={look} blink={blink} />
    </svg>
  )
}
