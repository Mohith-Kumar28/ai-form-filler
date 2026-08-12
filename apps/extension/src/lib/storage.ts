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
