/**
 * Who this build is, and where it talks to. The single definition of both.
 *
 * Four separate deployables — the extension manifest, the extension's runtime, the Worker,
 * and the marketing site — each need to agree on the same handful of identifiers. Every one
 * of them used to carry its own copy, and the copies were in different *kinds* of place:
 * a manifest literal, a `.env` file, two Worker secrets, an object in the web app. Nothing
 * compared them, so the only way to learn they had drifted was a runtime failure whose
 * message named none of them:
 *
 *   - Extension id ≠ the OAuth client's item id → Chrome refuses the token: `bad client id`.
 *   - Client id in the manifest ≠ the one the Worker checks `aud` against → `INVALID_TOKEN`,
 *     which reads like a bug in sign-in rather than a mismatched string.
 *   - Extension origin ≠ the Worker's CORS allow-list → a blocked preflight, which reaches
 *     JavaScript as the uniquely unhelpful `Failed to fetch`.
 *
 * That is one fact stated four times, and three of the four failures above are only possible
 * *because* it was stated more than once. Stated once, they cannot happen.
 *
 * **None of these are secrets, which is what makes this file possible.** The extension id is
 * in the Web Store URL, the public key and the client id both ship inside the manifest of
 * every installed copy, and the API's hostname is on the wire. They are public identity, so
 * they belong in source where the compiler can see them — not in the secret store, which
 * exists for values that must never be in a build. `JWT_SECRET`, the Dodo keys and the
 * gateway token stay where they are; see `apps/api/src/env.ts`.
 *
 * Zod-free by the same rule as `constants.ts`: the content script imports from here, and a
 * schema import would pull all of zod onto every page the user visits.
 */

/**
 * The published extension's id, derived by Chrome from `EXTENSION_PUBLIC_KEY` below.
 *
 * It is the store's id, not a locally generated one, and that direction is deliberate. A
 * store listing's id is fixed at the moment the item is created and cannot be changed; an
 * unpacked build's id is whatever its `key` says. Only one of the two can move, so the local
 * build adopts the published id and every id-bound registration — the OAuth client, the CORS
 * origin — is correct for both builds at once.
 *
 * Consequence worth knowing before it confuses you: Chrome will not load an unpacked
 * extension whose id collides with an installed one, so a profile cannot hold the store
 * version and a local build at the same time. Use a second Chrome profile for development.
 */
export const EXTENSION_ID = 'efegkfffhjbpihgainhmfjejbnjabcnl'

/**
 * The Web Store listing's own public key, from Developer Dashboard → the item → Package →
 * "View public key" (PEM headers stripped, newlines removed).
 *
 * Carried on the manifest as `key` for local builds only, which is what pins an unpacked
 * build's id to `EXTENSION_ID` above — without it Chrome derives the id from the **load
 * path**, so the same code in two directories is two different extensions and sign-in works
 * in one of them. The store rejects any uploaded manifest containing `key`, so
 * `wxt.config.ts` strips it for that one build; see the note there.
 *
 * There is no matching private key here and none is needed: `key` alone decides an unpacked
 * extension's id, and the store signs its own uploads.
 */
export const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjwvYJDu7JtY856xS0lnHod8x9SLIee0fIW13LwnL3Qyhi+FgD2EtD2qvQFcm3Y7KT41F9HJpgJw7EQeWKRNeLerbOKTXFR+DDjF1SxVNIFv36c0qQBtcZ1ZP5nRmSInCjDzDpOXlMS1BkeduTVcsHRadBz7TLclqnD1CSLfmwjSAZi9ASp3v2QHDEJ7+8an7GTnjl7dYYdTnpEGAo3FT3xRLS6JhEmV6p2AMTt1vmKAsACJ4jREyerJc5JTf0K0KF20xVoMnCeifXQYvj4yQmBCghkzFWq6tSkMYvG7O+H6Xs6qxwXuvF0NP/5oC8ZcIuXbj8ROhOXjNsqHSHFiYTwIDAQAB'

/** The extension's web origin — the only one the Worker's CORS admits in production. */
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`

/** The public listing. Derived, so a new id cannot leave a dead link behind on the site. */
export const CHROME_WEB_STORE_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`

/**
 * OAuth client id, type **Chrome Extension**, bound in Google Cloud Console to
 * `EXTENSION_ID`. Public by design — it ships in the manifest of every installed copy.
 *
 * Read twice, and the two reads are what used to be two strings: the manifest hands it to
 * `chrome.identity`, and `verifyGoogleAccessToken` checks every inbound token's `aud`
 * against it. That check is the only thing stopping a token minted for *any* Google app from
 * authenticating here, so the two values agreeing is load-bearing, not tidiness.
 */
export const GOOGLE_CLIENT_ID =
  '451054635835-6m4lr9vahne0p1h0bl9jnmllf0p5phuf.apps.googleusercontent.com'

/**
 * The API. One address, no environment switch, no fallback.
 *
 * It used to read `import.meta.env.WXT_API_URL ?? 'http://127.0.0.1:8787'`, and the fallback
 * was the bug: `.env.production` is only loaded in production mode, so every `pnpm dev`
 * build silently pointed at a local Worker. If one wasn't running — and normally one isn't,
 * because the deployed Worker is right there — the fetch threw before any response existed
 * and the panel showed `Failed to fetch` under the Google button. A default that is wrong
 * most of the time is worse than no default: it turns "misconfigured" into "broken".
 *
 * To develop against a local Worker, edit this line and put it back before committing.
 */
export const API_URL = 'https://api.fillaform.in'
