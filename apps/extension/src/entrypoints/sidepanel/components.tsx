import {
  PLAN_FACT_LIMITS,
  PLAN_LIMITS,
  PLAN_LONGFORM_LIMITS,
  PLAN_SOURCE_LIMITS,
  PLAN_UPLOAD_LIMITS,
} from '@aff/shared'
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { openTrial, openUpgrade } from '../../lib/billing.js'
import { formatCount, formatResetDate, plural } from '../../lib/format.js'
import {
  IconAlert,
  IconBack,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconCrown,
  IconEye,
  IconEyeOff,
  IconGear,
  IconList,
  IconMascot,
  IconMore,
  IconSearch,
  IconSparkle,
  IconTrash,
} from './icons.js'
import { type TabName, useNavigation } from './navigation.js'

/*
  The primitives every screen is built from.

  v3 rules, in one place so the screens do not have to repeat them:

    - One accent. `bg-accent` is a primary action or a "judged" mark, and nothing else.
    - No gradient anywhere but the mascot's body.
    - Three radii: `rounded-sm` chips and key caps, `rounded-md` controls, `rounded-lg` containers.
    - Type: 13px body, 12px meta, 11px labels, 15–18px headings. `tnum` on anything counted.
    - Dark separates with hairlines; shadows are for things that float.
*/

/* ── The screen leaf ─────────────────────────────────────────────────────── */

