import { QueryClient } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { STORAGE_KEYS } from './config.js'

/**
 * `chrome.storage.local` persister.
 *
 * An MV3 service worker is torn down aggressively, and the side panel unmounts every time
 * it closes — so an in-memory cache is effectively empty on each open. Persisting means the
 * panel paints real data immediately and revalidates behind it.
 */
export const chromeStoragePersister: Persister = {
  async persistClient(client: PersistedClient) {
    await chrome.storage.local.set({ [STORAGE_KEYS.queryCache]: client })
  },
  async restoreClient() {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.queryCache)
    return stored[STORAGE_KEYS.queryCache] as PersistedClient | undefined
  },
  async removeClient() {
    await chrome.storage.local.remove(STORAGE_KEYS.queryCache)
  },
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      // The panel has no window focus events worth reacting to, and retrying a 401 or a
      // 402 just burns requests — both are terminal until the user acts.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const code = (error as { code?: string }).code
        if (
          code === 'UNAUTHENTICATED' ||
          code === 'INVALID_TOKEN' ||
          code === 'QUOTA_EXCEEDED' ||
          // Both are 402s and both are terminal until the user acts. `LIMIT_EXCEEDED` was missing,
          // so hitting a source or fact ceiling cost three identical refusals instead of one.
          code === 'LIMIT_EXCEEDED' ||
          code === 'INVALID_REQUEST'
        ) {
          return false
        }
        return failureCount < 2
      },
    },
  },
})
