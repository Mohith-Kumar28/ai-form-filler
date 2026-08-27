/**
 * `API_URL` is re-exported, not defined: it lives in `@aff/shared/deployment` alongside the
 * extension id and OAuth client id, because those four values have to agree across the
 * manifest, the Worker and the site. See that file for why there is no localhost fallback.
 */
export { API_URL } from '@aff/shared/deployment'

export const STORAGE_KEYS = {
  sessionToken: 'aff:sessionToken',
  account: 'aff:account',
  queryCache: 'aff:queryCache',
} as const