/**
 * Every screen is one leaf of the same document.
 *
 * `viewTransitionName: 'screen'` is what lets navigation.tsx animate a push and a pop
 * differently — the name has to be on the element being replaced, and only one element may
 * carry it at a time, which the stack guarantees.
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
  subtitle,
  right,
  onBack,
  tabs,
  search,
}: {
  title: ReactNode
  /** One line under the title. A measure, never a pitch. */
  subtitle?: ReactNode
  right?: ReactNode
  /** Overrides the default pop. Pass nothing on a root tab, where there is nowhere to go back to. */
  onBack?: () => void
  /** A row of underline tabs under the title, full width. */
  tabs?: ReactNode
  /**
   * A filter or action row for the screen's own content, on its own line.
   *
   * Its own line rather than beside the title because at 400px a header holding a title, an
   * action and a text field holds none of the three properly. Pinned to `control` height so
   * switching between two screens that share a header does not move the list under it.
   */
  search?: ReactNode
}) {
  const nav = useNavigation()
  const canGoBack = onBack !== undefined || nav.depth > 0

  return (
    <header className="shrink-0 border-b border-border-muted bg-surface">
      <div className="flex h-11 items-center gap-1 px-gutter">
        {canGoBack && (
          <IconButton label="Back" onClick={onBack ?? nav.back} className="-ml-1.5">
            <IconBack className="size-4" />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-[15px] leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-2xs text-ink-dim">{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
      </div>
      {tabs && <div className="px-gutter">{tabs}</div>}
      {search && (
        <div className="px-gutter pb-2.5 pt-0.5">
          <div className="flex min-h-control items-center">
            <div className="min-w-0 flex-1">{search}</div>
          </div>
        </div>
      )}
    </header>
  )
}

/** The scrolling body. Screens that need a fixed footer put it outside this. */
export function ScreenBody({
  children,
  className = '',
  ref,
  ...rest
}: {
  children: ReactNode
  className?: string
  /** The scroll container itself, for a screen that has to move it (a multi-step flow). */
  ref?: React.Ref<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div ref={ref} className={`min-h-0 flex-1 overflow-y-auto ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="shrink-0 border-t border-border-muted bg-surface px-gutter py-2.5">
      {children}
    </footer>
  )
}

/* ── Underline tabs ──────────────────────────────────────────────────────── */

export interface Tab<T extends string> {
  key: T
  label: string
}

/**
 * Two or three views of one screen, as underline tabs in the header.
 *
 * The selected tab is `ink` with a 2px accent rule under it. It sits directly on the header's
 * own hairline so the rule reads as part of the frame rather than a badge floating in it.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Tab<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="-mb-px flex gap-4">
      {tabs.map((tab) => {
        const selected = tab.key === value
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`relative -mb-px h-8 border-b-2 text-xs font-medium transition-colors ${
              selected ? 'border-accent text-ink' : 'border-transparent text-ink-dim hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── The tab bar ─────────────────────────────────────────────────────────── */

const TABS: { key: TabName; label: string; icon: (props: { className?: string }) => ReactNode }[] =
  [
    { key: 'home', label: 'Fill', icon: IconMascot },
    { key: 'yourInfo', label: 'Profile', icon: IconList },
    { key: 'account', label: 'Settings', icon: IconGear },
  ]

/**
 * The three roots of the panel. Only shown while a root tab is on top — a pushed screen
 * (filling, receipt, add, detail) gets the back button instead.
 */
export function TabBar() {
  const nav = useNavigation()

  return (
    <nav className="shrink-0 border-t border-border-muted bg-surface px-2 py-1.5">
      <div className="flex gap-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = nav.tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => nav.goToTab(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-2xs font-medium transition-colors ${
                active ? 'bg-surface-muted text-ink' : 'text-ink-dim hover:text-ink'
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

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95',
  secondary:
    'border border-border bg-surface-raised text-ink shadow-[0_1px_2px_var(--color-shadow)] hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'text-danger hover:bg-danger-muted',
  /* The solid red one, for the last button of a destructive flow. */
  destructive: 'bg-danger text-white hover:brightness-110 active:brightness-95',
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
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[filter,background-color,color] duration-100 disabled:pointer-events-none disabled:opacity-45',
        size === 'sm'
          ? 'h-7 px-2.5 text-xs'
          : size === 'lg'
            ? 'h-9 px-4 text-sm'
            : 'h-8 px-3 text-sm',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

/** The one moving part allowed in a button — a thin ring, never a big spinner. */
export function Spinner({ className = 'size-3.5' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`}
    />
  )
}

/** A square ghost button around one glyph. `label` is its accessible name and its tooltip. */
export function IconButton({
  label,
  size = 'md',
  tone = 'default',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  size?: 'sm' | 'md'
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        'flex shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40',
        size === 'sm' ? 'size-6' : 'size-7',
        tone === 'danger'
          ? 'text-ink-dim hover:bg-danger-muted hover:text-danger'
          : 'text-ink-dim hover:bg-surface-muted hover:text-ink',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A key cap. `⌥F`, `Enter`, `Esc`. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-muted px-1 font-sans text-2xs font-medium text-ink-muted">
      {children}
    </kbd>
  )
}

/* ── Containers ──────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = '',
  ...rest
}: {
  children: ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-lg border border-border bg-surface-raised ${className}`} {...rest}>
      {children}
    </div>
  )
}

/** A card whose children are rows, divided by hairlines and clipped to the corners. */
export function ListCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-surface-raised divide-y divide-border-muted ${className}`}
    >
      {children}
    </div>
  )
}

/** The small caps heading over a group of rows. */
export function SectionLabel({
  children,
  action,
}: {
  children: ReactNode
  /** Something small on the right, level with the label. */
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-gutter pb-1.5 pt-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-ink-dim">{children}</p>
      {action}
    </div>
  )
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ${className}`}
    >
      {children}
    </span>
  )
}

/** Marks an answer the AI wrote rather than read off the user's own info. */
export function AiBadge({ label = 'AI wrote it' }: { label?: string }) {
  return (
    <Chip className="bg-accent-muted text-accent">
      <IconSparkle className="size-3" />
      {label}
    </Chip>
  )
}

/** A number and what it counts, for a strip of them. */
export function Stat({
  value,
  label,
  tone = 'default',
}: {
  value: ReactNode
  label: string
  tone?: 'default' | 'accent' | 'positive' | 'dim'
}) {
  const colour =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'positive'
        ? 'text-positive'
        : tone === 'dim'
          ? 'text-ink-dim'
          : 'text-ink'
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2">
      <p className={`tnum text-lg font-semibold leading-tight ${colour}`}>{value}</p>
      <p className="mt-0.5 truncate text-2xs text-ink-dim">{label}</p>
    </div>
  )
}

/* ── The mascot ──────────────────────────────────────────────────────────── */

type Expression = 'happy' | 'think' | 'party' | 'excited' | 'wink' | 'wow' | 'flat'

export type { Expression }

export const EXPRESSIONS: Expression[] = [
  'happy',
  'think',
  'party',
  'excited',
  'wink',
  'wow',
  'flat',
]

/**
 * The face, on its own, in the mark's own 40-unit space.
 *
 * Shared with the onboarding blob, which draws the same face on a larger morphing body; one
 * set of eyes and mouths is how the brand mark keeps one smile. `look` moves the eyes, clamped
 * so gaze can never wander off the body.
 */
export function MascotFace({
  expression = 'happy',
  look,
  blink = false,
}: {
  expression?: Expression
  look?: { x: number; y: number }
  /** The idle blink. Skipped on tiny marks, where it reads as flicker rather than life. */
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
 * The mascot's body paint — the only gradient in the product.
 *
 * A component rather than a copied `<defs>` block: two SVGs declaring the same gradient id in
 * one document is one gradient, and whichever mounted second silently inherits the first one's
 * coordinates. `useId` per instance keeps a 18px header mark and a 120px hero apart.
 */
export function MascotGradient({ id, extent = 40 }: { id: string; extent?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={extent} y2={extent} gradientUnits="userSpaceOnUse">
      <stop stopColor="var(--color-sparkle)" />
      <stop offset="1" stopColor="var(--color-sun)" />
    </linearGradient>
  )
}

/** The mascot: a round body with the brand gradient and a face. One SVG, no image assets. */
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

/* ── Rows ────────────────────────────────────────────────────────────────── */

export function Row({
  icon,
  title,
  detail,
  value,
  onClick,
  onHover,
  trailing,
  tone = 'default',
}: {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  value?: ReactNode
  onClick?: () => void
  /** Pointing at this row, by mouse or by keyboard. On the row's own interactive element. */
  onHover?: () => void
  trailing?: ReactNode
  tone?: 'default' | 'danger'
}) {
  const body = (
    <>
      {icon && (
        <span
          className={`flex size-4 shrink-0 items-center justify-center ${tone === 'danger' ? 'text-danger' : 'text-ink-dim'}`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}
        >
          {title}
        </span>
        {detail && <span className="block truncate text-xs text-ink-dim">{detail}</span>}
      </span>
      {value && <span className="shrink-0 text-xs text-ink-dim">{value}</span>}
      {trailing ?? (onClick && <IconChevronRight className="size-4 shrink-0 text-ink-dim" />)}
    </>
  )

  const shared = 'flex min-h-row w-full items-center gap-2.5 px-3 py-2 text-left'

  if (!onClick) return <div className={shared}>{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      {...(onHover ? { onMouseEnter: onHover, onFocus: onHover } : {})}
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
  'h-control w-full rounded-md border border-border bg-surface-raised px-2.5 text-sm text-ink placeholder:text-ink-dim transition-[border-color,box-shadow] hover:border-ink/25 focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-muted)] focus:outline-none disabled:opacity-50'

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
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children({ id, describedBy: describedBy || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs text-danger">
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

  // `value` is the dependency on purpose: the height is a function of the content.
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
      className={`${CONTROL} h-auto resize-none py-2 leading-[1.5] ${className}`}
      {...rest}
    />
  )
}

/* ── States ──────────────────────────────────────────────────────────────── */

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 px-gutter py-2.5">
      <div className="awaiting size-4 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1">
        <div className="awaiting h-3 w-2/5 rounded-sm" />
        <div className="awaiting mt-1.5 h-2.5 w-1/4 rounded-sm" />
      </div>
    </div>
  )
}

export function SkeletonText({ className = '' }: { className?: string }) {
  return <div className={`awaiting rounded-sm ${className}`} />
}

/** Nothing here yet, and what to do about it. Quiet: a still mark, one line, one action. */
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
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <Mascot expression={mascot} size={40} />
      <h2 className="display mt-3 text-base text-ink">{title}</h2>
      <div className="mx-auto mt-1 max-w-[30ch] text-sm text-ink-muted">{body}</div>
      {action && <div className="mt-4 flex w-full justify-center">{action}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 rounded-md bg-danger-muted px-3 py-2 text-xs leading-snug text-danger"
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

interface MenuPosition {
  top: number
  right: number
}

const MENU_MARGIN = 8

/**
 * The three-dot menu, rendered into `document.body` rather than beside its trigger.
 *
 * A descendant of a clipping box (a card with rounded corners, the scrolling body) cannot
 * escape it whatever its `position`, so the menu leaves the tree and is placed from the
 * trigger's own rectangle at open — which also gets flipping for free near the bottom.
 */
export function OverflowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<MenuPosition | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const anchor = trigger.getBoundingClientRect()
    const height = menu.offsetHeight
    const below = anchor.bottom + 4
    const flip = below + height + MENU_MARGIN > window.innerHeight

    setPosition({
      top: flip ? Math.max(MENU_MARGIN, anchor.top - 4 - height) : below,
      right: Math.max(MENU_MARGIN, window.innerWidth - anchor.right),
    })
  }, [open])

  useEffect(() => {
    if (!open) return

    const close = () => {
      setOpen(false)
      triggerRef.current?.focus()
    }

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    // Scrolling dismisses: a fixed menu hanging over a row that slid away is worse than none.
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setPosition(null)
          setOpen((v) => !v)
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <IconMore className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            className="pop fixed z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-[0_8px_24px_-8px_var(--color-shadow-strong)]"
            style={
              position
                ? { top: position.top, right: position.right }
                : { top: 0, right: 0, visibility: 'hidden' }
            }
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
                className={`block h-8 w-full rounded-md px-2.5 text-left text-sm transition-colors hover:bg-surface-muted ${
                  item.tone === 'danger' ? 'text-danger' : 'text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

/* ── Sheets ──────────────────────────────────────────────────────────────── */

/** The bottom sheet's shell: a scrim, and a raised panel rising from the bottom edge. */
const SHEET_PANEL =
  'pop relative max-h-full overflow-y-auto rounded-t-lg border-t border-border bg-surface-raised px-gutter pb-4 pt-4 shadow-[0_-8px_24px_-12px_var(--color-shadow-strong)]'

function Scrim({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      onClick={onClick}
      className="absolute inset-0 cursor-default bg-ink/30"
    />
  )
}

function SheetHeading({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode
  title: string
  subtitle?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="min-w-0">
        <h2 className="display text-base break-words text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-dim">{subtitle}</p>}
      </div>
    </div>
  )
}

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
      <Scrim onClick={onCancel} label="Cancel" />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={SHEET_PANEL}
      >
        <SheetHeading title={title} />
        <div className="mt-1.5 text-sm text-ink-muted">{body}</div>
        {error && (
          <p role="alert" className="mt-2.5 text-xs leading-snug text-danger">
            {error}
          </p>
        )}
        {/* A grid, not a flex row: `block` buttons in a flex row each demand the full width. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" block onClick={onCancel} disabled={pending} data-autofocus>
            Cancel
          </Button>
          <Button variant="destructive" block onClick={onConfirm} loading={pending}>
            {pending ? 'Removing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete account ──────────────────────────────────────────────────────── */

/**
 * The three gates in front of deleting an account, and why there are three of them.
 *
 * Every other destructive action is one `ConfirmSheet` away, which is the right weight for
 * removing a source: the user can add it back. This one cannot be undone by anybody, so the
 * friction is the feature. Each step asks for something different, which is what stops it
 * being the same question three times: do you mean this; do you know what it includes (a box to
 * tick); type your own email.
 */
type DeleteStep = 'warn' | 'detail' | 'confirm'

export function DeleteAccountSheet({
  email,
  sourceCount,
  hasSubscription,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  email: string
  sourceCount: number
  hasSubscription: boolean
  pending?: boolean
  error?: string
  onConfirm: (confirmEmail: string) => void
  onCancel: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<DeleteStep>('warn')
  const [understood, setUnderstood] = useState(false)
  const [typed, setTyped] = useState('')

  /** The same comparison the server makes, and it has to stay that way. */
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase()

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null

    const onKey = (event: KeyboardEvent) => {
      // Escape closes, but not mid-request: the request cannot be recalled by then.
      if (event.key === 'Escape' && !pending) {
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])',
      )
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
  }, [onCancel, pending])

  /** Focus moves to the *safe* control on every step, or the field on the last one. */
  useEffect(() => {
    const node = panel.current
    if (!node) return
    const target =
      step === 'confirm'
        ? node.querySelector<HTMLElement>('input')
        : node.querySelector<HTMLElement>('[data-autofocus]')
    target?.focus()
  }, [step])

  const title =
    step === 'warn'
      ? 'Delete your account?'
      : step === 'detail'
        ? 'What gets deleted'
        : 'Confirm with your email'

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <Scrim
        onClick={() => {
          if (!pending) onCancel()
        }}
        label="Cancel"
      />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={SHEET_PANEL}
      >
        <SheetHeading
          icon={
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-danger-muted">
              <IconAlert className="size-4 text-danger" />
            </span>
          }
          title={title}
          subtitle={`Step ${step === 'warn' ? 1 : step === 'detail' ? 2 : 3} of 3`}
        />

        {step === 'warn' && (
          <div className="mt-3 space-y-2 text-sm text-ink-muted">
            <p>
              This deletes <span className="font-medium text-ink">{email}</span> and everything in
              it, everywhere. It cannot be undone, and we cannot get any of it back for you.
            </p>
            <p>
              If you only want to stop using Fillaform for a while, signing out leaves everything
              exactly as it is.
            </p>
          </div>
        )}

        {step === 'detail' && (
          <>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <DeleteItem>
                {sourceCount > 0
                  ? `Your ${plural(sourceCount, 'source')} and the original files behind them — résumés, recordings, links, everything uploaded.`
                  : 'Any sources and original files on the account.'}
              </DeleteItem>
              <DeleteItem>
                Your profile, your facts, and every answer Fillaform has learned from you.
              </DeleteItem>
              <DeleteItem>
                Your history: which forms were filled, when, and what they cost.
              </DeleteItem>
              <DeleteItem>
                {hasSubscription
                  ? 'Your subscription, cancelled immediately. You will not be charged again.'
                  : 'Your billing record. There is no active subscription to cancel.'}
              </DeleteItem>
              <DeleteItem>
                Your sign-in, on this browser and every other device you are signed in on.
              </DeleteItem>
            </ul>

            <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface p-3">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-danger)]"
              />
              <span className="text-sm leading-snug text-ink">
                I understand this is permanent and cannot be undone.
              </span>
            </label>
          </>
        )}

        {step === 'confirm' && (
          <div className="mt-3">
            <p className="text-sm text-ink-muted">
              Type <span className="font-medium text-ink">{email}</span> to confirm.
            </p>
            <Input
              type="email"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={pending}
              placeholder={email}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Your email address"
              className="mt-2.5"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-2.5 text-xs leading-snug text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {step === 'warn' ? (
            <>
              <Button variant="secondary" block onClick={onCancel} data-autofocus>
                Keep my account
              </Button>
              <Button variant="danger" block onClick={() => setStep('detail')}>
                Continue
              </Button>
            </>
          ) : step === 'detail' ? (
            <>
              <Button variant="secondary" block onClick={() => setStep('warn')} data-autofocus>
                Back
              </Button>
              <Button
                variant="danger"
                block
                disabled={!understood}
                onClick={() => setStep('confirm')}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                block
                onClick={() => setStep('detail')}
                disabled={pending}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                block
                disabled={!matches}
                loading={pending}
                onClick={() => onConfirm(typed)}
              >
                {pending ? 'Deleting…' : 'Delete everything'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DeleteItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <IconTrash className="mt-0.5 size-3.5 shrink-0 text-danger" />
      <span>{children}</span>
    </li>
  )
}

/**
 * The receipt, shown once the account is gone.
 *
 * Rendered above the signed-in gate: by the time it has anything to say the session is over and
 * the whole signed-in tree has been replaced by the welcome screen. It states counts because they
 * are the only evidence the user will ever be able to get.
 */
export function DeletedFarewell({
  report,
  onDismiss,
}: {
  report: { documents: number; files: number; subscription: 'none' | 'cancelled' | 'pending' }
  onDismiss: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <Mascot size={44} expression="flat" />
      <div>
        <h1 className="display text-lg text-ink">Your account is deleted</h1>
        <p className="mt-1 text-sm text-ink-muted">Nothing of yours is left on our servers.</p>
      </div>

      <ul className="w-full space-y-1 rounded-lg border border-border bg-surface-raised p-3 text-left text-sm text-ink-muted">
        <li>
          {report.documents} stored {plural(report.documents, 'document')} deleted
        </li>
        <li>
          {report.files} uploaded {plural(report.files, 'file')} deleted
        </li>
        {report.subscription === 'cancelled' && (
          <li>Subscription cancelled — you will not be charged again</li>
        )}
        {report.subscription === 'pending' && (
          <li>Your subscription is being cancelled — you will not be charged again</li>
        )}
      </ul>

      <p className="text-xs text-ink-dim">
        You are welcome back any time. Signing in again starts a new, empty account.
      </p>

      <Button variant="secondary" onClick={onDismiss}>
        Close
      </Button>
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
      className="flex gap-0.5 rounded-md border border-border-muted bg-surface-muted p-0.5"
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
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-2 text-xs font-medium transition-colors ${
              selected
                ? 'bg-surface-raised text-ink shadow-[0_1px_2px_var(--color-shadow)]'
                : 'text-ink-muted hover:text-ink'
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

/* ── Pro badge ────────────────────────────────────────────────────────────── */

export function ProBadge({ plan }: { plan: string }) {
  if (plan === 'free') return null
  return (
    <span className="inline-flex h-5 items-center rounded-sm bg-accent-muted px-1.5 text-2xs font-semibold text-accent">
      {plan === 'ultra' ? 'Ultra' : 'Pro'}
    </span>
  )
}

/* ── Toggle switch ─────────────────────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-muted disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-dim">{description}</span>}
      </span>
      <span
        aria-hidden
        className={`flex h-5 w-[34px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 ${
          checked ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-transform duration-150 ${
            checked ? 'translate-x-[14px]' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

/* ── Usage bar ────────────────────────────────────────────────────────────── */

/**
 * The allowance, said once, in one component.
 *
 * The long-answer line is always reported: essays are the expensive, difficult work and the
 * reason to use this over a browser's own autofill, so the count is the headline feature's
 * meter rather than fine print.
 */
export function UsageBar({
  used,
  limit,
  longUsed,
  longLimit,
  plan,
  resetsAt,
  footer,
  className = '',
}: {
  used: number
  limit: number
  longUsed: number
  longLimit: number
  plan: string
  resetsAt: string
  /** Something to do about the number above. A slot: the meter reports, the caller offers. */
  footer?: ReactNode
  className?: string
}) {
  /** A free plan is the one-time grant. Derived once so three lines cannot disagree. */
  const isGrant = plan === 'free'
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit
  const warning = pct >= 80 && !exhausted

  const longLeft = Math.max(0, longLimit - longUsed)
  const showLong = longLimit > 0 && !(longLeft === 0 && exhausted)

  return (
    <div className={`rounded-lg border border-border bg-surface-raised p-3.5 ${className}`.trim()}>
      {/*
        No denominator on the grant: it never refills, so "of 50" is a fact about the past. A
        monthly plan keeps the fraction, because there the total is the plan they are paying for.
      */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="tnum text-2xl font-semibold leading-none text-ink">
          <span className={exhausted ? 'text-danger' : ''}>{left}</span>
          {!isGrant && <span className="text-base font-normal text-ink-dim"> / {limit}</span>}
        </p>
        {!isGrant && !exhausted && (
          <p className="text-2xs text-ink-dim">Resets {formatResetDate(resetsAt)}</p>
        )}
      </div>
      {/*
        "Auto-fills" on the grant, "form fields" on a paid plan. Not an oversight: "600 form
        fields a month" is the phrase on the checkout page and in the terms, so a paid meter that
        renamed the unit would disagree with the contract. See the notes in git history.
      */}
      <p className="mt-1 text-xs text-ink-muted">
        {isGrant
          ? `free auto-${plural(left, 'fill')} left`
          : `form ${plural(limit, 'field')} left this month`}
      </p>

      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={isGrant ? 'Free auto-fills used' : 'Auto-fills used this month'}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            exhausted ? 'bg-danger' : warning ? 'bg-warning' : 'bg-accent'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {(exhausted || (!isGrant && warning)) && (
        <p className="mt-2 text-xs text-ink-dim">
          {isGrant
            ? 'Your free auto-fills are used up. Start your trial to keep going.'
            : exhausted
              ? `Resets ${formatResetDate(resetsAt)}. Move up a plan to keep going now.`
              : `Almost there. Resets ${formatResetDate(resetsAt)}.`}
        </p>
      )}

      {showLong && (
        <p className="mt-2.5 border-t border-border-muted pt-2.5 text-xs text-ink-dim">
          {longLeft === 0 ? (
            <span className="text-warning">No long answers left. Everything else still works.</span>
          ) : (
            <>
              <span className="tnum font-semibold text-ink-muted">
                {isGrant ? longLeft : `${longLeft} of ${longLimit}`}
              </span>{' '}
              long {plural(longLeft, 'answer')} left
            </>
          )}
        </p>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  )
}

/* ── Upgrade sheet ────────────────────────────────────────────────────────── */

/** What a plan gets you, derived from the constants so the sheet cannot drift from the server. */
function planRows(plan: 'pro' | 'ultra'): string[] {
  const mb = Math.round(PLAN_UPLOAD_LIMITS[plan] / 1024 / 1024)
  return [
    `${formatCount(PLAN_LIMITS[plan])} form fields a month`,
    `${PLAN_LONGFORM_LIMITS[plan]} long answers and rewrites`,
    `${PLAN_SOURCE_LIMITS[plan]} sources, ${PLAN_FACT_LIMITS[plan]} facts`,
    `Files up to ${mb} MB`,
  ]
}

function PerkList({ rows }: { rows: string[] }) {
  return (
    <ul className="mt-2.5 space-y-1.5">
      {rows.map((row) => (
        <li key={row} className="flex items-start gap-2">
          <IconCheck className="mt-0.5 size-3.5 shrink-0 text-positive" />
          <span className="text-xs leading-snug text-ink-muted">{row}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The one place the product asks for money.
 *
 * Two views in one sheet. `trial` is for somebody who has just pressed Fill for the first time:
 * fourteen days, then $5, cancel whenever. `compare` shows Pro against Ultra. The perk lists are
 * derived from the same constants the server enforces.
 */
export function UpgradeSheet({
  onClose,
  mode = 'trial',
  reason,
}: {
  onClose: () => void
  mode?: 'trial' | 'compare'
  reason?: string
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    const node = panel.current
    if (!node) return
    const focusable = () => [
      ...node.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
    ]
    focusable()[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    node.addEventListener('keydown', onKey)
    return () => node.removeEventListener('keydown', onKey)
  }, [])

  const [view, setView] = useState<'trial' | 'compare'>(mode)
  const trial = view === 'trial'

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <Scrim onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={trial ? 'Start your free trial' : 'Compare plans'}
        className={SHEET_PANEL}
      >
        <SheetHeading
          icon={
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-muted">
              <IconCrown className="size-4 text-accent" />
            </span>
          }
          title={trial ? 'Try Pro free for 14 days' : 'More room to work'}
          subtitle={
            trial ? 'Then $5 a month. Cancel any time.' : 'Pro is $5, Ultra is $15 a month.'
          }
        />

        {reason && <p className="mt-3 text-sm text-ink-muted">{reason}</p>}

        {trial ? (
          <>
            <div className="mt-3.5 rounded-lg border border-border bg-surface p-3">
              <p className="text-sm font-medium text-ink">Everything in Pro</p>
              <PerkList rows={planRows('pro')} />
            </div>
            <p className="mt-2.5 text-xs text-ink-dim">
              Fields it already knows from your saved info never count against the total.
            </p>
            <button
              type="button"
              onClick={() => setView('compare')}
              className="mt-2 w-full rounded-md py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Compare Pro and Ultra
            </button>
          </>
        ) : (
          <div className="mt-3.5 space-y-2">
            <div className="rounded-lg border border-accent bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Ultra</p>
                <p className="tnum text-xs text-ink-muted">$15 / month</p>
              </div>
              <PerkList rows={planRows('ultra')} />
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Pro</p>
                <p className="tnum text-xs text-ink-muted">$5 / month</p>
              </div>
              <PerkList rows={planRows('pro')} />
            </div>
            {mode === 'trial' && (
              <button
                type="button"
                onClick={() => setView('trial')}
                className="w-full rounded-md py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Back to the free trial
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" block onClick={onClose}>
            Not now
          </Button>
          <Button
            variant="primary"
            block
            onClick={() => {
              void (trial ? openTrial() : openUpgrade())
              onClose()
            }}
          >
            {trial ? 'Start free trial' : 'Change plan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Sections ─────────────────────────────────────────────────────────────── */

/**
 * A named, collapsible group of fields.
 *
 * `<details>`-backed, so keyboard toggling, find-in-page and screen readers all work without
 * being reimplemented. `open` may be driven from outside — search results expand their sections.
 */
export function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  /** `n of m` filled. Omit where "filled" means nothing. */
  count?: { filled: number; total: number }
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details
      open={open}
      // `shrink-0` is load-bearing: the body is a column flex container, and a section that
      // shrinks clips its own title instead of letting the body scroll.
      className="group shrink-0 overflow-hidden rounded-lg border border-border bg-surface-raised"
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-3 transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</span>
        {count && count.total > 0 && (
          <span
            className={`tnum shrink-0 text-2xs ${
              count.filled === 0 ? 'text-ink-dim' : 'text-ink-muted'
            }`}
          >
            {count.filled} of {count.total}
          </span>
        )}
        <IconChevronDown className="size-4 shrink-0 text-ink-dim transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="divide-y divide-border-muted border-t border-border-muted">{children}</div>
    </details>
  )
}

/* ── Field rows ───────────────────────────────────────────────────────────── */

/**
 * One editable fact, as a row: label on the left, value on the right, editable in place.
 *
 * The previous shape — a label above a bordered input — spent 70px on every fact, so a
 * profile of forty was six screens of scrolling and the map of what is stored was the thing you
 * had to scroll to find. A row is 36px, reads as a table of what the tool knows, and becomes an
 * input only when pointed at.
 *
 * `sensitive` hides the value behind dots until the eye is pressed: a government ID number in
 * plain text in a docked panel is readable by anyone behind the user.
 */
export function FieldRow({
  label,
  hint,
  value,
  type = 'text',
  placeholder,
  sensitive = false,
  autoFocus = false,
  onChange,
  onCommit,
  onRemove,
}: {
  label: string
  hint?: string
  value: string
  type?: string
  placeholder?: string
  sensitive?: boolean
  autoFocus?: boolean
  onChange: (next: string) => void
  /** Blur, or Enter. Where a screen that saves on settle hooks in. */
  onCommit?: () => void
  onRemove?: () => void
}) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const [focused, setFocused] = useState(false)
  const hidden = sensitive && !revealed && value.trim() !== ''

  return (
    <div className="px-1.5 py-0.5">
      <div className="grid min-h-9 grid-cols-[100px_1fr] items-center gap-1">
        <label htmlFor={id} title={label} className="truncate pl-1.5 text-xs text-ink-muted">
          {label}
        </label>
        <div className="flex min-w-0 items-center gap-0.5">
          <input
            id={id}
            // `password` rather than a masked string, so the real value is never in the DOM as
            // text and the browser will not offer to autofill our own panel.
            type={hidden ? 'password' : type}
            value={value}
            autoFocus={autoFocus}
            placeholder={placeholder ?? 'Not set'}
            aria-describedby={hint ? `${id}-hint` : undefined}
            onChange={(event) => onChange(event.currentTarget.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              onCommit?.()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            className="h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-ink placeholder:text-ink-dim transition-[background-color,border-color,box-shadow] hover:bg-surface-muted focus:border-accent focus:bg-surface-raised focus:shadow-[0_0_0_3px_var(--color-accent-muted)] focus:outline-none"
          />
          {sensitive && value.trim() !== '' && (
            <IconButton
              size="sm"
              label={revealed ? `Hide ${label}` : `Show ${label}`}
              aria-pressed={revealed}
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? <IconEyeOff className="size-3.5" /> : <IconEye className="size-3.5" />}
            </IconButton>
          )}
          {onRemove && (
            <IconButton size="sm" tone="danger" label={`Remove ${label}`} onClick={onRemove}>
              <IconClose className="size-3" />
            </IconButton>
          )}
        </div>
      </div>
      {/* The hint only while the row is being edited; forty hints at once is a wall. */}
      {hint && focused && (
        <p id={`${id}-hint`} className="pb-1.5 pl-[108px] pr-2 text-2xs text-ink-dim">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Adding a fact: a name and a value, together, in place. */
export function AddFactForm({
  onAdd,
  onCancel,
  /** Returns a message when the name is not usable — a duplicate, or already a known field. */
  validate,
}: {
  onAdd: (name: string, value: string) => void
  onCancel: () => void
  validate?: (name: string) => string | null
}) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const problem = name.trim() ? (validate?.(name.trim()) ?? null) : null
  const ready = name.trim() !== '' && value.trim() !== '' && problem === null

  const commit = () => {
    if (!ready) return
    onAdd(name.trim(), value.trim())
    setName('')
    setValue('')
  }

  return (
    <div className="rounded-lg border border-accent bg-surface-raised p-3">
      <div className="flex flex-col gap-2.5">
        <Field label="Field name">
          {({ id }) => (
            <Input
              id={id}
              autoFocus
              value={name}
              placeholder="e.g. T-shirt size"
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => event.key === 'Escape' && onCancel()}
            />
          )}
        </Field>
        <Field label="Value">
          {({ id }) => (
            <Input
              id={id}
              value={value}
              placeholder="e.g. Medium"
              onChange={(event) => setValue(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commit()
                }
                if (event.key === 'Escape') onCancel()
              }}
            />
          )}
        </Field>
      </div>

      {problem && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-1.5 text-xs leading-snug text-warning"
        >
          <IconAlert className="mt-px size-3.5 shrink-0" />
          <span>{problem}</span>
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={commit} disabled={!ready}>
          Add fact
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/* ── Save state ───────────────────────────────────────────────────────────── */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** What happened to the thing you just typed. There is no Save button; this is the receipt. */
export function SaveState({
  status,
  error,
  onRetry,
}: {
  status: SaveStatus
  error?: string
  onRetry?: () => void
}) {
  if (status === 'idle') return null

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={error}
        className="flex h-6 shrink-0 items-center gap-1 rounded-sm bg-danger-muted px-2 text-2xs font-medium text-danger"
      >
        <IconAlert className="size-3" />
        Not saved · Retry
      </button>
    )
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={`flex h-6 shrink-0 items-center gap-1 px-1 text-2xs font-medium ${
        status === 'saved' ? 'animate-fade-in text-positive' : 'text-ink-dim'
      }`}
    >
      {status === 'saving' ? (
        <>
          <span className="pulse-dot size-1.5 rounded-full bg-ink-dim" />
          Saving
        </>
      ) : (
        <>
          <IconCheck className="size-3" />
          Saved
        </>
      )}
    </span>
  )
}

/* ── Status pill ──────────────────────────────────────────────────────────── */

/** A source's state, said once and in colour. Ready is the absence of a pill. */
export function StatusPill({
  tone,
  children,
}: {
  tone: 'busy' | 'ready' | 'bad'
  children: ReactNode
}) {
  const tones = {
    busy: 'bg-surface-muted text-ink-muted',
    ready: 'bg-positive-muted text-positive',
    bad: 'bg-danger-muted text-danger',
  }
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-2xs font-medium ${tones[tone]}`}
    >
      {tone === 'busy' && <span className="pulse-dot size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ── Search ───────────────────────────────────────────────────────────────── */

/** Filters the screen it sits in. The reason forty fields fit in a 400px panel. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
  className = '',
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  label: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-dim" />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={`${CONTROL} pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <IconButton
          size="sm"
          label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2"
        >
          <IconClose className="size-3" />
        </IconButton>
      )}
    </div>
  )
}
