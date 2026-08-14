import type { Account } from './account.js'
import type { ApiError } from './api.js'
import type { FeedbackRequest, FillPlan } from './fill.js'
import type { FormSchema } from './form.js'

/**
 * One-shot messages over `chrome.runtime.sendMessage`. Anything that can take longer than
 * a second or two belongs on the port protocol below instead — an MV3 service worker can
 * be torn down mid-request, and a dropped `sendMessage` gives you no way to notice.
 */
export type Request =
  | { type: 'auth/signIn' }
  | { type: 'auth/signOut' }
  /** Sent by the page overlay's dock — the one-click path. */
  | { type: 'overlay/requestFill' }
  /** The dock's Review action, opening the panel on the judgement calls. */
  | { type: 'overlay/openPanel' }
  | { type: 'form/detected'; form: FormSchema }
  | { type: 'feedback/submit'; payload: FeedbackRequest }
  | { type: 'sidepanel/open'; tabId: number }

/**
 * `null` rather than `void` for the no-payload cases: these cross a `postMessage` boundary
 * where the value is really serialised, and a union containing `void` is ambiguous about
 * whether the field is absent or undefined.
 */
export type ResponseFor<R extends Request> = R extends { type: 'auth/signIn' } ? Account : null

/** Discriminated result so callers never have to guess whether a throw or a value came back. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

/**
 * Service worker -> content script. Separate from `Request` because these are handled by a
 * different listener in a different context, and mixing them would let a side-panel message
 * type reach a page.
 */
export type ContentRequest = { type: 'content/detect' } | { type: 'content/apply'; plan: FillPlan }

/** What the content script reports after writing values into the page. */
export interface ApplyReport {
  applied: string[]
  /** Fields whose element rejected the value — a stale option list, or a removed node. */
  failed: string[]
}

export type ContentResponseFor<R extends ContentRequest> = R extends { type: 'content/detect' }
  ? FormSchema | null
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
  | { type: 'start'; tabId: number; quality: 'auto' | 'high'; overwriteExisting: boolean }
  | { type: 'cancel' }

/**
 * Service worker -> extension, over the fill port.
 *
 * `progress` exists because a large form can take 10s+ at tier 3, and a spinner with no
 * movement reads as a hang. The worker emits one per tier as it completes.
 */
export type FillPortEvent =
  | {
      type: 'progress'
      stage: 'detecting' | 'routing' | 'generating' | 'applying'
      done: number
      total: number
    }
  | { type: 'complete'; plan: FillPlan; report: ApplyReport }
  | { type: 'error'; error: ApiError }

// The `chrome`-dependent `sendMessage` helper lives in apps/extension/src/lib/messaging.ts.
// This package stays runtime-agnostic so the Worker can import it without browser types.
