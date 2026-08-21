import type { Account, DeletionReport } from '@aff/shared'
import { deleteAccount as requestAccountDeletion } from '../generated/endpoints/account/account.js'
import { signInWithGoogle } from '../generated/endpoints/auth/auth.js'
import { STORAGE_KEYS } from './config.js'
import { readLocal, removeLocal, writeLocal } from './storage.js'

/**
 * `chrome.identity.getAuthToken` hands back a `GetAuthTokenResult` object, not a bare
 * string — the callback signature changed when `grantedScopes` was added. It is also
 * callback-only, so it needs wrapping to be awaited.
 */
function getAuthToken(interactive: boolean): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      // `lastError` must be read to mark it handled, but the value matters: on an
      // interactive call it carries the actual reason Chrome refused — a client id that
      // doesn't match this extension, an unconfigured consent screen, a revoked grant.
      // Discarding it turns every one of those into a misleading "user dismissed it".
      const error = chrome.runtime.lastError

      const token = typeof result === 'string' ? result : result?.token
      if (token) {
        resolve(token)
        return
      }

      // A non-interactive miss is just the signed-out state, not a failure.
      if (!interactive) {
        resolve(undefined)
        return
      }

      reject(new Error(error?.message ?? 'Google sign-in was dismissed'))
    })
  })
}

/**
 * Google sign-in. Runs only in the background script — `chrome.identity` is unavailable to
 * content scripts, and driving it from the side panel would tear the flow down whenever the
 * panel closes.
 */
export async function signIn(): Promise<Account> {
  const accessToken = await getAuthToken(true)
  if (!accessToken) {
    throw new Error('Google returned no token')
  }

  const { token, account } = await signInWithGoogle({ accessToken })

  await writeLocal(STORAGE_KEYS.sessionToken, token)
  await writeLocal(STORAGE_KEYS.account, account)
  return account
}

/**
 * Drops Chrome's cached Google grant.
 *
 * Without this, `getAuthToken` hands back the same cached token on the next sign-in and the
 * user can never switch accounts — which matters twice over after a deletion, where the most
 * likely next action is signing in as somebody else.
 *
 * Best effort throughout: a failed revoke must never block the local teardown it precedes.
 */
async function revokeGoogleGrant(): Promise<void> {
  const cached = await getAuthToken(false).catch(() => undefined)
  if (!cached) return

  await chrome.identity.removeCachedAuthToken({ token: cached }).catch(() => undefined)
  await fetch(`https://oauth2.googleapis.com/revoke?token=${cached}`, { method: 'POST' }).catch(
    () => {
      // Best effort — a failed revoke must not block local sign-out.
    },
  )
}

export async function signOut(): Promise<void> {
  await revokeGoogleGrant()
  await removeLocal([STORAGE_KEYS.sessionToken, STORAGE_KEYS.account])
}

/**
 * Deletes the account on the server, then erases every trace of it from this browser.
 *
 * **Order is load-bearing.** The API call goes first because it needs the session token, and
 * because a local wipe in front of it would leave somebody whose deletion failed signed out of
 * an account that still exists, with no token left to retry with. If the call throws, nothing
 * local is touched and the panel can show the error against a still-working account.
 *
 * The wipe is `clear()` rather than a list of keys, and that is deliberate. Sign-out removes two
 * keys because the rest — settings, muted origins, the launcher's position, the persisted query
 * cache, whether the tour has been seen — describe a browser profile that is about to sign in
 * again. Deletion has no next sign-in. Every one of those keys is data about a user who asked to
 * be forgotten, and enumerating them means the next feature that stores something is a key
 * nobody remembered to add here.
 */
export async function deleteAccount(confirmEmail: string): Promise<DeletionReport> {
  const report = await requestAccountDeletion({ confirmEmail })

  await revokeGoogleGrant()

  /**
   * Past this point the account is gone on the server, so nothing here may throw: the session
   * token *must* end up removed, or the panel repaints a signed-in shell for an account whose
   * every request now 401s. `session` is cleared alongside `local` because a pending paywall
   * note and the last fill both live there.
   */
  const cleared = await Promise.allSettled([
    chrome.storage.local.clear(),
    chrome.storage.session.clear(),
  ])

  if (cleared.some((result) => result.status === 'rejected')) {
    // Fall back to the keys that decide whether the UI believes it is signed in.
    await removeLocal([
      STORAGE_KEYS.sessionToken,
      STORAGE_KEYS.account,
      STORAGE_KEYS.queryCache,
    ]).catch(() => undefined)
  }

  return report
}

/** Whether a session token exists at all, used to pick the signed-in view before any fetch. */
export async function hasSession(): Promise<boolean> {
  return (await readLocal<string>(STORAGE_KEYS.sessionToken)) !== null
}
