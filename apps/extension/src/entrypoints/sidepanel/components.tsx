import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import {
  IconAlert,
  IconBack,
  IconChevronRight,
  IconDocument,
  IconGear,
  IconMore,
  IconSparkle,
} from './icons.js'
import { type TabName, useNavigation } from './navigation.js'

/* ── The screen leaf ─────────────────────────────────────────────────────── */

/**
 * Every screen is one leaf of the same document.
 *
 * `viewTransitionName: 'screen'` is what lets navigation.tsx animate a push and a pop
 * differently — the name has to be on the element that is actually being replaced, and only
 * one element may carry it at a time, which the stack guarantees.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-surface"
      style={{ viewTransitionName: 'screen' }}
    >
      {children}
    </div>
  )
}

export function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: ReactNode
  right?: ReactNode
  /** Overrides the default pop. Pass nothing on Home, where there is nowhere to go back to. */
  onBack?: () => void
}) {
  const nav = useNavigation()
  const canGoBack = onBack !== undefined || nav.depth > 0

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border-muted px-2.5">
      {canGoBack && (
        <button
          type="button"
          onClick={onBack ?? nav.back}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <IconBack className="size-4" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-[16px] font-bold tracking-[-0.02em] text-ink">
        {title}
      </h1>
      {right}
    </header>
  )
}

/** The scrolling body. Screens that need a fixed footer put it outside this. */
export function ScreenBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`min-h-0 flex-1 overflow-y-auto ${className}`}>{children}</div>
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="shrink-0 border-t border-border-muted bg-surface px-4 py-3">
      {children}
    </footer>
  )
}

/* ── The tab bar ─────────────────────────────────────────────────────────── */

const TABS: { key: TabName; label: string; icon: (props: { className?: string }) => ReactNode }[] =
  [
    { key: 'home', label: 'Fill', icon: IconSparkle },
    { key: 'yourInfo', label: 'My info', icon: IconDocument },
    { key: 'account', label: 'Account', icon: IconGear },
  ]

/**
 * The three roots of the panel. Only shown while a root tab is on top — a pushed screen
 * (filling, review, add, detail) gets the back button instead.
 */
export function TabBar() {
  const nav = useNavigation()

  return (
    <nav className="shrink-0 border-t border-border-muted bg-surface-raised px-2 pb-1 pt-1.5">
      <div className="flex">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = nav.tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => nav.goToTab(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${
                active ? 'text-accent' : 'text-ink-dim hover:text-ink'
              }`}
            >
              <Icon className="size-[18px]" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  // The signature sunset gradient. White text on a violet→pink run, pill, a little glow.
  primary:
    'text-white shadow-[0_2px_12px_-2px_var(--color-shadow-strong)] hover:brightness-110 active:brightness-95',
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
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[filter,background-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
        size === 'sm'
          ? 'px-3 py-1.5 text-[12.5px]'
          : size === 'lg'
            ? 'px-5 py-3 text-[15px]'
            : 'px-4 py-2 text-[13.5px]',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        variant === 'primary'
          ? { background: 'linear-gradient(135deg, var(--color-sparkle), var(--color-accent))' }
          : undefined
      }
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

/** The one moving part allowed in a button — a tiny ring, never a big spinner. */
function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}

/* ── Cards, chips, badges ────────────────────────────────────────────────── */

export function Card({
  children,
  className = '',
  ...rest
}: {
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border-muted bg-surface-raised ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * Marks an answer the AI wrote rather than read off the user's own info.
 *
 * Pink + sparkle — a clear signal this needs a look.
 */
export function AiBadge({ label = 'AI wrote it' }: { label?: string }) {
  return (
    <Chip className="bg-accent-muted text-accent">
      <IconSparkle className="size-3" />
      {label}
    </Chip>
  )
}

/* ── The mascot ──────────────────────────────────────────────────────────── */

type Expression = 'happy' | 'think' | 'party' | 'excited'

export type { Expression }

/**
 * The hype friend: a rounded blob with the sunset gradient and a face.
 *
 * Deliberately tiny and cheap — one SVG, a few mouth/eye variations, no image assets. It
 * shows up where the product talks to you: welcome, filling, empty states, the done moment.
 */
export function Mascot({
  expression = 'happy',
  size = 44,
  className = '',
}: {
  expression?: Expression
  size?: number
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
        <linearGradient id={grad} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-sparkle)" />
          <stop offset="0.55" stopColor="var(--color-accent)" />
          <stop offset="1" stopColor="var(--color-sun)" />
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

/* ── Rows ────────────────────────────────────────────────────────────────── */

export function Row({
  icon,
  title,
  detail,
  value,
  onClick,
  trailing,
  tone = 'default',
}: {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  value?: ReactNode
  onClick?: () => void
  trailing?: ReactNode
  tone?: 'default' | 'danger'
}) {
  const body = (
    <>
      {icon && (
        <span
          className={`mt-px flex size-4 shrink-0 items-center justify-center ${tone === 'danger' ? 'text-danger' : 'text-ink-dim'}`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[14px] ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}
        >
          {title}
        </span>
        {detail && <span className="mt-0.5 block truncate text-[12px] text-ink-dim">{detail}</span>}
      </span>
      {value && <span className="shrink-0 text-[12px] text-ink-dim">{value}</span>}
      {trailing ?? (onClick && <IconChevronRight className="size-4 shrink-0 text-ink-dim" />)}
    </>
  )

  const shared = 'flex w-full items-start gap-2.5 px-4 py-3 text-left'

  if (!onClick) {
    return <div className={shared}>{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shared} transition-colors hover:bg-surface-muted`}
    >
      {body}
    </button>
  )
}

