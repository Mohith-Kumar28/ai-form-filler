import { useCallback, useEffect, useState } from 'react'
import { PAYWALL_KEY, PAYWALL_SEEN_KEY, readLocal, writeLocal } from './storage.js'

/**
 * Whether this person has met the paywall yet.
 *
 * The product deliberately says nothing about money until someone tries to fill a form. Before
 * that there is no meter, no plan card, no price and no badge: they are signing in, adding a
 * résumé and typing facts, and a price tag at that moment is a question they have no basis to
 * answer. The offer lands when they press Fill — having already done the work, which is when it
 * is worth something to them.
 *
 * Afterwards it must not disappear again. Somebody who dismissed the sheet and later decides to
 * subscribe needs a way back, and "press Fill again and hope" is not one. So this flag is sticky:
 * once set, the account screen carries a plain, permanent way to start the trial.
 *
 * Stored per browser profile rather than on the account because it describes what this person has
 * been shown, not what they are entitled to — and getting it wrong costs a redundant sheet, not
 * access to anything.
 */
export function usePaywallSeen(): { seen: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    let live = true
    void readLocal<boolean>(PAYWALL_SEEN_KEY).then((stored) => {
      if (live && stored) setSeen(true)
    })
    return () => {
      live = false
    }
  }, [])

  const markSeen = useCallback(() => {
    // Optimistic: the sheet is opening now, and a storage round trip must not decide whether the
    // account screen is consistent with what the user is looking at.
    setSeen(true)
    void writeLocal(PAYWALL_SEEN_KEY, true)
  }, [])

  return { seen, markSeen }
}

/** What the page asked for, as the service worker left it. */
export interface PendingPaywall {
  mode: 'trial' | 'compare'
  at: number
}

/**
 * A paywall the *page* asked for, picked up by the panel.
 *
 * Pressing the launcher on a form is the same moment as pressing Fill in here, and until now it
 * ended somewhere else: a small card drawn over the user's own form, offering a trial in a surface
 * with no room to say what the trial is. The page now asks the worker to open the panel and leaves
 * a note saying which offer to show; this reads it.
 *
 * Two paths in, because the panel may be shut or already open. A closed panel mounts and reads the
 * note; an open one is told by `storage.onChanged`. The note is cleared as it is taken, so one
 * refusal never shows two sheets, and `at` is part of it so a second refusal after a dismissal is
 * a new event rather than a repeat of the old one.
 */
export function usePendingPaywall(): {
  pending: PendingPaywall | null
  clear: () => void
} {
  const [pending, setPending] = useState<PendingPaywall | null>(null)

  useEffect(() => {
    let live = true

    const take = async () => {
      const stored = (await chrome.storage.session.get(PAYWALL_KEY).catch(() => ({}))) as Record<
        string,
        PendingPaywall | undefined
      >
      const note = stored[PAYWALL_KEY]
      if (!note || !live) return
      // Cleared as it is taken, not when the sheet closes: the note is a request, and it has now
      // been delivered. Leaving it would re-open the sheet on the panel's next mount.
      await chrome.storage.session.remove(PAYWALL_KEY).catch(() => undefined)
      if (live) setPending(note)
    }

    void take()

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session' || changes[PAYWALL_KEY]?.newValue === undefined) return
      void take()
    }

    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      live = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  return { pending, clear: useCallback(() => setPending(null), []) }
}
