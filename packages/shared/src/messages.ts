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
  /**
   * Sent by the page's field chip.
   *
   * `scope: 'field'` fills only the field the chip is attached to. It is a separate scope
   * rather than a one-element form because the quota is denominated in *forms*: spending one
   * of fifty monthly fills on a single input would make the chip's cheapest action feel like
   * its most expensive one. See `enforceQuota` in the Worker.
   */
  | { type: 'overlay/requestFill'; scope: 'form' | 'field'; fieldId?: string }
  /** The chip's Review action, opening the panel on the judgement calls. */
  | { type: 'overlay/openPanel' }
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
   * Write one reviewed answer back into the page.
   *
   * The panel cannot reach the tab itself, so this goes through the worker. An empty
   * `value` clears the field, which is what rejecting an answer does.
   */
  | { type: 'review/write'; fieldId: string; value: string }
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
export type ContentRequest =
  | { type: 'content/detect' }
  | { type: 'content/apply'; plan: FillPlan }
  /** A single field, corrected or cleared from the review. No animation, no plan. */
  | { type: 'content/write'; fieldId: string; value: string }
  /** Scroll to a field and flash it, from a hovered review row. */
  | { type: 'content/highlight'; fieldId: string }

/** What the content script reports after writing values into the page. */
export interface ApplyReport {
  applied: string[]
  /** Fields whose element rejected the value — a stale option list, or a removed node. */
  failed: string[]
}

export type ContentResponseFor<R extends ContentRequest> = R extends { type: 'content/detect' }
  ? FormSchema | null
  : R extends { type: 'content/write' }
    ? boolean
    : R extends { type: 'content/highlight' }
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
      tabId: number
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
