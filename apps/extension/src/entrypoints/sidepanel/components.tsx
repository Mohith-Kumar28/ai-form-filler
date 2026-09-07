import {
  PLAN_FACT_LIMITS,
  PLAN_LIMITS,
  PLAN_LONGFORM_LIMITS,
  PLAN_SOURCE_LIMITS,
  PLAN_UPLOAD_LIMITS,
} from '@aff/shared'
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { openTrial, openUpgrade } from '../../lib/billing.js'
import { formatCount, formatResetDate, plural } from '../../lib/format.js'
import { IconAlert, IconBack, IconCheck, IconClose, IconMore, IconTrash } from './icons.js'
import { Mascot } from './mascot.js'

export { EXPRESSIONS, type Expression, Mascot, MascotFace, MascotGradient } from './mascot.js'

/*
  The panel's parts.

  Small on purpose. Everything on screen is one of: a screen frame, a titled group of rows, a
  control, or a sheet. Screens compose these and hold no styling of their own beyond spacing.
  Anything drawn here is drawn for a 320px column first; nothing assumes more room.
*/

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ── Screen frame ─────────────────────────────────────────────────────────── */

export function Screen({ children }: { children: ReactNode }) {
  return <div className="relative flex h-full min-h-0 flex-col bg-surface text-ink">{children}</div>
}

/**
 * The top bar. Either a title with an optional Back, or an arbitrary `left`.
 *
 * 44px, no border: the body scrolls under it and the separation is the body's own top spacing.
 * A border here reads as a second frame inside Chrome's.
 */
export function Header({
  title,
  left,
  onBack,
  right,
  children,
}: {
  title?: ReactNode
  left?: ReactNode
  onBack?: () => void
  right?: ReactNode
  /** A second row under the title — a search box, a segmented control. */
  children?: ReactNode
}) {
  return (
    <header className="shrink-0">
      <div className="flex h-11 items-center gap-1 px-2">
        {onBack && (
          <IconButton label="Back" onClick={onBack}>
            <IconBack className="size-4" />
          </IconButton>
        )}
        <div className={cx('min-w-0 flex-1', !onBack && 'pl-2')}>
          {left ?? (
            <h1 className="truncate text-base font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h1>
          )}
        </div>
        {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
      </div>
      {children && <div className="px-gutter pb-2">{children}</div>}
    </header>
  )
}

export const Body = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Body(
  { children, className = '', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('min-h-0 flex-1 overflow-y-auto overflow-x-hidden', className)}
      {...rest}
    >
      {children}
    </div>
  )
})

export function Footer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('shrink-0 border-t border-border-muted bg-surface px-gutter py-2.5', className)}
    >
      {children}
    </div>
  )
}

