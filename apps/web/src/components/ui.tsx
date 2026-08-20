import { useReducedMotion } from 'motion/react'
import { useEffect, useId, useState } from 'react'
import { cn } from '@/lib/cn'

/* ── Sparkle icon — the product's mark ───────────────────────────────────── */

export function IconSparkle({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 2 9.3 6.7 14 8 9.3 9.3 8 14 6.7 9.3 2 8 6.7 6.7Z" />
    </svg>
  )
}

export function IconCheck({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  )
}

export function IconParty({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 1.75 9.2 6 13.5 8 9.2 10 8 14.25 6.8 10 2.5 8 6.8 6Z" />
      <path d="M12.75 10.5v2.25M11.6 11.6h2.3" />
      <path d="M3.25 2.25v1.5M2.5 3h1.5" />
    </svg>
  )
}

export { IconCheck as IconCheck2 }

/** The pen. `GLYPH.pen` in the extension — "rewrite this answer". */
export function IconPen({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m2.5 13.5.75-3 8-8 2.25 2.25-8 8z" />
      <path d="m9.75 4.25 2.25 2.25" />
    </svg>
  )
}

/** `GLYPH.close`. */
export function IconClose({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

/* ── Feature icons — one stroked 16px family, no emoji ───────────────────── */

function Glyph({
  className = 'size-4',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export function IconGlobe({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </Glyph>
  )
}

export function IconQuote({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 18V9a3 3 0 0 1 3-3h1" />
      <path d="M4 13h5v5H4zM14 13h5v5h-5z" />
      <path d="M14 18V9a3 3 0 0 1 3-3h1" />
    </Glyph>
  )
}

export function IconMarks({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3.5 8.5 6 11l4.5-4.5" />
      <path d="M14 8.5h6.5" />
      <path d="M17.25 15.5v5M14.75 18h5" />
      <path d="M3.5 18h6.5" />
    </Glyph>
  )
}

export function IconBuilding({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M14 11h4a2 2 0 0 1 2 2v8" />
      <path d="M2.5 21h19" />
      <path d="M7.5 8h3M7.5 12h3M7.5 16h3M17 15h.01M17 18h.01" />
    </Glyph>
  )
}

export function IconLock({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </Glyph>
  )
}

export function IconGift({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3.5 11h17v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20z" />
      <path d="M2.5 7.5h19V11h-19z" />
      <path d="M12 7.5v14" />
      <path d="M12 7.5S10.5 3 8 3a2.25 2.25 0 0 0 0 4.5zM12 7.5S13.5 3 16 3a2.25 2.25 0 0 1 0 4.5z" />
    </Glyph>
  )
}

/* ── The Mascot ───────────────────────────────────────────────────────────
 *
 * The circular face is the brand: one gradient body, two dot eyes, and a mouth
 * that changes with the mood. Same geometry the extension draws, so the site and
 * the product share one mark.
 *
 * Three axes to play with:
 *   expression — the mouth (and sometimes the eyes)
 *   shape      — the body silhouette: circle, squircle, blob, pill
 *   look       — where the eyes point, for gaze that follows the cursor
 */

export type Expression =
  | 'happy'
  | 'think'
  | 'party'
  | 'excited'
  | 'wink'
  | 'wow'
  | 'flat'
  | 'sleepy'

export type MascotShape = 'circle' | 'squircle' | 'blob' | 'pill'

/** The full set, in a stable order — handy for cycling through them. */
export const EXPRESSIONS: Expression[] = [
  'happy',
  'think',
  'party',
  'excited',
  'wink',
  'wow',
  'flat',
  'sleepy',
]

export const MASCOT_SHAPES: MascotShape[] = ['circle', 'squircle', 'blob', 'pill']

function Body({ shape, fill }: { shape: MascotShape; fill: string }) {
  if (shape === 'squircle') {
    return <rect x="1" y="1" width="38" height="38" rx="13" fill={fill} />
  }
  if (shape === 'pill') {
    return <rect x="1" y="4.5" width="38" height="31" rx="15.5" fill={fill} />
  }
  if (shape === 'blob') {
    return (
      <path
        d="M20 1c7.5 0 13.4 2.6 16.4 7.4 3 4.9 2.4 11.6-.7 17C32.5 30.9 27 34.5 19.6 34.5 12.2 34.5 6.4 31.4 3.4 26 .4 20.6.6 13.4 4.2 8.4 7.7 3.5 12.9 1 20 1Z"
        fill={fill}
      />
    )
  }
  return <circle cx="20" cy="20" r="19" fill={fill} />
}

/** The mouth (and any eye overrides) for each mood. */
function Face({ expression }: { expression: Expression }) {
  const stroke = { stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round' as const, fill: 'none' }

  switch (expression) {
    case 'think':
      return (
        <g fill="#fff">
          <circle cx="15" cy="25" r="1.4" />
          <circle cx="20" cy="25" r="1.4" />
          <circle cx="25" cy="25" r="1.4" />
        </g>
      )
    case 'party':
      return <path d="M13.5 24q6.5 5.5 13 0" {...stroke} />
    case 'excited':
      return <path d="M14 23.5a6 6 0 0 0 12 0z" fill="#fff" />
    case 'wow':
      return <circle cx="20" cy="25.5" r="3.2" fill="#fff" />
    case 'flat':
      return <path d="M15.5 25.5h9" {...stroke} />
    default:
      return <path d="M15 25q5 4.5 10 0" {...stroke} />
  }
}

export function Mascot({
  expression = 'happy',
  shape = 'circle',
  size = 52,
  look,
  blink = false,
  className,
}: {
  expression?: Expression
  shape?: MascotShape
  size?: number
  /** Eye offset in viewBox units, roughly -3..3 on each axis. */
  look?: { x: number; y: number }
  /** Idle blink. Skip it for tiny marks, where it just reads as flicker. */
  blink?: boolean
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const grad = `m-${id}`

  // Clamp so the pupils can never wander off the face.
  const lx = look ? Math.max(-3, Math.min(3, look.x)) : 0
  const ly = look ? Math.max(-2.5, Math.min(2.5, look.y)) : 0

  // 'wink' and 'sleepy' replace an eye with a closed lid, so they opt out of the dots.
  const closedRight = expression === 'wink'
  const closedBoth = expression === 'sleepy'

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
        <linearGradient id={grad} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sparkle)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--sun)" />
        </linearGradient>
      </defs>

      <Body shape={shape} fill={`url(#${grad})`} />

      <g
        transform={`translate(${lx} ${ly})`}
        className={blink ? 'mascot-eyes' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        {closedBoth ? (
          <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none">
            <path d="M12.5 16.5q2 2 4 0" />
            <path d="M23.5 16.5q2 2 4 0" />
          </g>
        ) : (
          <>
            <circle cx="14.5" cy="16.5" r="2" fill="#fff" />
            {closedRight ? (
              <path
                d="M23.5 16.8q2 1.8 4 0"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <circle cx="25.5" cy="16.5" r="2" fill="#fff" />
            )}
          </>
        )}
      </g>

      <Face expression={expression} />
    </svg>
  )
}

/**
 * Eyes that track the pointer. Returns a `look` offset to hand to <Mascot>.
 * Idle (and for reduced-motion or touch) it just sits at centre.
 */
export function useMascotGaze(ref: React.RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion()
  const [look, setLook] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (reduce) return
    if (window.matchMedia('(hover: none)').matches) return

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
        // Saturate over ~320px, so the eyes settle before the pointer is far away.
        setLook({
          x: Math.max(-1, Math.min(1, (event.clientX - cx) / 320)) * 3,
          y: Math.max(-1, Math.min(1, (event.clientY - cy) / 320)) * 2.5,
        })
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, reduce])

  return look
}

/**
 * A tiled field of faces, for use as a background texture. Rendered as one
 * <pattern> so a wall of them costs a single draw.
 */
export function MascotPattern({
  className,
  cell = 76,
  opacity = 0.05,
}: {
  className?: string
  cell?: number
  opacity?: number
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')

  return (
    <svg className={className} aria-hidden="true" width="100%" height="100%" opacity={opacity}>
      <defs>
        <pattern
          id={`p-${id}`}
          width={cell * 2}
          height={cell * 2}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          {/* Four faces per tile, each a different mood and silhouette, so the
              texture never reads as an obvious repeat. */}
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx={cell * 0.5} cy={cell * 0.5} r={cell * 0.3} />
            <circle cx={cell * 0.5 - cell * 0.12} cy={cell * 0.42} r="1.6" fill="currentColor" />
            <circle cx={cell * 0.5 + cell * 0.12} cy={cell * 0.42} r="1.6" fill="currentColor" />
            <path
              d={`M${cell * 0.5 - cell * 0.11} ${cell * 0.58}q${cell * 0.11} ${cell * 0.1} ${cell * 0.22} 0`}
            />

            <rect
              x={cell * 1.2}
              y={cell * 0.2}
              width={cell * 0.6}
              height={cell * 0.6}
              rx={cell * 0.21}
            />
            <circle cx={cell * 1.38} cy={cell * 0.42} r="1.6" fill="currentColor" />
            <circle cx={cell * 1.62} cy={cell * 0.42} r="1.6" fill="currentColor" />
            <path d={`M${cell * 1.4} ${cell * 0.6}h${cell * 0.2}`} />

            <circle cx={cell * 1.5} cy={cell * 1.5} r={cell * 0.3} />
            <circle cx={cell * 1.38} cy={cell * 1.42} r="1.6" fill="currentColor" />
            <circle cx={cell * 1.62} cy={cell * 1.42} r="1.6" fill="currentColor" />
            <g fill="currentColor" stroke="none">
              <circle cx={cell * 1.4} cy={cell * 1.6} r="1.3" />
              <circle cx={cell * 1.5} cy={cell * 1.6} r="1.3" />
              <circle cx={cell * 1.6} cy={cell * 1.6} r="1.3" />
            </g>

            <rect
              x={cell * 0.22}
              y={cell * 1.3}
              width={cell * 0.56}
              height={cell * 0.42}
              rx={cell * 0.21}
            />
            <circle cx={cell * 0.38} cy={cell * 1.46} r="1.6" fill="currentColor" />
            <circle cx={cell * 0.62} cy={cell * 1.46} r="1.6" fill="currentColor" />
            <circle cx={cell * 0.5} cy={cell * 1.62} r="2.2" fill="currentColor" stroke="none" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#p-${id})`} />
    </svg>
  )
}

/* ── Button ──────────────────────────────────────────────────────────────── */

const VARIANTS: Record<string, string> = {
  primary: 'text-white shadow-glow hover:brightness-110 active:brightness-95',
  secondary:
    'bg-surface-raised text-ink border border-border hover:border-ink/30 hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'text-danger border border-danger hover:bg-danger-muted',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[filter,background-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
        size === 'sm'
          ? 'px-3 py-1.5 text-[12.5px]'
          : size === 'lg'
            ? 'px-5 py-3 text-[15px]'
            : 'px-4 py-2 text-[13.5px]',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
      style={
        variant === 'primary'
          ? { background: 'linear-gradient(135deg, var(--sparkle), var(--accent))' }
          : undefined
      }
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}

/* ── Card, Chip, GuessedBadge ────────────────────────────────────────────── */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-border-muted bg-surface-raised', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function GuessedBadge({ label = 'guessed' }: { label?: string }) {
  return (
    <Chip className="bg-accent-muted text-accent">
      <IconSparkle className="size-3" />
      {label}
    </Chip>
  )
}

export function ReadBadge() {
  return (
    <Chip className="bg-positive-muted text-positive">
      <IconCheck className="size-3" />
      read
    </Chip>
  )
}
