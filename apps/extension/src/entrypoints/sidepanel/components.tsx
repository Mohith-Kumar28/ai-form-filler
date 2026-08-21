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
  IconList,
  IconMascot,
  IconMore,
  IconSearch,
  IconSparkle,
  IconUser,
} from './icons.js'
import { type TabName, useNavigation } from './navigation.js'

export const SUNSET_GRADIENT = 'linear-gradient(135deg, var(--color-sparkle), var(--color-accent))'
export const SUNSET_GRADIENT_180 =
  'linear-gradient(180deg, var(--color-sparkle), var(--color-accent))'

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
  subtitle,
  right,
  onBack,
  search,
}: {
  title: ReactNode
  /** One line under the title. A measure, never a sales pitch. */
  subtitle?: ReactNode
  right?: ReactNode
  /** Overrides the default pop. Pass nothing on Home, where there is nowhere to go back to. */
  onBack?: () => void
  /**
   * A filter for the screen's own content, rendered on its own row.
   *
   * Its own row rather than beside the title because at 400px a header holding a title, an
   * action and a text field holds none of the three properly.
   */
  search?: ReactNode
}) {
  const nav = useNavigation()
  const canGoBack = onBack !== undefined || nav.depth > 0

  return (
    <header className="shrink-0 border-b border-border-muted">
      <div className="flex items-center gap-2 px-gutter py-3">
        {canGoBack && (
          <button
            type="button"
            onClick={onBack ?? nav.back}
            aria-label="Back"
            className="-ml-2.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <IconBack className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-ink-dim">{subtitle}</p>}
        </div>
        {right}
      </div>
      {/*
        The second row is a fixed height, whatever is in it.

        Facts and Sources are two tabs of one screen, and the control sitting here differs between
        them: Facts has a 40px search field, Sources has a 32px button beside a line of 12px text.
        So switching tabs moved the header — and therefore the entire list under it — by 8px, which
        reads as the screen flinching. A tab switch is the one navigation that promises nothing
        moves except the content, so the row is pinned to `control` height and its contents
        centred, and either tab may hold whatever it needs without the other one paying for it.
      */}
      {search && (
        <div className="px-gutter pb-3">
          {/* The floor sits on the inner box so the 12px of padding above is not eaten by it. */}
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
  /**
   * The scroll container itself, for a screen that has to move it.
   *
   * A multi-step flow needs this: the *content* remounts between steps, so nothing resets the
   * scroll offset, and arriving at a short step from a long one starts you below its heading.
   */
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
    <footer className="shrink-0 border-t border-border-muted bg-surface px-gutter py-3">
      {children}
    </footer>
  )
}

/* ── The tab bar ─────────────────────────────────────────────────────────── */

const TABS: { key: TabName; label: string; icon: (props: { className?: string }) => ReactNode }[] =
  [
    { key: 'home', label: 'Fill', icon: IconMascot },
    { key: 'yourInfo', label: 'My info', icon: IconList },
    { key: 'account', label: 'Account', icon: IconUser },
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
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-2xs font-semibold transition-colors ${
                active ? 'text-accent' : 'text-ink-dim hover:text-ink'
              }`}
            >
              <Icon className="size-5" />
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
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-[filter,background-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
        // Heights come off the density scale rather than out of padding. A 28px button in a
        // docked panel is a near-miss waiting to happen, and this surface gets used one-handed.
        size === 'sm'
          ? 'min-h-8 px-3.5 text-sm'
          : size === 'lg'
            ? 'min-h-12 px-5 text-base'
            : 'min-h-control px-4 text-sm',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={variant === 'primary' ? { background: SUNSET_GRADIENT } : undefined}
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  )
}

/**
 * Marks an answer the AI wrote rather than read off the user's own info.
 *
 * Pink + sparkle — the mark of an answer the tool concluded rather than read.
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
 * Pulled out of `Mascot` because the onboarding draws the same face on a much larger body that
 * morphs while it talks (`onboarding/blob.tsx`), and a second hand-copied set of eyes and mouths
 * is how the brand mark ends up with two slightly different smiles. Anything that wants the face
 * on its own geometry wraps this in a `scale()` transform.
 *
 * `look` moves the eyes, in viewBox units and clamped, so gaze can never wander off the body.
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
 * The sunset gradient, as a paint the mascot's own body can take.
 *
 * A component rather than a copied `<defs>` block: two SVGs declaring the same gradient id in one
 * document is one gradient, and whichever mounted second silently inherits the first one's
 * coordinates. `useId` per instance is what keeps a 22px header mark and a 200px hero from
 * sharing a ramp sized for one of them.
 */
export function MascotGradient({ id, extent = 40 }: { id: string; extent?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={extent} y2={extent} gradientUnits="userSpaceOnUse">
      <stop stopColor="var(--color-sparkle)" />
      <stop offset="0.55" stopColor="var(--color-accent)" />
      <stop offset="1" stopColor="var(--color-sun)" />
    </linearGradient>
  )
}

/**
 * The mascot: a rounded blob with the sunset gradient and a face.
 *
 * Deliberately tiny and cheap — one SVG, a few mouth/eye variations, no image assets. It shows
 * up where the product talks to you: welcome, filling, empty states, the done moment. The face
 * is where the warmth goes, which is what lets the copy around it stay plain.
 */
export function Mascot({
  expression = 'happy',
  size = 44,
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
  /**
   * Pointing at this row, by mouse or by keyboard.
   *
   * On the row's own interactive element rather than a wrapper, so it is reachable by tab as
   * well as by pointer — and so it does not need a `<div>` carrying handlers no keyboard user
   * can ever reach.
   */
  onHover?: () => void
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
          className={`block truncate text-base ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}
        >
          {title}
        </span>
        {detail && <span className="mt-0.5 block truncate text-xs text-ink-dim">{detail}</span>}
      </span>
      {value && <span className="shrink-0 text-xs text-ink-dim">{value}</span>}
      {trailing ?? (onClick && <IconChevronRight className="size-4 shrink-0 text-ink-dim" />)}
    </>
  )

  const shared = 'flex min-h-row w-full items-center gap-3 px-gutter py-2.5 text-left'

  if (!onClick) {
    return <div className={shared}>{body}</div>
  }

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

/*
  Filled, not outlined.

  `surface-raised` on `surface` is 99.3% lightness on 97.2% — a difference nobody can see, so
  every input read as a hairline rectangle drawn on the same flat sheet as everything else. A
  filled control on the lighter ground is the separation, and focus lifts it to raised with an
  accent ring, so "where I am typing" is unmistakable rather than a 1px colour change.
*/
const CONTROL =
  'min-h-control w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2 text-base text-ink placeholder:text-ink-dim transition-[background-color,border-color,box-shadow] hover:border-ink-dim/40 focus:border-accent focus:bg-surface-raised focus:shadow-[0_0_0_3px_var(--color-accent-muted)] focus:outline-none disabled:opacity-50'

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
      <label htmlFor={id} className="text-sm font-semibold text-ink-muted">
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
    <div className="flex items-center gap-2.5 px-gutter py-3">
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
      <h2 className="mt-4 font-display text-lg font-bold tracking-[-0.02em] text-ink">{title}</h2>
      <div className="mx-auto mt-1.5 max-w-[32ch] text-sm leading-relaxed text-ink-muted">
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
      className="flex items-start gap-1.5 px-gutter py-2.5 text-xs leading-snug text-danger"
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

/** Where a portalled menu has been placed, in viewport coordinates. */
interface MenuPosition {
  /** Distance from the top of the viewport to the menu's top edge. */
  top: number
  /** Distance from the *right* of the viewport, so the menu stays flush with its trigger. */
  right: number
}

/** Breathing room kept between the menu and the edge of the panel. */
const MENU_MARGIN = 8

/**
 * The three-dot menu, rendered into `document.body` rather than beside its trigger.
 *
 * It used to be an `absolute` child of the trigger, which is correct in isolation and wrong
 * everywhere this component is actually used. A source card is `overflow-hidden` — it has to be,
 * for the rounded corners to clip the reading shimmer and the failure footer — so the menu was
 * cropped to the card, and on the first row of the list barely one item of it survived. The
 * scrolling `ScreenBody` above it clips the rest.
 *
 * There is no CSS fix for that: a descendant of a clipping box cannot escape it, whatever its
 * `position` or `z-index`. So the menu leaves the tree entirely and is positioned from the
 * trigger's own rectangle, measured at open. That also gets flipping for free — a card near the
 * bottom of the list opens its menu upward instead of off the end of the panel.
 */
export function OverflowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<MenuPosition | null>(null)

  /*
    Measured after layout and before paint, so the menu is never seen at the wrong place.

    Both the trigger and the menu are measured: the menu's own height is what decides whether
    there is room below, and that is only knowable once it is in the document.
  */
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
    /*
      Scrolling the list dismisses the menu.

      A portalled menu is fixed to the viewport, so it would otherwise hang in place while the
      card it belongs to slid away underneath it. Closing is the honest response: re-measuring on
      every scroll frame keeps a popover glued to a moving row, which is worse to use than one
      that simply gets out of the way. `capture` because the scroll happens on `ScreenBody`, not
      on the document.
    */
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
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <IconMore className="size-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            className="pop fixed z-50 min-w-[10.5rem] overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-[0_8px_24px_-8px_var(--color-shadow-strong)]"
            style={
              /*
                Hidden for exactly one frame — the one where it is in the document to be measured
                but has not been told where to go. `visibility` rather than a mount delay so the
                measurement is real.
              */
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
                className={`block min-h-9 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted ${
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
        className="pop relative rounded-t-2xl border-t border-border bg-surface-raised px-gutter pb-4 pt-4 shadow-[0_-8px_24px_-12px_var(--color-shadow-strong)]"
      >
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <div className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</div>
        {error && (
          <p role="alert" className="mt-2.5 text-xs leading-snug text-danger">
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
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
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

/* ── Pro badge ────────────────────────────────────────────────────────────── */

export function ProBadge({ plan }: { plan: string }) {
  if (plan === 'free') return null
  const label = plan === 'ultra' ? 'Ultra' : 'Pro'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold"
      style={{
        background: 'linear-gradient(135deg, var(--color-sparkle), var(--color-accent))',
        color: 'white',
      }}
    >
      <IconCrown className="size-3" />
      {label}
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
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex min-h-row w-full items-center gap-3 px-gutter py-3 text-left transition-colors hover:bg-surface-muted disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-dim">{description}</span>}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={0}
        className={`flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-[background-color] duration-200 ${
          checked ? 'bg-accent' : 'bg-surface-muted border border-border'
        }`}
      >
        <span
          className={`size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

/* ── Usage bar ────────────────────────────────────────────────────────────── */

/**
 * The month's allowance, said once, in one component.
 *
 * There were two of these: this one, imported by nothing, and a private `Quota` inside
 * `Profile.tsx` with byte-identical markup and arithmetic. Two copies of a meter is how a meter
 * ends up disagreeing with itself, so `Profile` now uses this and its copy is gone.
 *
 * The long-answer line is deliberately quiet. It is a cost guardrail rather than a feature, sized
 * so that realistic use never reaches it — showing a second bar to everybody would put a number on
 * screen that means nothing to almost anyone and invite them to budget against it. It appears at
 * 60%, which is late enough to be news and early enough to act on.
 */
export function UsageBar({
  used,
  limit,
  longUsed,
  longLimit,
  plan,
  resetsAt,
  className = '',
}: {
  used: number
  limit: number
  longUsed: number
  longLimit: number
  plan: string
  resetsAt: string
  className?: string
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit
  const warning = pct >= 80 && !exhausted

  const longLeft = Math.max(0, longLimit - longUsed)
  /*
   * The long-answer allowance is always reported, never only once it is nearly gone.
   *
   * It used to appear past 60% used, on the reasoning that it is a cost guardrail rather than a
   * feature and never binds in practice. That reasoning holds right up until the number is sold:
   * the plan is bought on a checkout page that promises "150 long written answers", so an account
   * screen that mentions it only when it is running out is a meter that hides the very figure the
   * purchase was made on. A number you charge for is a number you report.
   */
  const showLong = longLimit > 0

  return (
    <div
      className={`rounded-2xl border border-border-muted bg-surface-raised p-4 ${className}`.trim()}
    >
      <p className="font-display text-xl font-bold tracking-[-0.02em] text-ink">
        <span className={exhausted ? 'text-danger' : ''}>{left}</span>
        <span className="text-ink-dim"> of {limit}</span>
      </p>
      {/*
        "Form fields", not "AI actions".

        An action is our unit of billing, not a thing anybody recognises — it says nothing about
        what it buys, and a person reading "600 AI actions left" cannot tell whether that is one
        job application or fifty. One action is one field answered, so the meter says *fields*: a
        number the user can convert into work they were about to do, in the same word the fill
        screen already uses when it reports "12 fields found" on a page.
      */}
      <p className="mt-0.5 text-sm text-ink-muted">
        form {plural(limit, 'field')} left to fill this month
      </p>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="Form fields filled this month"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            exhausted ? 'bg-danger' : warning ? 'bg-warning' : ''
          }`}
          style={{
            width: `${pct}%`,
            ...(exhausted || warning
              ? {}
              : {
                  background: 'linear-gradient(90deg, var(--color-sparkle), var(--color-accent))',
                }),
          }}
        />
      </div>

      <p className="mt-2 text-xs text-ink-dim">
        {exhausted
          ? `Resets ${formatResetDate(resetsAt)}. Move up a plan to keep going now.`
          : warning
            ? `Almost there. Resets ${formatResetDate(resetsAt)}.`
            : `Resets ${formatResetDate(resetsAt)}`}
      </p>

      {showLong && (
        <p className="mt-2.5 border-t border-border-muted pt-2.5 text-xs leading-snug text-ink-dim">
          {longLeft === 0 ? (
            <span className="text-warning">
              No long answers left. Short answers still work as normal.
            </span>
          ) : (
            <>
              <span className="font-bold tabular-nums text-ink-muted">
                {longLeft} of {longLimit}
              </span>{' '}
              long answers left — essays and rewrites
            </>
          )}
        </p>
      )}

      {plan === 'free' && (
        <Button variant="primary" block className="mt-3.5" onClick={() => void openTrial()}>
          <IconCrown className="size-3.5" />
          Start free trial
        </Button>
      )}
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

function PerkList({ rows, onDark }: { rows: string[]; onDark?: boolean }) {
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => (
        <li key={row} className="flex items-start gap-2.5">
          <span
            className={`mt-px flex size-4 shrink-0 items-center justify-center rounded-full ${
              onDark ? 'bg-white/25 text-white' : 'bg-positive-muted text-positive'
            }`}
          >
            <IconCheck className="size-2.5" />
          </span>
          <span className={`text-sm leading-snug ${onDark ? 'text-white' : 'text-ink-muted'}`}>
            {row}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The one place the product asks for money.
 *
 * Two modes, because the two audiences need different things said. `trial` is for somebody who has
 * just pressed Fill for the first time: they have already uploaded a résumé and typed their facts,
 * so the job is to say what happens next in plain terms — fourteen days, then $5, cancel whenever.
 * `compare` is for somebody already paying who wants more room, and shows Pro against Ultra.
 *
 * The perk list used to be four hardcoded strings, and they were wrong: it promised "Unlimited form
 * fills every month" against a metered plan and quoted a 30 MB upload limit to everyone regardless
 * of plan. It is now derived from the same constants the server enforces, so the sheet cannot
 * promise something the API will refuse.
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

  /**
   * Focus is trapped, which it was not before.
   *
   * A modal that lets Tab walk out into the screen behind it is a modal only for people using a
   * mouse. `ConfirmSheet` already does this; the copy is deliberate rather than shared because
   * pulling out a hook for two call sites would hide the one line that matters — the wrap-around.
   */
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

  const trial = mode === 'trial'

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/35"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={trial ? 'Start your free trial' : 'Compare plans'}
        className="pop relative max-h-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface-raised px-5 pb-5 pt-5 shadow-[0_-8px_24px_-12px_var(--color-shadow-strong)]"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: SUNSET_GRADIENT }}
          >
            <IconCrown className="size-4 text-white" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-ink">
              {trial ? 'Try it free for 14 days' : 'More room to work'}
            </h2>
            <p className="text-xs text-ink-muted">
              {trial ? 'Then $5 a month. Cancel any time.' : 'Pro is $5, Ultra is $15 a month.'}
            </p>
          </div>
        </div>

        {reason && <p className="mt-3 text-sm leading-relaxed text-ink-muted">{reason}</p>}

        {trial ? (
          <>
            <div className="mt-4 rounded-2xl border border-border-muted bg-surface p-3.5">
              <p className="text-sm font-semibold text-ink">Everything in Pro, for 14 days</p>
              <PerkList rows={planRows('pro')} />
            </div>
            <p className="mt-3 text-xs leading-snug text-ink-dim">
              Answers written from your own sources, in your words. Fields it already knows from
              your saved info never count against the total.
            </p>
          </>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div
              className="rounded-2xl border border-transparent p-3.5 text-white"
              style={{ background: SUNSET_GRADIENT }}
            >
              <p className="text-sm font-bold">Ultra · $15 / month</p>
              <PerkList rows={planRows('ultra')} onDark />
            </div>
            <div className="rounded-2xl border border-border-muted bg-surface p-3.5">
              <p className="text-sm font-semibold text-ink">Pro · $5 / month</p>
              <PerkList rows={planRows('pro')} />
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border px-gutter py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => {
              void (trial ? openTrial() : openUpgrade())
              onClose()
            }}
            className="flex-1 rounded-full px-gutter py-2.5 text-sm font-bold text-white transition-[filter] hover:brightness-110 active:brightness-95"
            style={{ background: SUNSET_GRADIENT }}
          >
            {trial ? 'Start free trial' : 'Change plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

/*
 * `LockedFeature` lived here — a row greyed out with a padlock on the end — and nothing ever
 * imported it. The product does not lock rows: it hides money entirely until somebody tries to
 * fill a form, and then asks once, properly, in `UpgradeSheet`. A padlock decorating a feature
 * list is the version of that conversation that persuades nobody.
 */

/* ── Sections ─────────────────────────────────────────────────────────────── */

/**
 * A named, collapsible group of fields.
 *
 * The whole point. The previous editor rendered every field a person has — identity, links and
 * their own typed facts — into one flat scroll of thirty-odd rows under two headings, and the
 * only way to find anything was to read all of it. A section that says `Address · 2 of 6` and
 * stays shut answers "is my address in here?" without opening anything.
 *
 * `<details>`-backed, so keyboard toggling, find-in-page and screen readers all work without
 * being reimplemented. `open` may be driven from outside — search results expand their
 * sections — in which case pass `onToggle` too.
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
    /*
      A card, not a band.

      Six sections divided by hairlines on one flat ground had no separation to speak of — the
      complaint was that everything ran together, and it did. A raised card with air around it
      is the separation, and it costs nothing that a border-bottom was buying.
    */
    <details
      open={open}
      /*
        `shrink-0` is load-bearing. The screen body is a column flex container, so every section
        is a flex item and defaults to `flex-shrink: 1` — six of them in a panel shorter than
        their total height got squeezed to fit, clipping their own titles mid-glyph instead of
        letting the body scroll.
      */
      className="group shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-[0_1px_2px_var(--color-shadow)]"
      // `toggle` rather than a click handler on the summary: it is the one event that fires for
      // a pointer, the keyboard and find-in-page alike.
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary className="flex min-h-row cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate font-display text-base font-bold tracking-[-0.01em] text-ink">
          {title}
        </span>
        {count && count.total > 0 && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-bold tabular-nums ${
              count.filled === 0
                ? 'bg-surface-muted text-ink-dim'
                : 'bg-positive-muted text-positive'
            }`}
          >
            {count.filled}/{count.total}
          </span>
        )}
        <IconChevronDown className="size-4 shrink-0 text-ink-dim transition-transform duration-200 group-open:rotate-180" />
      </summary>

      {/*
        Two-up past `wide`, one-up below it.

        A fact is a short label over a short value, so at 400px one column is right and at 620px
        two columns halve the scroll. `items-start` because a field carrying a hint is taller
        than its neighbour, and stretching both to match would strand an input mid-cell.
      */}
      <div className="grid grid-cols-1 items-start gap-x-4 border-t border-border-muted px-4 pb-4 pt-1 wide:grid-cols-2">
        {children}
      </div>
    </details>
  )
}

/* ── Field rows ───────────────────────────────────────────────────────────── */

/**
 * One editable fact: label above, full-width control below.
 *
 * Label above rather than beside, because the values here run from "M" to a nine-word job
 * title and a two-column row has to pick a width that suits neither.
 *
 * `sensitive` hides the value behind `••••3210` until the eye is pressed. That is about the
 * room, not about storage — a government ID number sitting in plain text in a docked panel is
 * readable by anyone behind the user, on a page they do not control.
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
  const hidden = sensitive && !revealed && value.trim() !== ''

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-muted"
        >
          {label}
        </label>
        {sensitive && value.trim() !== '' && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={revealed}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {revealed ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-danger-muted hover:text-danger"
          >
            <IconClose className="size-3.5" />
          </button>
        )}
      </div>
      <Input
        id={id}
        // `password` rather than a masked string, so the real value is never in the DOM as text
        // and the browser will not offer to autofill our own panel from someone else's form.
        type={hidden ? 'password' : type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Not set'}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        className="mt-1.5"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-snug text-ink-dim">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Adding a fact: a name **and** a value, together, in place.
 *
 * The previous version asked only for a name, then appended an empty row to the bottom of a
 * thirty-row scroll — so the thing you had just made was off-screen, and half-made. A fact is
 * a pair; asking for one half and filing it out of sight is the whole complaint.
 */
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
    <div className="mt-2 rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-col gap-2.5">
        <div>
          <label htmlFor="new-fact-name" className="text-sm font-semibold text-ink-muted">
            Field name
          </label>
          <Input
            id="new-fact-name"
            autoFocus
            value={name}
            placeholder="e.g. T-shirt size"
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Escape' && onCancel()}
            className="mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="new-fact-value" className="text-sm font-semibold text-ink-muted">
            Value
          </label>
          <Input
            id="new-fact-value"
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
            className="mt-1.5"
          />
        </div>
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

/**
 * What happened to the thing you just typed.
 *
 * This replaces the Save button, and the pairing of a Save button in a footer with an Add
 * button in the header — two competing action loci for one screen. Nothing to press means
 * nothing to forget to press; this is the receipt.
 */
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
        className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-danger-muted px-3 text-2xs font-bold text-danger"
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
      className={`flex min-h-8 shrink-0 items-center gap-1.5 px-1 text-2xs font-semibold ${
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

/**
 * A source's state, said once and in colour.
 *
 * It used to be the first clause of a grey metadata line — `Reading… ` or `Could not be read`
 * in the same 12px dim ink as the file size — so the one thing worth knowing about a source
 * looked exactly like the least important.
 */
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold ${tones[tone]}`}
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
  /** Callers sharing a row with an action pass `flex-1 min-w-0` so the action reaches the edge. */
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-dim" />
      <input
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-control w-full rounded-full border border-border-muted bg-surface-muted pl-9 pr-9 text-sm text-ink placeholder:text-ink-dim transition-colors focus:border-accent focus:bg-surface-raised"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <IconClose className="size-3.5" />
        </button>
      )}
    </div>
  )
}
