import type { Account } from '@aff/shared'
import { signInWithGoogle } from '../generated/endpoints/auth/auth.js'
import { STORAGE_KEYS } from './config.js'
import { readLocal, removeLocal, writeLocal } from './storage.js'

/**
 * `chrome.identity.getAuthToken` hands back a `GetAuthTokenResult` object, not a bare
 * string — the callback signature changed when `grantedScopes` was added. It is also
 * callback-only, so it needs wrapping to be awaited.
 */
function getAuthToken(interactive: boolean): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      // Reading `lastError` is what marks it handled; skipping this logs an unchecked-error
      // warning on every non-interactive miss, which is a normal signed-out state.
      void chrome.runtime.lastError
      resolve(typeof result === 'string' ? result : result?.token)
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
    throw new Error('Google sign-in was dismissed')
  }

  const { token, account } = await signInWithGoogle({ accessToken })

  await writeLocal(STORAGE_KEYS.sessionToken, token)
  await writeLocal(STORAGE_KEYS.account, account)
  return account
}

export async function signOut(): Promise<void> {
  // Revoke with Google too. Without this, `getAuthToken` returns the same cached token on
  // the next sign-in and the user can never switch accounts.
  const cached = await getAuthToken(false)

  if (cached) {
    await chrome.identity.removeCachedAuthToken({ token: cached })
    await fetch(`https://oauth2.googleapis.com/revoke?token=${cached}`, { method: 'POST' }).catch(
      () => {
        // Best effort — a failed revoke must not block local sign-out.
      },
    )
  }

  await removeLocal([STORAGE_KEYS.sessionToken, STORAGE_KEYS.account])
}

/** Whether a session token exists at all, used to pick the signed-in view before any fetch. */
export async function hasSession(): Promise<boolean> {
  return (await readLocal<string>(STORAGE_KEYS.sessionToken)) !== null
}
