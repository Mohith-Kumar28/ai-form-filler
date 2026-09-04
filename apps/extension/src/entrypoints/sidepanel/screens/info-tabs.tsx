import { Tabs } from '../components.js'
import { useNavigation } from '../navigation.js'

const TABS = [
  { key: 'facts' as const, label: 'Facts' },
  { key: 'sources' as const, label: 'Sources' },
]

/** The two halves of the profile: what it knows, and what it read that from. */
export function InfoTabs({ view }: { view: 'facts' | 'sources' }) {
  const nav = useNavigation()

  return (
    <Tabs
      tabs={TABS}
      value={view}
      onChange={(next) => nav.replace({ name: 'yourInfo', view: next })}
      label="What to show"
    />
  )
}
