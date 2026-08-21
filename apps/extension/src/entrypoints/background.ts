import type { Request } from '@aff/shared'
import { getAccount } from '../generated/endpoints/account/account.js'
import { improveAnswer, submitFeedback } from '../generated/endpoints/fill/fill.js'
import { getProfile } from '../generated/endpoints/profile/profile.js'
import { deleteAccount, hasSession, signIn, signOut } from '../lib/auth.js'
import { LAST_FILL_KEY, registerFillPort } from '../lib/fill-port.js'
import { toResult } from '../lib/messaging.js'
import { PAYWALL_KEY } from '../lib/storage.js'

const SETTINGS_KEY = 'aff:settings'
const DEFAULT_SETTINGS = { inlineAutofill: true, showLauncher: true }

/**
 * Which content-script message each panel message becomes.
 *
 * A lookup rather than a nested ternary, because it grew to three entries and the ternary form
 * made a fall-through group of three cases read as if it handled two.
 */
const FORWARDED_TO_CONTENT = {
  'content/highlight': 'content/highlight',
  'review/resolved': 'content/resolved',
  'review/open': 'content/openCard',
} as const

/**
 * Records a verdict beside the plan it belongs to.
 *
 * The panel's own store is a module-level Map that dies when the panel closes, and the page is
 * the authority now — so without this, closing and reopening the panel showed every judged
 * answer as still outstanding, including the ones just dealt with on the page.
 */
async function recordVerdict(
  tabId: number,
  verdict: { fieldId: string; verdict: string; value: string },
): Promise<void> {
  const stored = (await chrome.storage.session.get(LAST_FILL_KEY).catch(() => ({}))) as Record<
    string,
    { tabId?: number; verdicts?: Record<string, { verdict: string; value: string }> } | undefined
  >
  const last = stored[LAST_FILL_KEY]
  // A verdict for a different tab's form is not this record's business.
  if (!last || last.tabId !== tabId) return

  await chrome.storage.session
    .set({
      [LAST_FILL_KEY]: {
        ...last,
        verdicts: {
          ...(last.verdicts ?? {}),
          [verdict.fieldId]: { verdict: verdict.verdict, value: verdict.value },
        },
      },
    })
    .catch(() => undefined)
}

/** The manifest command that fills the active tab's form. See `commands` in wxt.config.ts. */
const FILL_COMMAND = 'fill-form'

/**
 * How macOS writes a Chrome shortcut string.
 *
 * `chrome.commands.getAll` reports the binding in Chrome's own vocabulary — "Alt+F" —
 * on every platform, including the one where every other piece of UI writes it "⌥⇧F". A
 * modifier spelled out in words beside a Mac form reads as a Windows tooltip somebody forgot
 * to localise, so the words are swapped for the glyphs and the separators dropped.
 */
const MAC_KEYS: Record<string, string> = {
  Command: '\u2318',
  Cmd: '\u2318',
  Ctrl: '\u2303',
  MacCtrl: '\u2303',
  Alt: '\u2325',
  Option: '\u2325',
  Shift: '\u21e7',
}

function shortcutLabel(shortcut: string, isMac: boolean): string {
  if (!isMac) return shortcut
  return shortcut
    .split('+')
    .map((key) => MAC_KEYS[key] ?? key)
    .join('')
}

