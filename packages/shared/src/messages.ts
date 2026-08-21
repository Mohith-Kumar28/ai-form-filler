import type { Account } from './account.js'
import type { ApiError } from './api.js'
import type { FeedbackRequest, FillPlan } from './fill.js'
import type { FormSchema } from './form.js'
import type { Identity } from './profile.js'

export interface Settings {
  inlineAutofill: boolean
  showLauncher: boolean
}

/**
 * One-shot messages over `chrome.runtime.sendMessage`. Anything that can take longer than
 * a second or two belongs on the port protocol below instead — an MV3 service worker can
 * be torn down mid-request, and a dropped `sendMessage` gives you no way to notice.
 */
export type Request =
  | { type: 'auth/signIn' }
  | { type: 'auth/signOut' }
  /**
   * A fill asked for by the page used to live here, as `overlay/requestFill`, with
   * `overlay/cancelFill` beside it to stop one. Both are gone: the page opens the same fill
   * port the side panel uses.
   *
   * They were the documented-fragile path (see the note above, and HANDOFF 7.3) and they failed
   * in the documented way. A fill is one `sendMessage` whose reply comes ten seconds later, so
   * when the service worker was torn down mid-fill the page was told nothing at all — and the
   * content script, which sets `filling = true` before sending, then refused every later click
   * as "a fill is already running". One dead worker and the launcher was inert for the life of
   * the tab, while the panel's port-based fill went on working. Which is exactly how it was
   * reported: the sidebar fills, the button does nothing.
   *
   * A port cannot fail that way. Its disconnect *is* the signal, and cancelling is closing it.
   */
  /** The chip's Review action, opening the panel on the judgement calls. */
  | { type: 'overlay/openPanel' }
  /** Request known facts (identity + custom) for instant inline suggestions. */
  | { type: 'profile/knownFacts' }
  | { type: 'form/detected'; form: FormSchema }
  | { type: 'feedback/submit'; payload: FeedbackRequest }
  /**
   * Scroll a field into view on the page and flash it.
   *
   * Sent while a review row is hovered, so the list in the panel and the form on the page
   * read as one surface rather than two lists of the same questions.
   */
  | { type: 'content/highlight'; fieldId: string }
  /**
   * Open the answer card on the page for one field.
   *
   * Sent from the panel's stepper. The panel no longer edits answers itself — there is one
   * editor and it is on the page, beside the question it belongs to — so the panel's job here
   * is to point at a field and get out of the way. Replaces `review/write`, which existed
   * because the panel used to own the editing and had to reach through the worker to apply it.
   */
  | { type: 'review/open'; fieldId: string }
  /**
   * A verdict was reached on the page.
   *
   * Broadcast so an open panel's receipt stays true while the user works in the form. The page
   * is the authority now, and this is the only thing that keeps the two from disagreeing. It is
   * fire-and-forget: nothing breaks when the panel is closed, which is the ordinary case.
   */
  | {
      type: 'review/verdict'
      fieldId: string
      verdict: 'accepted' | 'edited' | 'cleared'
      value: string
    }
  /**
   * A field has been dealt with, so the page can take its mark off.
   *
   * Separate from a verdict because accepting an answer writes nothing — the page already
   * holds the value. Without this message, agreeing with a concluded answer in the panel left
   * its endorsement stamp on the field forever, and the only thing that could clear a stamp was
   * changing the answer you had just said was right.
   */
  | { type: 'review/resolved'; fieldId: string }
  /**
   * Rewrite one answer in a named style, from the page.
   *
   * The content script cannot call the API itself: `fetch` from a content script carries the
   * host page's origin, and the Worker's CORS allowlist is the extension's. Routing through
   * the worker is what lets the on-page review offer the same rewrite the panel does instead
   * of sending the user away from the form to get it.
   */
  | { type: 'fill/improve'; label: string; value: string; instruction: string }
  | { type: 'sidepanel/open'; tabId: number }
  /**
   * The offer, asked for by a page that cannot pay for the fill it just tried to start.
   *
   * Opens the side panel on the sender's own tab and leaves a note there saying which offer to
   * show, so the sheet appears in the panel rather than as a second, smaller paywall drawn over
   * somebody's form. The in-page card that used to do that job survives only as the fallback for
   * when Chrome refuses to open the panel — see `openPaywall` in the content script.
   *
   * `mode` is decided on the page from the quota it already holds: an account with a limit of
   * zero has never subscribed and is offered the trial; anything else has run out of a plan it
   * is paying for and is offered the comparison.
   */
  | { type: 'overlay/paywall'; mode: 'trial' | 'compare' }
  | { type: 'account/quota' }
  /**
   * What key combination fires the fill, as the user's own browser has it bound.
   *
   * Asked for rather than hardcoded because `chrome://extensions/shortcuts` lets anyone rebind
   * or unbind the command, and the launcher's rail *is* the place people will read the shortcut
   * off. A label showing the suggested key to somebody who changed it is worse than no label:
   * they press it, nothing fills, and the launcher is the thing that lied. `null` means the
   * command is unbound, and the rail then says nothing about keys at all.
   *
   * Only the service worker can answer — `chrome.commands` is not exposed to content scripts.
   */
  | { type: 'overlay/shortcut' }
  /**
   * Start checkout from the page, without a detour through the side panel.
   *
   * The in-page prompt used to offer "Upgrade to Pro" and "Open panel" as two buttons that ran
   * byte-identical code — both opened the panel — so the offer took two more clicks to accept than
   * it appeared to. The service worker owns the call because only it holds the session token.
   */
  | { type: 'billing/checkout'; trial: boolean }
  | { type: 'settings/get' }
  | { type: 'settings/set'; settings: Settings }

