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
import { guillocheDataUri } from '../../lib/tokens.js'
import { IconAlert, IconBack, IconChevronRight, IconMore } from './icons.js'
import { useNavigation } from './navigation.js'

/* ── The document leaf ───────────────────────────────────────────────────── */

/**
 * Every screen is one leaf of the same document.
 *
 * `viewTransitionName: 'screen'` is what lets navigation.tsx animate a push and a pop
 * differently — the name has to be on the element that is actually being replaced, and only
 * one element may carry it at a time, which the stack guarantees.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-stock" style={{ viewTransitionName: 'screen' }}>
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
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-guilloche bg-leaf pl-1 pr-2">
      {canGoBack && (
        <button
          type="button"
          onClick={onBack ?? nav.back}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-doc text-ink2 transition-colors hover:bg-guilloche-soft hover:text-ink"
        >
          <IconBack className="size-4" />
        </button>
      )}
      <h1
        className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-[-0.01em] text-ink ${
          canGoBack ? '' : 'pl-3'
        }`}
      >
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
    <footer className="shrink-0 border-t border-guilloche bg-leaf px-4 py-3">{children}</footer>
  )
}

/* ── Struck controls ─────────────────────────────────────────────────────── */

type Variant = 'plate' | 'struck' | 'quiet' | 'danger'

/**
 * A disabled plate stops being a plate.
 *
 * Fading a solid ink field to 40% still leaves the heaviest block on the screen — in dark it
 * reads as a light bar demanding to be pressed, which is the opposite of unavailable. An
 * unavailable action is drawn as an empty frame instead: the shape is still there, the ink
 * has not been laid down yet.
 */
const DISABLED_PLATE =
  'disabled:bg-transparent disabled:text-ink3 disabled:border-guilloche disabled:active:translate-y-0'

const VARIANTS: Record<Variant, string> = {
  /*
    Utilities, not the `.plate` class.

    `.plate` is plain CSS outside any `@layer`, which puts it *after* Tailwind's utilities in
    the cascade — so `disabled:bg-transparent` lost to it and every disabled primary rendered
    as a fully struck plate. A button offering an action that cannot be taken is worse than no
    button, and this one looked identical to the live control beside it.
  */
  /*
    The keyline is what makes this a plate rather than a button.

    A struck panel on a printed document carries a hairline rule set in from its own edge —
    the plate's border and the impression's border are two different lines. Without it this
    was a filled rectangle indistinguishable from every secondary control in the build, which
    is exactly what the direction contract promised it would not be.
  */
  plate: `relative bg-ink text-stock border border-ink hover:opacity-90 active:translate-y-px ${DISABLED_PLATE} before:pointer-events-none before:absolute before:inset-[3px] before:border before:border-stock/30 before:content-[''] disabled:before:border-transparent`,
  struck: `border border-ink text-ink hover:bg-ink/8 active:translate-y-px ${DISABLED_PLATE}`,
  quiet:
    'border border-transparent text-ink2 hover:bg-guilloche-soft hover:text-ink disabled:text-ink3',
  // Faults and destruction, in the caution ink — never the endorsement stamp's vermilion,
  // which means one thing only: this answer was concluded rather than read.
  danger: `border border-alert text-alert hover:bg-alert-wash active:translate-y-px ${DISABLED_PLATE}`,
}

