/**
 * Runtime constants, deliberately free of any zod import.
 *
 * The content script runs on **every page the user visits**, so its bundle is a tax on
 * someone else's page load. Importing a single value from a module that also defines Zod
 * schemas pulls all of zod in behind it — that alone took the content script from 11 kB to
 * 93 kB. Anything the content script needs at runtime belongs here.
 *
 * Schema modules re-export from this file, so there is still one definition.
 */

/** Below this, a fill is marked for review rather than accepted silently. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7

/** Forms per calendar month, per plan. */
export const PLAN_LIMITS = {
  free: 5,
  pro: 50,
  ultra: 300,
} as const

/** Maximum sources (documents, links, notes) a user can store, per plan. */
export const PLAN_SOURCE_LIMITS = {
  free: 5,
  pro: 25,
  ultra: 100,
} as const

/** Maximum custom facts a user can store, per plan. */
export const PLAN_FACT_LIMITS = {
  free: 10,
  pro: 50,
  ultra: 200,
} as const

/** Maximum upload file size in bytes, per plan. */
export const PLAN_UPLOAD_LIMITS = {
  free: 15 * 1024 * 1024,
  pro: 30 * 1024 * 1024,
  ultra: 50 * 1024 * 1024,
} as const

export const FILL_PORT = 'aff:fill' as const

/**
 * Error codes that mean "this session is over", as opposed to "this request failed".
 *
 * The distinction matters because the response is different in kind: a failed request is
 * worth retrying or reporting, whereas a dead session can only be fixed by signing in
 * again, and every retry against it is wasted.
 */
const AUTH_ERROR_CODES = new Set(['UNAUTHENTICATED', 'INVALID_TOKEN'])

export function isAuthError(code: string | undefined): boolean {
  return code !== undefined && AUTH_ERROR_CODES.has(code)
}

/**
 * What the user is told when their session ends.
 *
 * The server's own wording — "Missing bearer token", "Account no longer exists" — describes
 * an HTTP condition to whoever wrote the client. To the person using the extension it reads
 * as a bug in the product, and it names an internal mechanism they cannot act on. This says
 * what happened and what to do about it, and it is the only auth message any surface shows.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your session ended. Sign in again to continue.'

/* ── Learning caps ─────────────────────────────────────────────────────────
   The product learns from every answer the user settles, not only from the
   ones they submit. That is a large increase in write volume, so the ceilings
   are here rather than scattered across the two sides that enforce them.   */

/**
 * How long a field must sit still before its value counts as an answer.
 *
 * Matched to `waitForOption`'s 1500 ms deadline in the ATS adapter, because react-select is
 * the slowest committer we know of: it drives its own value over roughly that long, and
 * reading before it settles records an empty field as a rejection of the answer we just wrote.
 */
export const LEARN_SETTLE_DELAY_MS = 1500

/**
 * The longest a pending answer may wait, however much the user keeps typing.
 *
 * A pure debounce never fires on a form somebody is working through continuously — every
 * keystroke pushes the deadline out, and the whole page is taught only at submit, which is
 * the behaviour this replaces. This is the guarantee that something lands.
 */
export const LEARN_SETTLE_MAX_WAIT_MS = 6000

/** Floor between two reports, so a fast typist is batched rather than streamed. */
export const LEARN_MIN_REPORT_INTERVAL_MS = 3000

/**
 * Answers one page may teach, across every fill and every settle on it.
 *
 * A long form is still one event in the user's life. Without a ceiling, one unusual page
 * could write more memories than a month of ordinary use and dominate everything retrieved
 * afterwards.
 */
export const LEARN_MAX_PER_PAGE = 24

/** Entries in one report. Small because reports are now frequent rather than final. */
export const LEARN_MAX_PER_REPORT = 8

/**
 * Longest answer we send.
 *
 * Enforced on the client because the wire schema caps `accepted` at the same length and zod
 * rejects the **whole batch** on one over-length entry — so a single long essay would
 * silently discard the seven other answers travelling with it.
 */
export const LEARN_MAX_ANSWER_CHARS = 4000

/**
 * Most options we will carry alongside a choice.
 *
 * An option set is what makes a short answer meaningful later — "10" is nothing, "10, out of
 * 1-10" is a fact. But a 200-country dropdown's option set is payload, not information, and
 * it would reach a prompt.
 */
export const LEARN_MAX_OPTIONS = 24

/**
 * Questions whose answers are never learned, whatever else says otherwise.
 *
 * Detection already refuses to fill most of these, so in practice this is the durable
 * backstop rather than the first line of defence — and it is checked on **both** sides of the
 * wire, because the client can be an old build and the server is the side that persists.
 * A one-time code stored in a memory index is a secret that outlives its own validity.
 */
export const NEVER_LEARN =
  /pass(word|code)|\botp\b|\bpin\b|\bcvv\b|\bcvc\b|card.?number|security.?code|\bssn\b|social.?security|verification.?code|one-?time|\b2fa\b|\bcaptcha\b/i