export default defineBackground(() => {
  registerFillPort()

  /**
   * The keyboard route into a fill.
   *
   * It forwards to the content script rather than starting the fill here, so the shortcut and
   * the launcher click end up in the same function on the page — the one that already knows the
   * detected form, the cached quota, and what to do when there is no quota left. A tab with no
   * content script in it (a chrome:// page, the Web Store, a tab open from before the extension
   * loaded) simply rejects the message, and there is nothing to fill there anyway.
   */
  chrome.commands?.onCommand.addListener((command) => {
    if (command !== FILL_COMMAND) return
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id === undefined) return
      await chrome.tabs.sendMessage(tab.id, { type: 'content/fill' }).catch(() => undefined)
    })()
  })

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
       * Erase the account. The worker owns it because the teardown afterwards touches
       * `chrome.identity`, which the side panel cannot reach — and because the panel can close
       * mid-flight, which is not a thing that should be able to happen between deleting an
       * account and forgetting its credentials.
       */
      case 'account/delete':
        void toResult(() => deleteAccount(request.confirmEmail)).then(sendResponse)
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
       * Final values from a submitted form.
       *
       * The outcome is **reported**, where it used to be swallowed by a bare `.catch`. Nothing
       * about that was safe: a failure to record feedback still must never break somebody's
       * form, and it does not — the page decides what to do with the answer and its only
       * response is a small chip that fades. But swallowing it here made the entire learning
       * loop unobservable from the outside. A dead session, or one over-length entry taking its
       * whole batch down with it, was indistinguishable from a product that had decided the
       * correction was not worth keeping.
       *
       * `recorded` is what actually landed, so the page can say "remembered" only when
       * something was.
       */
      case 'feedback/submit':
        void toResult(async () => {
          const result = await submitFeedback(request.payload)
          return { recorded: result.recorded }
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
      /**
       * Open the answer card on the page, from the panel's stepper.
       *
       * Same hop again. This replaced `review/write`, which carried a finished value for the
       * page to apply — two surfaces holding their own copy of the same answer, and only one of
       * them able to fail to write it. The panel now points at a field and the page edits it.
       */
      case 'review/open':
        void toResult(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id !== undefined) {
            await chrome.tabs
              .sendMessage(tab.id, {
                type: FORWARDED_TO_CONTENT[request.type],
                fieldId: request.fieldId,
              })
              .catch(() => undefined)
          }
          return null
        }).then(sendResponse)
        return true

      /**
       * A verdict reached on the page, re-broadcast so an open panel stays in step.
       *
       * Parked beside the plan it belongs to, in session storage, because the panel's own copy
       * dies with the panel and the answers themselves must not outlive the session. Nothing
       * listens when the panel is closed, which is the ordinary case rather than a failure.
       */
      case 'review/verdict':
        void toResult(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id !== undefined) await recordVerdict(tab.id, request)
          // Re-broadcast for a panel that is open right now.
          void chrome.runtime.sendMessage(request).catch(() => undefined)
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

      /**
       * The page asked for the offer. Open the panel, then leave the note.
       *
       * The open comes first, and it is the whole reason this handler is written the way it is.
       * `chrome.sidePanel.open` needs a live user gesture, and awaiting anything at all spends
       * it — so the previous order, which wrote the note and *then* opened, reliably lost the
       * gesture and left the offer to a fallback card drawn over the user's own form. The call is
       * made synchronously, before the first `await`, which is what keeps the click alive across
       * the hop from the page.
       *
       * The note still lands in time. It goes to `session` storage rather than `local` — a note
       * surviving a browser restart is a sheet nobody asked for — and the panel takes it by two
       * routes: on mount, and from `storage.onChanged` if it mounted first. A write that loses the
       * race to a mounting panel is therefore still delivered. `at` is what makes two refusals in
       * a row two events: the panel keys its effect on it, so a second press with the same `mode`
       * still shows the sheet it dismissed.
       */
      case 'overlay/paywall':
        void toResult(async () => {
          const tabId = _sender.tab?.id
          // Invoked, not awaited. See above: the await is what would kill it.
          const opening = tabId === undefined ? null : chrome.sidePanel.open({ tabId })
          await chrome.storage.session
            .set({ [PAYWALL_KEY]: { mode: request.mode, at: Date.now() } })
            .catch(() => undefined)
          // Swallowed rather than reported. There is nothing useful the page can do with a
          // refusal now that it no longer draws a paywall of its own, and the launcher is still
          // sitting there saying "Upgrade" for a second press with a fresh gesture.
          await opening?.catch(() => undefined)
          return null
        }).then(sendResponse)
        return true

      case 'sidepanel/open':
        void toResult(async () => {
          await chrome.sidePanel.open({ tabId: request.tabId })
          return null
        }).then(sendResponse)
        return true

      case 'account/quota':
        void toResult(async () => {
          if (!(await hasSession())) return null
          try {
            const account = await getAccount()
            return {
              used: account.quota.used,
              limit: account.quota.limit,
              plan: account.quota.plan,
              exhausted: account.quota.used >= account.quota.limit,
            }
          } catch {
            return null
          }
        }).then(sendResponse)
        return true

      case 'overlay/shortcut':
        void toResult(async () => {
          const commands = await chrome.commands.getAll()
          const bound = commands.find((command) => command.name === FILL_COMMAND)?.shortcut
          // An unbound command reports an empty string, not a missing one.
          if (!bound) return { label: null }
          const platform = await chrome.runtime.getPlatformInfo().catch(() => null)
          return { label: shortcutLabel(bound, platform?.os === 'mac') }
        }).then(sendResponse)
        return true

      case 'settings/get':
        void toResult(async () => {
          const stored = (await chrome.storage.local.get(SETTINGS_KEY)) as Record<
            string,
            { inlineAutofill: boolean; showLauncher: boolean } | undefined
          >
          return stored[SETTINGS_KEY] ?? DEFAULT_SETTINGS
        }).then(sendResponse)
        return true

      case 'settings/set':
        void toResult(async () => {
          await chrome.storage.local.set({ [SETTINGS_KEY]: request.settings })
          return null
        }).then(sendResponse)
        return true

      default:
        return false
    }
  })
})
