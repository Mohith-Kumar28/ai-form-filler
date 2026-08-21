import { createCheckout, getPortal } from '../generated/endpoints/billing/billing.js'

/** Rough country hint for INR vs USD routing. `navigator.language` is the cheapest signal. */
export function detectCountry(): string {
  const lang = (navigator.language ?? '').toLowerCase()
  return lang.includes('in') ? 'IN' : 'US'
}

/** Opens a URL in a new tab, detached from the side panel's own lifecycle. */
export function openExternal(url: string): void {
  if (!url) return
  void chrome.tabs.create({ url })
}

/** Opens the Dodo Collection Checkout — Dodo renders all plans side-by-side. */
export async function openUpgrade(): Promise<void> {
  const { checkoutUrl } = await createCheckout({ country: detectCountry() })
  openExternal(checkoutUrl)
}

/**
 * Starts the 14-day Pro trial.
 *
 * A separate call rather than a flag on `openUpgrade` because they are different offers and the
 * copy around them differs: this one is a single product with a trial attached, the other is a
 * plan picker. The server decides eligibility — asking for a trial with a subscription already on
 * file quietly gets the picker instead — so this can be called from anywhere without the caller
 * having to reason about whether it is allowed.
 */
export async function openTrial(): Promise<void> {
  const { checkoutUrl } = await createCheckout({ country: detectCountry(), trial: true })
  openExternal(checkoutUrl)
}

/** Opens the Dodo Customer Portal for managing subscription (upgrade/downgrade/cancel). */
export async function openManageSubscription(): Promise<void> {
  const { portalUrl } = await getPortal()
  openExternal(portalUrl)
}
