import type { Settings as SettingsShape } from '@aff/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sendMessage } from '../../../lib/messaging.js'
import { useShortcut } from '../../../lib/use-shortcut.js'
import { Group, Kbd, Row, Toggle } from '../components.js'
import { IconKeyboard } from '../icons.js'

/*
  What the extension puts on the website you are looking at.

  These three used to live under Settings, two screens away from anything they affect. They are
  not preferences about the panel — they decide whether a button appears on the page in front of
  you and whether focusing a field offers you a saved answer. So they sit at the foot of the
  page screen, where flipping one has a visible consequence in the same glance.
*/

const FALLBACK: SettingsShape = { inlineAutofill: true, showLauncher: true }

export function useOnPageSettings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const result = await sendMessage({ type: 'settings/get' })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return result.value
    },
  })

  const mutation = useMutation({
    mutationFn: async (next: SettingsShape) => {
      const result = await sendMessage({ type: 'settings/set', settings: next })
      if (!result.ok) throw Object.assign(new Error(result.error.message), result.error)
      return next
    },
    onSuccess: (next) => queryClient.setQueryData(['settings'], next),
  })

  const current = query.data ?? FALLBACK
  return {
    current,
    pending: mutation.isPending,
    error: mutation.error?.message,
    toggle: (key: keyof SettingsShape) => mutation.mutate({ ...current, [key]: !current[key] }),
  }
}

/** The three controls, as a titled group. Rendered at the foot of the page screen. */
export function OnThisPage() {
  const shortcut = useShortcut()
  const { current, pending, error, toggle } = useOnPageSettings()

  return (
    <>
      <Group title="On web pages">
        <Toggle
          checked={current.inlineAutofill}
          onChange={() => toggle('inlineAutofill')}
          disabled={pending}
          label="Inline suggestions"
          description="Offer a saved detail when you focus a field it knows."
        />
        <Toggle
          checked={current.showLauncher}
          onChange={() => toggle('showLauncher')}
          disabled={pending}
          label="Floating button"
          description="The fill button on the right edge of pages with a form."
        />
        <Row
          icon={<IconKeyboard className="size-4" />}
          title="Keyboard shortcut"
          detail={shortcut ? 'Fills the form on the page' : 'Not set. Press to choose one.'}
          value={shortcut ? <Kbd>{shortcut}</Kbd> : undefined}
          onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        />
      </Group>
      {error && (
        <p role="alert" className="px-gutter pt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </>
  )
}
