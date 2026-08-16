import type { Request } from '@aff/shared'
import { improveAnswer, submitFeedback } from '../generated/endpoints/fill/fill.js'
import { getProfile } from '../generated/endpoints/profile/profile.js'
import { hasSession, signIn, signOut } from '../lib/auth.js'
import { registerFillPort, runFillFlow } from '../lib/fill-port.js'
import { toResult } from '../lib/messaging.js'

/** Where the most recent finished fill is parked for the side panel to pick up. */
export const LAST_FILL_KEY = 'aff:lastFill'

/**
 * Tabs whose page-initiated fill has been stopped.
 *
 * The panel's fill is cancelled by disconnecting its port; a page fill is a one-shot message,
 * so the worker has to hold the flag itself. Keyed by tab because two tabs can be filling at
 * once and one stopping must not stop the other.
 */
const cancelledFills = new Set<number>()

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

      /**
       * Known facts for the page's instant inline suggestions.
       *
       * The content script runs on every page and cannot call the API itself (its fetch
       * carries the host page's origin, and the CORS allowlist is the extension's). This hop
       * hands it just the identity fields and typed facts — enough to suggest an email or a
       * notice period with no model call. `null` when signed out, so the page simply offers no
       * suggestions rather than raising an error.
       */
      case 'profile/knownFacts':
        void toResult(async () => {
          if (!(await hasSession())) return null
          try {
            const profile = await getProfile()
            return { identity: profile.identity, custom: profile.custom }
          } catch {
            // A signed-out race or a down API must not surface as an error on the page.
            return null
          }
        }).then(sendResponse)
        return true

      // The side panel reads the account through the generated `useGetAccount` hook rather
      // than routing it through here — it has its own access to chrome.storage for the
      // token, so the extra message hop bought nothing.

      /**
       * A fill asked for from the page — either the focused field, or the whole form.
       *
       * The side panel is deliberately **not** opened. The page shows its own progress on the
       * seal and marks each field as it lands, so forcing the panel open would cover the form
       * with a surface showing nothing that was asked for. The panel opens only on request.
       */
      case 'overlay/requestFill':
        void toResult(async () => {
          const tabId = _sender.tab?.id
          if (!tabId) throw new Error('No tab to fill')

          const options = {
            overwriteExisting: false,
            ...(request.scope === 'field' && request.fieldId
              ? { onlyFieldId: request.fieldId }
              : {}),
          }

          cancelledFills.delete(tabId)

          await runFillFlow(
            tabId,
            options,
            (event) => {
              // Two receivers, two channels. `runtime.sendMessage` reaches an open side panel;
              // `tabs.sendMessage` reaches the content script. Neither having a listener is a
              // normal state.
              void chrome.runtime.sendMessage({ type: 'fill/event', event }).catch(() => undefined)
              void chrome.tabs
                .sendMessage(tabId, { type: 'fill/event', event })
                .catch(() => undefined)

              /**
               * Keep the finished plan so Review has something to open.
               *
               * A fill started from the page dock usually runs with the panel **closed**, so
               * the broadcast above reaches nobody — and pressing Review then opened a panel
               * with no result in it, landing the user back on the sources list. Session
               * storage rather than local: this holds the user's actual answers, and they
               * should not outlive the browser session that produced them.
               */
              if (event.type === 'complete') {
                void chrome.storage.session
                  .set({ [LAST_FILL_KEY]: { tabId, plan: event.plan, report: event.report } })
                  .catch(() => undefined)
              }
            },
            () => cancelledFills.has(tabId),
          )

          cancelledFills.delete(tabId)
          return null
        }).then(sendResponse)
        return true

      /** Stop a page-initiated fill. See `overlay/cancelFill`. */
      case 'overlay/cancelFill':
        void toResult(async () => {
          const tabId = _sender.tab?.id
          if (tabId !== undefined) cancelledFills.add(tabId)
          return null
        }).then(sendResponse)
        return true

      /**
       * Final values from a submitted form.
       *
       * Fire-and-forget by design: the user has already submitted and moved on, and a
       * failure to record feedback must never surface as an error on their form.
       */
      case 'feedback/submit':
        void toResult(async () => {
          await submitFeedback(request.payload).catch(() => undefined)
          return null
        }).then(sendResponse)
        return true

      /**
       * A corrected or rejected answer, forwarded from the panel to the page.
       *
       * The panel has no access to the tab, and the content script owns the only
       * `fieldId -> Element` map, so this hop is what connects them. Targets the active tab
       * because that is the form the review is about.
       */
      case 'review/write':
        void toResult(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id !== undefined) {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'content/write',
              fieldId: request.fieldId,
              value: request.value,
            })
          }
          return null
        }).then(sendResponse)
        return true

      /**
       * A review row in the panel is pointing at a field on the page.
       *
       * Same hop as `review/write`, and for the same reason: only the content script holds the
       * `fieldId -> Element` map. Failures are swallowed — the page may have navigated, and a
       * hover must never raise an error.
       */
      case 'content/highlight':
      /**
       * A field the user has finished with, so the page can take its mark off.
       *
       * Falls through with `content/highlight` because both are the same hop for the same
       * reason — only the content script holds the `fieldId -> Element` map — and both are
       * advisory: the page may have navigated, and neither should ever raise an error at a
       * user who has just agreed with an answer.
       */
      case 'review/resolved':
        void toResult(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id !== undefined) {
            await chrome.tabs
              .sendMessage(tab.id, {
                type: request.type === 'review/resolved' ? 'content/resolved' : 'content/highlight',
                fieldId: request.fieldId,
              })
              .catch(() => undefined)
          }
          return null
        }).then(sendResponse)
        return true

      /** The seal's Open the panel action. */
      case 'overlay/openPanel':
        void toResult(async () => {
          const tabId = _sender.tab?.id
          if (tabId) await chrome.sidePanel.open({ tabId })
          return null
        }).then(sendResponse)
        return true

      /** A rewrite asked for from the page's review slip. See `fill/improve` in messages.ts. */
      case 'fill/improve':
        void toResult(() =>
          improveAnswer({
            label: request.label,
            value: request.value,
            instruction: request.instruction,
          }),
        ).then(sendResponse)
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
