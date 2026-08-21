/**
 * `chrome.storage.local.get` is typed as returning `{}`, so every read needs a cast.
 * Doing it in one place keeps the assertion auditable instead of scattered across callers.
 *
 * The cast is genuinely unchecked — storage can hold anything a previous extension version
 * wrote. Anything shape-sensitive should be validated with its Zod schema after reading.
 */
export async function readLocal<T>(key: string): Promise<T | null> {
  const stored = (await chrome.storage.local.get(key)) as Record<string, T | undefined>
  return stored[key] ?? null
}

export async function writeLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export async function removeLocal(keys: string | string[]): Promise<void> {
  await chrome.storage.local.remove(keys)
}

/* ── Keys ─────────────────────────────────────────────────────────────────── */

/**
 * Whether this browser profile has met the paywall. `local`, so it outlives the browser.
 *
 * Lives here rather than beside `usePaywallSeen` because the service worker writes the other
 * key below, and reaching into a module that imports React would drag React into the worker
 * bundle for the sake of one string.
 */
export const PAYWALL_SEEN_KEY = 'aff:paywallSeen'

/**
 * A paywall the page asked for and the panel has not shown yet. `session`, not `local`.
 *
 * Written by the service worker just before it opens the panel, read once by the panel and then
 * cleared. In session storage because it describes something happening right now: a note that
 * survived a browser restart would be a sheet nobody asked for.
 */
export const PAYWALL_KEY = 'aff:pendingPaywall'