/* ── Controls ─────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium outline-none transition-[background-color,color,border-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-45'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95',
  secondary:
    'border border-border bg-surface-raised text-ink shadow-[0_1px_2px_var(--color-shadow)] hover:bg-surface-muted active:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'text-danger hover:bg-danger-muted',
  destructive: 'bg-danger text-white hover:brightness-110',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
  lg: 'h-9 px-4 text-sm',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  className = '',
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'size-3.5' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'spin inline-block shrink-0 rounded-full border-[1.5px] border-current border-r-transparent',
        className,
      )}
    />
  )
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string
    size?: 'sm' | 'md'
    tone?: 'default' | 'danger'
  }
>(function IconButton(
  { label, size = 'md', tone = 'default', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40',
        size === 'sm' ? 'size-7' : 'size-8',
        tone === 'danger'
          ? 'text-ink-dim hover:bg-danger-muted hover:text-danger'
          : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-raised px-1 font-sans text-2xs font-medium text-ink-muted">
      {children}
    </kbd>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={cx(CONTROL, className)} {...rest} />
  },
)

const CONTROL =
  'h-control w-full rounded-md border border-border bg-surface-raised px-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-dim hover:border-ink/25 focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-muted)] disabled:opacity-50'

export function Textarea({
  minRows = 3,
  className = '',
  value,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // Re-measured whenever the text changes; `value` is read here so the hook has a real reason to run.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || value === undefined) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={cx(CONTROL, 'h-auto resize-none py-2 leading-relaxed', className)}
      {...rest}
    />
  )
}

/** A labelled control with an optional hint and an error that replaces it. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (ids: { id: string; describedBy?: string }) => ReactNode
}) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children({ id, describedBy: note ? noteId : undefined })}
      {note && (
        <p
          id={noteId}
          className={cx('mt-1.5 text-xs leading-snug', error ? 'text-danger' : 'text-ink-dim')}
        >
          {note}
        </p>
      )}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  description?: string
}) {
  const id = useId()
  return (
    <div className="flex min-h-row items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-snug text-ink-dim">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-5 w-[34px] shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:opacity-50',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_var(--color-shadow-strong)] transition-transform',
            checked && 'translate-x-3.5',
          )}
        />
      </button>
    </div>
  )
}

export interface Segment<T extends string> {
  key: T
  label: string
  icon?: ReactNode
}

export function Segmented<T extends string>({
  segments,
  value,
  onChange,
  label,
}: {
  segments: Segment<T>[]
  value: T
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex h-8 gap-0.5 rounded-md bg-surface-muted p-0.5"
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
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-[5px] text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
              selected
                ? 'bg-surface-raised text-ink shadow-[0_1px_2px_var(--color-shadow)]'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {segment.icon}
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Groups and rows ──────────────────────────────────────────────────────── */

/**
 * A titled block of rows. The panel's unit of layout.
 *
 * The title sits outside the card, small and quiet, with an optional aside on the right
 * (a count, an Add button). The card is one raised surface with hairlines between rows.
 */
