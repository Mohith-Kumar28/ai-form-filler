import type { FormSchema } from '@aff/shared'
import { useCallback, useEffect, useState } from 'react'

export interface ActivePage {
  status: 'checking' | 'ready' | 'unavailable'
  tabId: number | null
  /** Host only. Full URLs never leave the page, and this is only ever shown, never sent. */
  origin: string | null
  fieldCount: number
  /** Null when the page has no form the adapters recognise, or refuses content scripts. */
  form: FormSchema | null
}

const INITIAL: ActivePage = {
  status: 'checking',
  tabId: null,
  origin: null,
  fieldCount: 0,
  form: null,
}

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * What is on the page in front of the user, right now.
 *
 * The side panel outlives the tab it was opened on — it persists across navigation and tab
 * switches — so Home has to re-ask on every activation and every completed load, or it sits
 * there confidently reporting the field count of a page the user left ten minutes ago.
 *
 * `content/detect` is sent straight to the tab rather than through the worker: the panel has
 * `chrome.tabs`, and routing a read through the service worker only adds a hop that can be
 * torn down mid-flight.
 */
export function useActivePage(): ActivePage & { refresh: () => void } {
  const [page, setPage] = useState<ActivePage>(INITIAL)

  const read = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const origin = originOf(tab?.url)

    if (!tab?.id || origin === null) {
      setPage({ status: 'unavailable', tabId: tab?.id ?? null, origin, fieldCount: 0, form: null })
      return
    }

    try {
      const form = (await chrome.tabs.sendMessage(tab.id, {
        type: 'content/detect',
      })) as FormSchema | null

      setPage({
        status: 'ready',
        tabId: tab.id,
        origin,
        fieldCount: form?.fields.length ?? 0,
        form,
      })
    } catch {
      // No content script: a chrome:// page, the Web Store, a PDF viewer, or a tab that was
      // already open when the extension was installed. Not an error worth showing as one.
      setPage({ status: 'unavailable', tabId: tab.id, origin, fieldCount: 0, form: null })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (!cancelled) void read()
    }

    run()

    const onActivated = () => run()
    const onUpdated = (
      _tabId: number,
      change: { status?: string; url?: string },
      tab: chrome.tabs.Tab,
    ) => {
      // `status: 'complete'` alone misses single-page navigations, which change the URL
      // without ever reloading — the exact case an ATS multi-step application is.
      if (tab.active && (change.status === 'complete' || change.url)) run()
    }

    chrome.tabs.onActivated.addListener(onActivated)
    chrome.tabs.onUpdated.addListener(onUpdated)

    return () => {
      cancelled = true
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.tabs.onUpdated.removeListener(onUpdated)
    }
  }, [read])

  return { ...page, refresh: () => void read() }
}