export function Button({
  variant = 'struck',
  size = 'md',
  block = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md'
  block?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-1.5 rounded-doc font-medium transition-[opacity,background-color,transform] duration-150',
        size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-2 text-[13px]',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ── Register rows ───────────────────────────────────────────────────────── */

/**
 * A ruled row that pushes a screen.
 *
 * Cards are refused throughout: a credential's contents are a ruled register, and boxing each
 * entry would put a container around content that is already delimited by the rule above it.
 */
export function Row({
  icon,
  title,
  detail,
  value,
  onClick,
  trailing,
  tone = 'default',
  index,
}: {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  value?: ReactNode
  onClick?: () => void
  /** Replaces the disclosure chevron — an overflow menu, say. */
  trailing?: ReactNode
  tone?: 'default' | 'danger'
  /** Staggers the settle animation. Capped by the caller at 8 or the list flickers. */
  index?: number
}) {
  const body = (
    <>
      {icon && (
        <span
          className={`mt-px flex size-4 shrink-0 items-center justify-center ${
            tone === 'danger' ? 'text-alert' : 'text-ink3'
          }`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">{title}</span>
        {detail && <span className="mt-0.5 block truncate text-[11.5px] text-ink3">{detail}</span>}
      </span>
      {value && <span className="mrz shrink-0 text-[11.5px] text-ink3">{value}</span>}
      {trailing ?? (onClick && <IconChevronRight className="size-4 shrink-0 text-ink3" />)}
    </>
  )

  const shared = 'flex w-full items-start gap-2.5 px-4 py-3 text-left'
  const style = index === undefined ? undefined : ({ '--i': index } as React.CSSProperties)

  if (!onClick) {
    return (
      <div className={`${shared} ${index === undefined ? '' : 'settle'}`} style={style}>
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shared} transition-colors hover:bg-guilloche-soft ${
        index === undefined ? '' : 'settle'
      }`}
      style={style}
    >
      {body}
    </button>
  )
}

export function RowGroup({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-guilloche-soft border-y border-guilloche">{children}</div>
}

/* ── Fields ──────────────────────────────────────────────────────────────── */

const CONTROL =
  'w-full rounded-doc border border-guilloche bg-leaf px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink3 transition-colors focus:border-query disabled:opacity-50'

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
      {/* Labels sit above the control, never inside it: a placeholder that vanishes on focus
          takes the question away exactly when the person is answering it. */}
      <label htmlFor={id} className="doc-label">
        {label}
      </label>
      {children({ id, describedBy: describedBy || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-[11.5px] text-ink3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[11.5px] text-alert">
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

/** Unissued stock: the shape of the row that is coming, not a spinner in its place. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <div className="awaiting size-4 shrink-0 rounded-doc" />
      <div className="min-w-0 flex-1">
        <div className="awaiting h-3 w-2/5 rounded-doc" />
        <div className="awaiting mt-1.5 h-2.5 w-1/4 rounded-doc" />
      </div>
    </div>
  )
}

/**
 * A blank document leaf.
 *
 * This is the one place the guilloche covers area rather than marking an edge, and it is
 * earned: an unissued credential is exactly a sheet with the security ground printed and
 * nothing filled in yet. Every empty state here says what to do, not that there is nothing.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-7 py-10 text-center">
      {/*
        Density is carried by the token, not by an opacity multiplier: `guilloche` already sits
        a fixed distance from `stock` in both schemes, so the ground reads at the same weight
        in each. Fading it further made it invisible in dark while it was still legible in light.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          // Full strength, and legibility comes from the mask below rather than from fading
          // the ink. Halving the opacity here quietly cancelled a raise to the `engine` token
          // and left the dark ground pixel-identical to the build it was meant to fix.
          backgroundImage: guillocheDataUri('currentColor'),
          backgroundRepeat: 'repeat',
          color: 'var(--color-engine)',
          /*
            Cleared where the message sits, not concentrated there. Centring the ground behind
            its own copy put an engraved field directly under the one paragraph this screen
            exists to have read — a decorative ground that costs legibility has stopped being
            structure, whatever world it belongs to.
          */
          maskImage: 'radial-gradient(circle at 50% 45%, transparent 34%, black 76%)',
        }}
      />
      <div className="relative">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <div className="mx-auto mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-ink2">
          {body}
        </div>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 px-4 py-2.5 text-[12px] leading-snug text-alert"
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
        className="flex size-7 items-center justify-center rounded-doc text-ink3 transition-colors hover:bg-guilloche-soft hover:text-ink"
      >
        <IconMore className="size-4" />
      </button>
      {open && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
        <div
          role="menu"
          className="strike absolute right-0 top-full z-10 mt-1 min-w-[9.5rem] overflow-hidden rounded-doc border border-guilloche bg-leaf shadow-[0_6px_20px_-6px_var(--color-shadow-far),0_1px_2px_var(--color-shadow-near)]"
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
              className={`block w-full px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-guilloche-soft ${
                item.tone === 'danger' ? 'text-alert' : 'text-ink'
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

/**
 * Interruption is earned here and nowhere else.
 *
 * Deleting a source removes the stored original and everything the tool remembers from it, on
 * a server, permanently. The previous build fired that mutation straight from a `Remove`
 * button sitting in the row.
 */
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
        className="strike relative border-t border-guilloche bg-leaf px-4 pb-4 pt-3.5"
      >
        <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>
        <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{body}</div>
        {error && (
          <p role="alert" className="mt-2.5 text-[12px] leading-snug text-alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="quiet" block onClick={onCancel} disabled={pending} data-autofocus>
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
