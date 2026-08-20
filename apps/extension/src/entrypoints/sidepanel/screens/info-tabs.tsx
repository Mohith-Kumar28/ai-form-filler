import { useNavigation } from '../navigation.js'

const TABS = [
  { key: 'facts' as const, label: 'Facts' },
  { key: 'sources' as const, label: 'Sources' },
] as const

/**
 * The two halves of "Your info": what it knows, and what it read that from.
 *
 * The selected tab is **inverted** — ink ground, surface text — and that is the whole point of
 * this component. It was `surface-raised` on `surface-muted`, which is 19.5% lightness on 12% in
 * dark and 99.3% on 93.5% in light: a difference of a few percent, on a control whose only job
 * is to tell you which of two screens you are looking at. Inverting it is the largest contrast
 * step the palette has, it reads instantly in both schemes, and it deliberately does *not* use
 * the accent, which belongs to "the tool guessed this" and to the one primary action per screen.
 */
export function InfoTabs({ view }: { view: 'facts' | 'sources' }) {
  const nav = useNavigation()

  return (
    <div
      role="tablist"
      aria-label="What to show"
      className="flex shrink-0 gap-1 rounded-full border border-border bg-surface-muted p-1"
    >
      {TABS.map((tab) => {
        const selected = tab.key === view
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => nav.replace({ name: 'yourInfo', view: tab.key })}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
              selected
                ? 'bg-ink text-surface shadow-[0_1px_3px_var(--color-shadow-strong)]'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
