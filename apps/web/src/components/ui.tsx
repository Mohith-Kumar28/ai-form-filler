import { useId } from 'react'
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

/* ── The Mascot — a hype friend blob with sunset gradient ────────────────── */

export type Expression = 'happy' | 'think' | 'party' | 'excited'

export function Mascot({
  expression = 'happy',
  size = 52,
  className,
}: {
  expression?: Expression
  size?: number
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const grad = `m-${id}`

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
      <circle cx="20" cy="20" r="19" fill={`url(#${grad})`} />
      <g fill="#fff">
        <circle cx="14.5" cy="16.5" r="2" />
        <circle cx="25.5" cy="16.5" r="2" />
      </g>
      {expression === 'happy' && (
        <path
          d="M15 25q5 4.5 10 0"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {expression === 'think' && (
        <g fill="#fff">
          <circle cx="15" cy="25" r="1.4" />
          <circle cx="20" cy="25" r="1.4" />
          <circle cx="25" cy="25" r="1.4" />
        </g>
      )}
      {expression === 'party' && (
        <path
          d="M13.5 24q6.5 5.5 13 0"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {expression === 'excited' && <path d="M14 23.5a6 6 0 0 0 12 0z" fill="#fff" />}
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
