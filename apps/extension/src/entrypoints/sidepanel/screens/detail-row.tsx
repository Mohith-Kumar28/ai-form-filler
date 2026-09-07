import { useState } from 'react'
import { type CatalogField, maskValue } from '../../../lib/fact-catalog.js'
import { Input, Menu } from '../components.js'
import { IconEye, IconEyeOff } from '../icons.js'

export interface DetailEntry {
  id: string
  label: string
  value: string
  field?: CatalogField
  onChange: (value: string) => void
}

/**
 * One detail: the label, and the value as an input that only looks like one when it has focus.
 *
 * Every row is editable in place — there is no edit mode. Sensitive values are masked until
 * revealed, because a docked panel is readable by anyone behind the person.
 *
 * The label column is a percentage so the rows line up, but capped: at a comfortable panel
 * width a fixed 36% spent 180px on the word "Email" while the address beside it truncated.
 */
export function DetailRow({
  entry,
  autoFocus = false,
  onCommit,
  onRename,
  onRemove,
}: {
  entry: DetailEntry
  autoFocus?: boolean
  onCommit: () => void
  /** Present only on a detail the person named themselves — the catalogue owns the rest. */
  onRename?: () => void
  onRemove?: () => void
}) {
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const sensitive = entry.field?.sensitive === true
  const masked = sensitive && !revealed && !focused && entry.value !== ''

  return (
    <div className="flex min-h-row items-center gap-2 pr-1.5 pl-3">
      <label
        htmlFor={`detail-${entry.id}`}
        className="w-[38%] max-w-[148px] shrink-0 truncate text-xs text-ink-muted"
        title={entry.label}
      >
        {entry.label}
      </label>
      <Input
        id={`detail-${entry.id}`}
        autoFocus={autoFocus}
        type={masked || entry.field?.type === 'date' ? 'text' : (entry.field?.type ?? 'text')}
        value={masked ? maskValue(entry.value) : entry.value}
        placeholder={entry.field?.placeholder ?? 'Add'}
        readOnly={masked}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onCommit()
        }}
        onChange={(event) => entry.onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="h-7 min-w-0 flex-1 overflow-hidden text-ellipsis border-transparent bg-transparent px-1.5 shadow-none hover:border-border focus:bg-surface-raised"
      />
      {sensitive && entry.value !== '' && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide' : 'Reveal'}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-dim hover:text-ink"
        >
          {revealed ? <IconEyeOff className="size-3.5" /> : <IconEye className="size-3.5" />}
        </button>
      )}
      {(onRename || onRemove) && (
        <Menu
          label={`Options for ${entry.label}`}
          items={[
            ...(onRename ? [{ label: 'Rename', onSelect: onRename }] : []),
            ...(onRemove ? [{ label: 'Remove', onSelect: onRemove, tone: 'danger' as const }] : []),
          ]}
        />
      )}
    </div>
  )
}