export function RowGroup({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border-muted">{children}</div>
}

/* ── Fields ──────────────────────────────────────────────────────────────── */

const CONTROL =
  'w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-[14px] text-ink placeholder:text-ink-dim transition-colors focus:border-accent disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; describedBy?: string }) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-semibold text-ink-muted">
        {label}
      </label>
      {children({ id, describedBy: describedBy || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-[12px] text-ink-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[12px] text-danger">
          <IconAlert className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...rest} />
}

/** Grows with its content, so a 900-character answer is not read through a four-line window. */
export function AutoTextarea({
  value,
  minRows = 3,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // `value` is the dependency on purpose: the height is a function of the content, and `ref`
  // is stable. Resetting to `auto` first is what lets the box shrink again, not only grow.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measuring, not deriving
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={`${CONTROL} resize-none leading-[1.55] ${className}`}
      {...rest}
    />
  )
}

/* ── States ──────────────────────────────────────────────────────────────── */

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <div className="awaiting size-4 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="awaiting h-3.5 w-2/5 rounded-full" />
        <div className="awaiting mt-1.5 h-3 w-1/4 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonText({ className = '' }: { className?: string }) {
  return <div className={`awaiting rounded-full ${className}`} />
}

/**
 * Nothing here yet — said cheerfully.
 *
 * The mascot (or a sparkle) does the heavy lifting: every empty state says what to do next,
 * not just that there is nothing.
 */
export function EmptyState({
  title,
  body,
  action,
  mascot = 'happy',
}: {
  title: string
  body: ReactNode
  action?: ReactNode
  mascot?: Expression
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-7 py-10 text-center">
      <Mascot expression={mascot} size={52} className="bounce" />
      <h2 className="mt-4 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <div className="mx-auto mt-1.5 max-w-[32ch] text-[13px] leading-relaxed text-ink-muted">
        {body}
      </div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 px-4 py-2.5 text-[12.5px] leading-snug text-danger"
    >
      <IconAlert className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/* ── Overflow menu ───────────────────────────────────────────────────────── */

export interface MenuItem {
  label: string
  onSelect: () => void
  tone?: 'default' | 'danger'
}

export function OverflowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={container} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <IconMore className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="pop absolute right-0 top-full z-10 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-[0_8px_24px_-8px_var(--color-shadow-strong)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-muted ${
                item.tone === 'danger' ? 'text-danger' : 'text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Confirm sheet ───────────────────────────────────────────────────────── */

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string
  body: ReactNode
  confirmLabel: string
  pending?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // Focus the cancel side: the destructive action should never be one Return away.
    panel.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
  }, [onCancel])

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-ink/35"
      />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="pop relative rounded-t-2xl border-t border-border bg-surface-raised px-4 pb-4 pt-4 shadow-[0_-8px_24px_-12px_var(--color-shadow-strong)]"
      >
        <h2 className="font-display text-[16px] font-bold text-ink">{title}</h2>
        <div className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{body}</div>
        {error && (
          <p role="alert" className="mt-2.5 text-[12px] leading-snug text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" block onClick={onCancel} disabled={pending} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" block onClick={onConfirm} loading={pending}>
            {pending ? 'Removing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Segmented control ───────────────────────────────────────────────────── */

export interface Segment<T extends string> {
  key: T
  label: string
  icon?: ReactNode
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
}: {
  segments: Segment<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-full border border-border-muted bg-surface-muted p-1"
    >
      {segments.map((segment) => {
        const selected = segment.key === value
        return (
          <button
            key={segment.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(segment.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              selected ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {segment.icon}
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}