export function Group({
  title,
  aside,
  children,
  className = '',
  flush = false,
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** No card — rows sit directly on the surface. For lists that should not look boxed. */
  flush?: boolean
}) {
  return (
    <section className={cx('px-gutter', className)}>
      {(title || aside) && (
        <div className="flex h-7 items-center justify-between gap-2 pl-0.5">
          <h2 className="truncate text-xs font-medium text-ink-muted">{title}</h2>
          {aside && (
            <div className="flex shrink-0 items-center gap-1 text-xs text-ink-dim">{aside}</div>
          )}
        </div>
      )}
      <div
        className={cx(
          flush
            ? 'divide-y divide-border-muted'
            : 'divide-y divide-border-muted overflow-hidden rounded-lg border border-border bg-surface-raised',
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-border bg-surface-raised', className)}>
      {children}
    </div>
  )
}

/**
 * One row. Static, or a button when `onClick` is given.
 *
 * `title` on the left, `value` on the right; `detail` under the title. `trailing` is for a
 * chip or a menu that must stay a separate click target, so it sits outside the button.
 */
export function Row({
  icon,
  title,
  detail,
  value,
  trailing,
  onClick,
  onHover,
  tone = 'default',
  wrap = false,
  className = '',
}: {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  value?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  onHover?: () => void
  tone?: 'default' | 'danger' | 'muted'
  /** Let the title run to two lines instead of truncating. For questions, which are sentences. */
  wrap?: boolean
  className?: string
}) {
  const body = (
    <>
      {icon && (
        <span
          className={cx(
            'flex size-5 shrink-0 items-center justify-center',
            tone === 'danger' ? 'text-danger' : 'text-ink-muted',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block text-sm',
            wrap ? 'line-clamp-2 leading-snug' : 'truncate',
            tone === 'danger' ? 'text-danger' : tone === 'muted' ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {title}
        </span>
        {detail && <span className="mt-0.5 block truncate text-xs text-ink-dim">{detail}</span>}
      </span>
      {value !== undefined && (
        <span className="max-w-[55%] shrink-0 truncate text-right text-sm text-ink-muted">
          {value}
        </span>
      )}
    </>
  )

  const inner = onClick ? (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      className="flex min-h-row w-full min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
    >
      {body}
    </button>
  ) : (
    <div className="flex min-h-row w-full min-w-0 flex-1 items-center gap-2.5 px-3 py-2">
      {body}
    </div>
  )

  return (
    <div className={cx('flex items-center', trailing ? 'pr-1.5' : undefined, className)}>
      {inner}
      {trailing}
    </div>
  )
}

/** A small coloured status word. */
export function Tag({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'neutral' | 'accent' | 'positive' | 'danger' | 'warning'
  children: ReactNode
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-muted text-ink-muted',
    accent: 'bg-accent-muted text-accent',
    positive: 'bg-positive-muted text-positive',
    danger: 'bg-danger-muted text-danger',
    warning: 'bg-warning-muted text-warning',
  }
  return (
    <span
      className={cx(
        'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-2xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** The status glyph beside a ledger row: a filled dot in the row's colour. */
export function Dot({ tone }: { tone: 'accent' | 'positive' | 'dim' | 'danger' | 'warning' }) {
  const tones = {
    accent: 'bg-accent',
    positive: 'bg-positive',
    dim: 'bg-border',
    danger: 'bg-danger',
    warning: 'bg-warning',
  }
  return (
    <span aria-hidden="true" className={cx('block size-1.5 shrink-0 rounded-full', tones[tone])} />
  )
}

/* ── Feedback ─────────────────────────────────────────────────────────────── */

export function Note({
  tone = 'neutral',
  children,
  className = '',
  role,
}: {
  tone?: 'neutral' | 'danger' | 'warning' | 'accent'
  children: ReactNode
  className?: string
  role?: string
}) {
  const tones = {
    neutral: 'bg-surface-muted text-ink-muted',
    danger: 'bg-danger-muted text-danger',
    warning: 'bg-warning-muted text-warning',
    accent: 'bg-accent-muted text-accent',
  }
  return (
    <p
      role={role ?? (tone === 'danger' ? 'alert' : undefined)}
      className={cx(
        'flex items-start gap-1.5 rounded-md px-3 py-2 text-xs leading-snug',
        tones[tone],
        className,
      )}
    >
      {tone === 'danger' && <IconAlert className="mt-px size-3.5 shrink-0" />}
      <span className="min-w-0">{children}</span>
    </p>
  )
}

export function Empty({
  title,
  body,
  action,
  mascot,
}: {
  title: string
  body?: string
  action?: ReactNode
  mascot?: 'happy' | 'think' | 'flat'
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {mascot && <Mascot expression={mascot} size={36} className="mb-3" />}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-[30ch] text-xs leading-relaxed text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = 'h-3 w-2/3' }: { className?: string }) {
  return <span aria-hidden="true" className={cx('awaiting block rounded-sm', className)} />
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="divide-y divide-border-muted"
    >
      {['w-2/3', 'w-1/2', 'w-3/5'].slice(0, count).map((width) => (
        <div key={width} className="flex h-row items-center gap-2.5 px-3">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className={`h-3 ${width}`} />
        </div>
      ))}
    </div>
  )
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** The tiny save indicator in a header: nothing, "Saving", a check, or a retry. */
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
        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-danger hover:bg-danger-muted"
      >
        <IconAlert className="size-3.5" />
        Retry
      </button>
    )
  }
  return (
    <span role="status" className="flex h-7 items-center gap-1 px-2 text-xs text-ink-dim">
      {status === 'saving' ? (
        <Spinner className="size-3" />
      ) : (
        <IconCheck className="size-3.5 text-positive" />
      )}
      {status === 'saving' ? 'Saving' : 'Saved'}
    </span>
  )
}

/* ── Menus ────────────────────────────────────────────────────────────────── */

export interface MenuItem {
  label: string
  onSelect: () => void
  tone?: 'default' | 'danger'
}

/**
 * The row's ⋯ menu, rendered through a portal at the button's position.
 *
 * A portal because every row lives inside a card with `overflow: hidden`, and a menu clipped
 * to its own row is a menu with one visible item.
 */
export function Menu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ top: number; right: number; up: boolean }>({
    top: 0,
    right: 0,
    up: false,
  })

  const place = useCallback(() => {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const height = items.length * 32 + 8
    const up = rect.bottom + height > window.innerHeight - 8
    setAt({
      top: up ? rect.top - height - 4 : rect.bottom + 4,
      right: window.innerWidth - rect.right,
      up,
    })
  }, [items.length])

  useEffect(() => {
    if (!open) return
    place()
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (list.current?.contains(target) || button.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('button')?.focus()
  }, [open])

  return (
    <>
      <IconButton
        ref={button}
        label={label}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconMore className="size-4" />
      </IconButton>
      {open &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            style={{ top: at.top, right: at.right }}
            className="pop-in fixed z-30 min-w-40 rounded-lg border border-border bg-surface-raised p-1 shadow-[0_8px_24px_var(--color-shadow-strong)]"
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
                className={cx(
                  'flex h-8 w-full items-center rounded-md px-2.5 text-left text-sm outline-none focus-visible:bg-surface-muted',
                  item.tone === 'danger'
                    ? 'text-danger hover:bg-danger-muted'
                    : 'text-ink hover:bg-surface-muted',
                )}
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

/* ── Sheets ───────────────────────────────────────────────────────────────── */

/**
 * A bottom sheet over the current screen. Focus is trapped, Escape closes, the scrim closes.
 *
 * `locked` keeps it open while something is in flight: closing a deletion sheet halfway
 * through the request would only hide the outcome.
 */
export function Sheet({
  label,
  onClose,
  children,
  locked = false,
  role = 'dialog',
}: {
  label: string
  onClose: () => void
  children: ReactNode
  locked?: boolean
  role?: 'dialog' | 'alertdialog'
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const focusable = () => [
      ...(node?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ]
    ;(node?.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0])?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (!locked) onClose()
        return
      }
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
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
  }, [onClose, locked])

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          if (!locked) onClose()
        }}
        className="fade-in absolute inset-0 bg-ink/30 dark:bg-black/50"
      />
      <div
        ref={panel}
        {...{ role, 'aria-modal': true, 'aria-label': label }}
        className="sheet-in relative max-h-[88%] overflow-y-auto rounded-t-lg border-t border-border bg-surface-raised px-gutter pt-3 pb-4 shadow-[0_-8px_32px_var(--color-shadow-strong)]"
      >
        {children}
      </div>
    </div>
  )
}

export function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
    </div>
  )
}

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  pending?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Sheet label={title} onClose={onCancel} locked={pending} role="alertdialog">
      <SheetTitle title={title} />
      <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
      {error && (
        <Note tone="danger" className="mt-3">
          {error}
        </Note>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button block onClick={onCancel} disabled={pending} data-autofocus>
          Cancel
        </Button>
        <Button variant="destructive" block onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}

/* ── Money ────────────────────────────────────────────────────────────────── */

/**
 * The meter. Shown only once the person has met the paywall — see `usePaywallSeen`.
 *
 * No denominator on the grant: it never refills, so "of 50" is a fact about the past. A monthly
 * plan keeps the fraction, because there the total is the plan they are paying for. "Auto-fills"
 * on the grant, "form fields" on a paid plan: the latter is the phrase on the checkout page.
 */
export function Meter({
  used,
  limit,
  longUsed,
  longLimit,
  plan,
  resetsAt,
}: {
  used: number
  limit: number
  longUsed: number
  longLimit: number
  plan: string
  resetsAt: string
}) {
  const grant = plan === 'free'
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const left = Math.max(0, limit - used)
  const exhausted = used >= limit
  const warning = pct >= 80 && !exhausted
  const longLeft = Math.max(0, longLimit - longUsed)

  return (
    <div className="px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="tnum text-xl font-semibold leading-none text-ink">
          <span className={exhausted ? 'text-danger' : undefined}>{formatCount(left)}</span>
          {!grant && (
            <span className="text-sm font-normal text-ink-dim"> / {formatCount(limit)}</span>
          )}
        </p>
        {!grant && <p className="text-2xs text-ink-dim">Resets {formatResetDate(resetsAt)}</p>}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {grant
          ? `free auto-${plural(left, 'fill')} left`
          : `form ${plural(limit, 'field')} left this month`}
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={grant ? 'Free auto-fills used' : 'Form fields used this month'}
      >
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-500',
            exhausted ? 'bg-danger' : warning ? 'bg-warning' : 'bg-accent',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {longLimit > 0 && (
        <p className="mt-2.5 text-xs text-ink-dim">
          {longLeft === 0 ? (
            <span className="text-warning">No long answers left. Short fields still work.</span>
          ) : (
            <>
              <span className="tnum font-medium text-ink-muted">
                {grant ? longLeft : `${longLeft} of ${longLimit}`}
              </span>{' '}
              long {plural(longLeft, 'answer')} left
            </>
          )}
        </p>
      )}
    </div>
  )
}

function planRows(plan: 'pro' | 'ultra'): string[] {
  const mb = Math.round(PLAN_UPLOAD_LIMITS[plan] / 1024 / 1024)
  return [
    `${formatCount(PLAN_LIMITS[plan])} form fields a month`,
    `${PLAN_LONGFORM_LIMITS[plan]} long answers and rewrites`,
    `${PLAN_SOURCE_LIMITS[plan]} documents, ${PLAN_FACT_LIMITS[plan]} details`,
    `Files up to ${mb} MB`,
  ]
}

function Plan({
  name,
  price,
  rows,
  highlight = false,
}: {
  name: string
  price: string
  rows: string[]
  highlight?: boolean
}) {
  return (
    <div className={cx('rounded-lg border p-3', highlight ? 'border-accent' : 'border-border')}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">{name}</p>
        <p className="tnum text-xs text-ink-muted">{price}</p>
      </div>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row} className="flex items-start gap-2 text-xs leading-snug text-ink-muted">
            <IconCheck className="mt-0.5 size-3.5 shrink-0 text-positive" />
            {row}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The offer. `trial` for someone who has never paid, `compare` for someone who has. */
export function UpgradeSheet({
  onClose,
  mode = 'trial',
  reason,
}: {
  onClose: () => void
  mode?: 'trial' | 'compare'
  reason?: string
}) {
  const [view, setView] = useState(mode)
  const trial = view === 'trial'
  return (
    <Sheet label={trial ? 'Start your free trial' : 'Compare plans'} onClose={onClose}>
      <SheetTitle
        title={trial ? 'Try Pro free for 14 days' : 'More room to work'}
        subtitle={trial ? 'Then $5 a month. Cancel any time.' : 'Pro is $5 a month, Ultra is $15.'}
      />
      {reason && <p className="mb-3 text-sm leading-relaxed text-ink-muted">{reason}</p>}
      {trial ? (
        <>
          <Plan name="Pro" price="Free for 14 days" rows={planRows('pro')} highlight />
          <p className="mt-2.5 text-xs text-ink-dim">
            Fields answered from your saved details never count.
          </p>
          <button
            type="button"
            onClick={() => setView('compare')}
            className="mt-1.5 h-7 text-xs font-medium text-ink-muted hover:text-ink"
          >
            Compare Pro and Ultra
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <Plan name="Ultra" price="$15 / month" rows={planRows('ultra')} highlight />
          <Plan name="Pro" price="$5 / month" rows={planRows('pro')} />
          {mode === 'trial' && (
            <button
              type="button"
              onClick={() => setView('trial')}
              className="h-7 text-xs font-medium text-ink-muted hover:text-ink"
            >
              Back to the free trial
            </button>
          )}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button block onClick={onClose}>
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
    </Sheet>
  )
}

/* ── Account deletion ─────────────────────────────────────────────────────── */

type DeleteStep = 'warn' | 'detail' | 'confirm'

/**
 * Three steps, each a real gate: read the warning, tick that it is understood, type the email.
 * The server compares the typed email against the account it is about to erase, so the check
 * cannot be skipped by anything that reaches the endpoint another way.
 */
export function DeleteAccountSheet({
  email,
  documentCount,
  hasSubscription,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  email: string
  documentCount: number
  hasSubscription: boolean
  pending?: boolean
  error?: string
  onConfirm: (confirmEmail: string) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<DeleteStep>('warn')
  const [understood, setUnderstood] = useState(false)
  const [typed, setTyped] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase()

  useEffect(() => {
    if (step === 'confirm') input.current?.focus()
  }, [step])

  const title =
    step === 'warn'
      ? 'Delete your account?'
      : step === 'detail'
        ? 'What gets deleted'
        : 'Confirm with your email'

  return (
    <Sheet label={title} onClose={onCancel} locked={pending} role="alertdialog">
      <SheetTitle
        title={title}
        subtitle={`Step ${step === 'warn' ? 1 : step === 'detail' ? 2 : 3} of 3`}
      />

      {step === 'warn' && (
        <div className="space-y-2 text-sm leading-relaxed text-ink-muted">
          <p>
            This deletes <span className="font-medium text-ink">{email}</span> and everything in it.
            It cannot be undone, and nothing can be recovered afterwards.
          </p>
          <p>To stop using Fillaform for a while, signing out leaves everything as it is.</p>
        </div>
      )}

      {step === 'detail' && (
        <>
          <ul className="space-y-2 text-sm leading-snug text-ink-muted">
            {[
              documentCount > 0
                ? `Your ${documentCount} ${plural(documentCount, 'document')} and the original files behind them.`
                : 'Any documents and original files on the account.',
              'Your details, and every answer Fillaform has learned from you.',
              'Your history: which forms were filled, when, and what they cost.',
              hasSubscription
                ? 'Your subscription, cancelled immediately. You will not be charged again.'
                : 'Your billing record. There is no subscription to cancel.',
              'Your sign-in, on this browser and every other device.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <IconTrash className="mt-0.5 size-3.5 shrink-0 text-danger" />
                {line}
              </li>
            ))}
          </ul>
          <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface p-3">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-danger)]"
            />
            <span className="text-sm leading-snug text-ink">I understand this is permanent.</span>
          </label>
        </>
      )}

      {step === 'confirm' && (
        <div>
          <p className="text-sm text-ink-muted">
            Type <span className="font-medium text-ink">{email}</span> to confirm.
          </p>
          <Input
            ref={input}
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
        <Note tone="danger" className="mt-3">
          {error}
        </Note>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {step === 'warn' ? (
          <>
            <Button block onClick={onCancel} data-autofocus>
              Keep my account
            </Button>
            <Button variant="danger" block onClick={() => setStep('detail')}>
              Continue
            </Button>
          </>
        ) : step === 'detail' ? (
          <>
            <Button block onClick={() => setStep('warn')}>
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
            <Button block onClick={() => setStep('detail')} disabled={pending}>
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
    </Sheet>
  )
}

/** The only receipt a deleted account ever gets. Rendered by `App`, which outlives the session. */
export function DeletedFarewell({
  report,
  onDismiss,
}: {
  report: { documents: number; files: number; subscription: 'none' | 'cancelled' | 'pending' }
  onDismiss: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <Mascot size={40} expression="flat" />
      <div>
        <h1 className="text-base font-semibold text-ink">Your account is deleted</h1>
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
          <li>Subscription cancelled. You will not be charged again.</li>
        )}
        {report.subscription === 'pending' && (
          <li>Your subscription is being cancelled. You will not be charged again.</li>
        )}
      </ul>
      <p className="text-xs text-ink-dim">Signing in again starts a new, empty account.</p>
      <Button onClick={onDismiss}>Close</Button>
    </div>
  )
}

/* ── Misc ─────────────────────────────────────────────────────────────────── */

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Close" size="sm" onClick={onClick}>
      <IconClose className="size-4" />
    </IconButton>
  )
}