/**
 * `null` rather than `void` for the no-payload cases: these cross a `postMessage` boundary
 * where the value is really serialised, and a union containing `void` is ambiguous about
 * whether the field is absent or undefined.
 */
export type ResponseFor<R extends Request> = R extends { type: 'auth/signIn' }
  ? Account
  : R extends { type: 'overlay/paywall' }
    ? /**
       * Whether the panel actually opened.
       *
       * `chrome.sidePanel.open` needs a user gesture, and the hop from a click in a page to the
       * service worker is one the browser may decide has spent it. The page has to be told, or a
       * refused fill would end in nothing at all — which is the failure this message exists to
       * remove.
       */
      { opened: boolean }
    : R extends { type: 'feedback/submit' }
      ? /**
         * How much of what was reported actually landed — identity fields written, answers
         * stored, rejections recorded.
         *
         * This used to be discarded. Learning was then unfalsifiable from the outside: the user
         * corrected an answer, nothing acknowledged it, and the only way to find out whether it
         * had been remembered was to fill another form days later and see. When it silently
         * failed — a dead session, a validation error on one entry taking the batch with it — the
         * product looked like it had simply chosen not to learn.
         */
        { recorded: number }
      : R extends { type: 'fill/improve' }
        ? { value: string }
        : R extends { type: 'profile/knownFacts' }
          ? { identity: Identity; custom: Record<string, string> } | null
          : R extends { type: 'account/quota' }
            ? { used: number; limit: number; plan: string; exhausted: boolean }
            : R extends { type: 'settings/get' }
              ? Settings
              : R extends { type: 'overlay/shortcut' }
                ? { label: string | null }
                : null

/** Discriminated result so callers never have to guess whether a throw or a value came back. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/**
 * Service worker -> content script. Separate from `Request` because these are handled by a
 * different listener in a different context, and mixing them would let a side-panel message
 * type reach a page.
 */
export type ContentRequest =
  | { type: 'content/detect' }
  /**
   * Fill the whole form, as if the launcher had been clicked.
   *
   * Sent when the keyboard command fires. It goes through the worker because
   * `chrome.commands.onCommand` is only heard there, and it deliberately carries no plan: the
   * page owns detection, the quota it has cached, and the paywall decision, so the shortcut
   * lands on exactly the code path the button uses rather than a second one that can drift.
   */
  | { type: 'content/fill' }
  | { type: 'content/apply'; plan: FillPlan }
  /**
   * Scroll to a field, flash it, and open its answer card.
   *
   * The panel's stepper drives this. It replaces `content/write`: the panel used to send a
   * finished value for the page to apply, which meant two surfaces could hold different text
   * for the same field and only one of them could fail to write it.
   */
  | { type: 'content/openCard'; fieldId: string }
  /** Scroll to a field and flash it, from a hovered review row. */
  | { type: 'content/highlight'; fieldId: string }
  /** Take the mark off a field the user has finished with. */
  | { type: 'content/resolved'; fieldId: string }

/** What the content script reports after writing values into the page. */
export interface ApplyReport {
  applied: string[]
  /** Fields whose element rejected the value — a stale option list, or a removed node. */
  failed: string[]
}

export type ContentResponseFor<R extends ContentRequest> = R extends { type: 'content/detect' }
  ? FormSchema | null
  : R extends {
        type: 'content/highlight' | 'content/resolved' | 'content/openCard' | 'content/fill'
      }
    ? null
    : ApplyReport

export { FILL_PORT } from './constants.js'

/**
 * Side panel -> service worker, over the fill port.
 *
 * The panel sends a `tabId`, not a `FormSchema` — it has no access to the page. The worker
 * asks the content script to detect, which also keeps the `fieldId → Element` map in the
 * one context that can use it.
 */
export type FillPortRequest =
  | {
      type: 'start'
      /**
       * Which tab to fill. Optional, and only the side panel ever sets it.
       *
       * A port opened by a content script already identifies its own tab — the service worker
       * reads it off `port.sender` — and a page able to *name* the tab to fill would be a page
       * able to ask us to fill somebody else's.
       */
      tabId?: number
      overwriteExisting: boolean
      /** Absent means the whole form. A single field is filled without spending quota. */
      onlyFieldId?: string
    }
  | { type: 'cancel' }

/**
 * Service worker -> extension, over the fill port.
 *
 * `progress` exists because a large form can take 10s+ at tier 3, and a static indicator reads
 * as a hang.
 *
 * There is deliberately no `routing` stage. Classification and generation happen inside one
 * HTTP call, so the client cannot honestly tell them apart; it was declared here for a year
 * and never emitted, which meant the page dock rendered a step that could not resolve.
 */
export type FillPortEvent =
  | {
      type: 'progress'
      stage: 'detecting' | 'generating' | 'applying'
      done: number
      total: number
    }
  | { type: 'complete'; plan: FillPlan; report: ApplyReport }
  | { type: 'error'; error: ApiError }

// The `chrome`-dependent `sendMessage` helper lives in apps/extension/src/lib/messaging.ts.
// This package stays runtime-agnostic so the Worker can import it without browser types.
