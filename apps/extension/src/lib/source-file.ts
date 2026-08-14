import type { ProfileSourcesItem } from '../generated/model/index.js'
import { API_URL, STORAGE_KEYS } from './config.js'
import { readLocal } from './storage.js'

/**
 * Fetches a stored original as an object URL.
 *
 * The file endpoint needs the session token and a plain `<a href>` cannot carry one, so the
 * bytes are fetched and wrapped. That also keeps the token out of any URL, where it would
 * reach history and every tab-sharing surface.
 *
 * The caller owns the returned `revoke`. The previous implementation released on a 60-second
 * timer, which both leaked when the panel closed first and could revoke a URL an `<iframe>`
 * was still displaying.
 */
export async function loadSourceFile(
  sourceId: string,
): Promise<{ url: string; type: string; revoke: () => void }> {
  const token = await readLocal<string>(STORAGE_KEYS.sessionToken)

  let response: Response
  try {
    response = await fetch(`${API_URL}/v1/profile/sources/${sourceId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    // A network failure throws a bare `TypeError: Failed to fetch`, which is not a sentence
    // anyone can act on and was being rendered verbatim in the preview.
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'The stored copy is no longer available.'
        : 'Could not open the stored copy.',
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  return { url, type: blob.type, revoke: () => URL.revokeObjectURL(url) }
}

/** Opens a source in a new tab: links directly, stored files through a short-lived blob URL. */
export async function openSourceInTab(source: ProfileSourcesItem): Promise<void> {
  if (source.kind === 'link' && source.url) {
    await chrome.tabs.create({ url: source.url })
    return
  }
  if (!source.hasFile) return

  const { url } = await loadSourceFile(source.id)
  await chrome.tabs.create({ url })
  // The tab holds its own reference once loaded; this only releases our handle.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The site's own favicon, via Chrome's cache rather than a network request to the site.
 *
 * `chrome://favicon` is gone in MV3; `_favicon/` is its replacement and needs the `favicon`
 * permission. It degrades to a blank image rather than failing, so a missing icon costs a
 * pixel of space and nothing else.
 */
export function faviconUrl(url: string, size = 32): string {
  const target = new URL(chrome.runtime.getURL('/_favicon/'))
  target.searchParams.set('pageUrl', url)
  target.searchParams.set('size', String(size))
  return target.toString()
}
