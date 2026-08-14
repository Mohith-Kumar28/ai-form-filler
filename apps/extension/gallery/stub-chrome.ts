/**
 * The smallest `chrome` that lets the panel's screens render outside an extension.
 *
 * Reads answer with fixture-shaped values; writes are no-ops. Nothing here is imported by the
 * extension build — WXT only bundles `src/entrypoints`, so this cannot reach production.
 */

const noop = () => undefined
const resolved =
  <T>(value: T) =>
  () =>
    Promise.resolve(value)

const stub = {
  runtime: {
    // Absolute, because callers build a `new URL()` from it — `chrome.runtime.getURL` always
    // returns a full `chrome-extension://` URL, and a bare path throws.
    getURL: (path: string) => new URL(path, location.origin).toString(),
    getManifest: () => ({ version_name: 'gallery' }),
    sendMessage: resolved({ ok: true, value: null }),
    connect: () => ({
      postMessage: noop,
      disconnect: noop,
      onMessage: { addListener: noop, removeListener: noop },
      onDisconnect: { addListener: noop, removeListener: noop },
    }),
    onMessage: { addListener: noop, removeListener: noop },
    lastError: undefined,
  },
  storage: {
    local: { get: resolved({}), set: resolved(undefined), remove: resolved(undefined) },
    session: { get: resolved({}), set: resolved(undefined), remove: resolved(undefined) },
    onChanged: { addListener: noop, removeListener: noop },
  },
  tabs: {
    query: resolved([{ id: 1, url: 'https://boards.greenhouse.io/alderman-roe/jobs/4821' }]),
    sendMessage: resolved(null),
    create: resolved(undefined),
    onActivated: { addListener: noop, removeListener: noop },
    onUpdated: { addListener: noop, removeListener: noop },
  },
  sidePanel: { open: resolved(undefined), setPanelBehavior: resolved(undefined) },
}

// biome-ignore lint/suspicious/noExplicitAny: a deliberate partial stand-in for the real API
;(globalThis as any).chrome = stub
