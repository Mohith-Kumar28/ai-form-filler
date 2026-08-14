import { STORAGE_KEYS } from './config.js'

/**
 * Notifies when the session ends, wherever it ended.
 *
 * The session can die in a context that has no way to re-render anything: the background
 * service worker discovers it mid-fill, and the page dock only ever sees a message. So the
 * side panel cannot learn about it by catching an error — by the time it next renders, the
 * request that failed happened somewhere else entirely.
 *
 * `chrome.storage.onChanged` fires in every extension context, which makes the token's
 * removal the one event all of them can agree on. `http-client` clears it, this reports it,
 * and the panel swaps to signed-out — no message passing to keep in sync, and no way for one
 * surface to still believe it is signed in after another has found out otherwise.
 *
 * Returns an unsubscribe function.
 */
export function onSessionEnded(callback: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return

    const change = changes[STORAGE_KEYS.sessionToken]
    if (!change) return

    // Only a removal counts. Signing in also changes this key, and treating that as the end
    // of a session would sign the user straight back out again.
    if (change.newValue === undefined && change.oldValue !== undefined) {
      callback()
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
