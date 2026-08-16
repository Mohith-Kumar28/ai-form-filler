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

/** Opens the Dodo Customer Portal for managing subscription (upgrade/downgrade/cancel). */
export async function openManageSubscription(): Promise<void> {
  const { portalUrl } = await getPortal()
  openExternal(portalUrl)
}
