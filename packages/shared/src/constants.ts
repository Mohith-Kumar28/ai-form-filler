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
  free: 50,
  pro: 2000,
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
