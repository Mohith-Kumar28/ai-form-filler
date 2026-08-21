import { useCallback, useEffect, useState } from 'react'
import { readLocal, writeLocal } from './storage.js'

const SEEN_KEY = 'aff:paywallSeen'

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
    void readLocal<boolean>(SEEN_KEY).then((stored) => {
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
    void writeLocal(SEEN_KEY, true)
  }, [])

  return { seen, markSeen }
}
