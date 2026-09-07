import { useQuery } from '@tanstack/react-query'
import { sendMessage } from './messaging.js'

/**
 * The fill shortcut as the user's browser has it bound, or `null` when it is unbound.
 *
 * Asked for rather than hardcoded: `chrome://extensions/shortcuts` lets anyone rebind it, and a
 * label showing a key that does nothing is worse than no label.
 */
export function useShortcut(): string | null {
  const query = useQuery({
    queryKey: ['shortcut'],
    queryFn: async () => {
      const result = await sendMessage({ type: 'overlay/shortcut' })
      return result.ok ? (result.value?.label ?? null) : null
    },
    staleTime: 60_000,
  })
  return query.data ?? null
}
