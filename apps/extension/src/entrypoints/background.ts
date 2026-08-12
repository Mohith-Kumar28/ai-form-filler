import type { Request } from '@aff/shared'
import { signIn, signOut } from '../lib/auth.js'
import { registerFillPort, runFillFlow } from '../lib/fill-port.js'
import { toResult } from '../lib/messaging.js'

export default defineBackground(() => {
  registerFillPort()

  // Clicking the toolbar icon opens the side panel rather than a popup — the review UI
  // needs to stay open while the user reads the page behind it.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Not fatal; the explicit `sidepanel/open` message still works.
  })

  chrome.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
    // `true` keeps the message channel open for the async reply. Every branch must return
    // it, or the caller's promise resolves as undefined with no error.
    switch (request.type) {
      case 'auth/signIn':
        void toResult(() => signIn()).then(sendResponse)
        return true

      case 'auth/signOut':
        void toResult(async () => {
          await signOut()
          return null
        }).then(sendResponse)
        return true

      // The side panel reads the account through the generated `useGetAccount` hook rather
      // than routing it through here — it has its own access to chrome.storage for the
      // token, so the extra message hop bought nothing.

      /**
       * One-click fill from the page overlay.
       *
       * The side panel is opened alongside so results, low-confidence answers, and any
       * error are visible — the launcher itself is a button, not a place to report five
       * skipped fields. Opening it must happen synchronously in this handler: Chrome only
       * permits `sidePanel.open` inside a user gesture, and awaiting anything first loses it.
       */
      case 'overlay/requestFill':
        void toResult(async () => {
          const tabId = _sender.tab?.id
          if (!tabId) throw new Error('No tab to fill')

          await chrome.sidePanel.open({ tabId }).catch(() => {
            // Opening is a convenience; a failure must not abort the fill itself.
          })

          await runFillFlow(tabId, { quality: 'auto', overwriteExisting: false }, (event) => {
            // Forwarded so an open panel can follow along. No listener is a normal state,
            // and `sendMessage` rejecting on no receiver is not an error worth surfacing.
            void chrome.runtime.sendMessage({ type: 'fill/event', event }).catch(() => undefined)
          })
          return null
        }).then(sendResponse)
        return true

      case 'sidepanel/open':
        void toResult(async () => {
          await chrome.sidePanel.open({ tabId: request.tabId })
          return null
        }).then(sendResponse)
        return true

      default:
        return false
    }
  })
})
