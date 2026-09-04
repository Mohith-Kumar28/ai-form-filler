import type { Account, DeletionReport } from '@aff/shared'
import { GOOGLE_OAUTH_REDIRECT_URI, GOOGLE_WEB_CLIENT_ID } from '@aff/shared/deployment'
import { deleteAccount as requestAccountDeletion } from '../generated/endpoints/account/account.js'
import { signInWithGoogle } from '../generated/endpoints/auth/auth.js'
import { STORAGE_KEYS } from './config.js'
import { readLocal, removeLocal, writeLocal } from './storage.js'

/**
 * The Google access token, via `chrome.identity.launchWebAuthFlow`.
 *
 * **Not `getAuthToken`, and the difference is the whole reason this function exists.**
 * `getAuthToken` does not make an OAuth request at all — it asks Chrome's internal GAIA
 * mint-token service, which is reachable only with private Google API keys that ship in
 * Google's own builds of Chrome. Chromium forks (Brave, Arc, Vivaldi, and others) have no such
 * keys, so they fall back to a web request carrying a custom-scheme redirect, and Google
 * refuses it with `Error 400: invalid_request — Custom URI scheme is not supported on Chrome
 * apps.` The user sees a full-page "Access blocked" before anything here can catch it.
 *
 * `launchWebAuthFlow` is plain OAuth implemented in Chromium itself: open Google's authorize
 * URL in a window, watch for a navigation to `GOOGLE_OAUTH_REDIRECT_URI`, read the fragment.
 * No private keys, so every Chromium browser behaves the same. That is why there is one path
 * here and no fork on browser — a fallback would mean showing that alarming Google error page
 * to fork users first, and browser sniffing gets the answer wrong on the next fork anyway.
 *
 * `response_type=token` (the implicit flow) rather than a code exchange, because a code
 * exchange needs a client *secret*, and this code ships inside every installed copy of the
 * extension. There is nowhere in an extension to keep a secret. The access token is used
 * exactly once — traded to our own API for a session token in `signIn()` — and never
 * refreshed, so the implicit flow's short lifetime costs nothing.
 */
async function requestGoogleAccessToken(): Promise<string> {
  if (GOOGLE_WEB_CLIENT_ID.startsWith('REPLACE_')) {
    throw new Error(
      'Google sign-in is not configured: set GOOGLE_WEB_CLIENT_ID in packages/shared/src/deployment.ts',
    )
  }

  /**
   * Replay/mix-up guard. Google echoes `state` back unchanged, so a redirect that arrives
   * without our value did not come from the request we just made.
   */
  const state = crypto.randomUUID()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_WEB_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri', GOOGLE_OAUTH_REDIRECT_URI)
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('state', state)
  /**
   * Always show the chooser. This is what `revokeGoogleGrant` used to buy with a token revoke:
   * without it Google silently reuses whichever account the browser last used, and somebody who
   * has just deleted an account — the most likely moment to sign in as somebody else — is put
   * straight back into the one they left.
   */
  authUrl.searchParams.set('prompt', 'select_account')

  let redirectUrl: string | undefined
  try {
    redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    })
  } catch (error) {
    // Closing the window rejects. That is a dismissal, not a fault worth a stack trace.
    throw new Error(error instanceof Error ? error.message : 'Google sign-in was dismissed')
  }

  if (!redirectUrl) {
    throw new Error('Google sign-in was dismissed')
  }

  const redirect = new URL(redirectUrl)

  /**
   * Errors come back on the query string, the token on the fragment — the implicit flow keeps
   * the credential out of anything that logs URLs. Read both; a denied consent is a `?error=`
   * redirect that carries no fragment at all.
   */
  const failure = redirect.searchParams.get('error')
  if (failure) {
    throw new Error(`Google refused sign-in: ${failure}`)
  }

  const fragment = new URLSearchParams(redirect.hash.replace(/^#/, ''))

  if (fragment.get('state') !== state) {
    throw new Error('Google sign-in response did not match the request')
  }

  const accessToken = fragment.get('access_token')
  if (!accessToken) {
    throw new Error('Google returned no token')
  }

  return accessToken
}

/**
 * Google sign-in. Runs only in the background script — `chrome.identity` is unavailable to
 * content scripts, and driving it from the side panel would tear the flow down whenever the
 * panel closes.
 */
export async function signIn(): Promise<Account> {
  const accessToken = await requestGoogleAccessToken()

  const { token, account } = await signInWithGoogle({ accessToken })

  await writeLocal(STORAGE_KEYS.sessionToken, token)
  await writeLocal(STORAGE_KEYS.account, account)
  return account
}

/**
 * There is no Google grant to drop here any more.
 *
 * `getAuthToken` cached a token inside Chrome that outlived our storage, so signing out without
 * revoking it left the next sign-in silently bound to the same account. `launchWebAuthFlow`
 * caches nothing on our behalf and `prompt=select_account` asks every time, so removing our own
 * two keys is the entire operation.
 */
export async function signOut(): Promise<void> {
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
