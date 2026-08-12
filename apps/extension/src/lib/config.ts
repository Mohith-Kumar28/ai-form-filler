/**
 * Set `WXT_API_URL` in `.env` to point a build at a deployed Worker. WXT inlines any
 * `WXT_`-prefixed var at build time, so this is a compile-time constant, not a runtime read.
 */
export const API_URL = import.meta.env.WXT_API_URL ?? 'http://127.0.0.1:8787'

export const STORAGE_KEYS = {
  sessionToken: 'aff:sessionToken',
  account: 'aff:account',
  queryCache: 'aff:queryCache',
} as const
