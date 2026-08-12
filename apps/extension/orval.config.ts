import { defineConfig } from 'orval'

/**
 * Generates the typed client and TanStack Query hooks from the backend's OpenAPI document.
 *
 * The spec is produced by `pnpm --filter @aff/api openapi:emit`, so the backend's Zod
 * schemas are the single source of truth all the way through to the React hooks. Adding a
 * route on the server is the only step needed to get a typed hook here — there is no
 * hand-written client left to drift.
 *
 * Regenerate with: pnpm api:generate
 */
export default defineConfig({
  aff: {
    input: {
      target: '../api/openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated/endpoints',
      schemas: './src/generated/model',
      client: 'react-query',
      // Generated code is a build artifact — never hand-edit it, so never lint it either.
      prettier: false,
      clean: true,
      override: {
        // Every request goes through our own fetcher: it attaches the bearer token from
        // chrome.storage and converts the ApiError envelope into a typed throw.
        mutator: {
          path: './src/lib/http-client.ts',
          name: 'httpClient',
        },
        fetch: {
          // Return the payload directly instead of a `{ data, status }` union. We throw on
          // non-2xx, so the error arms of that union could never be reached — keeping them
          // would force every call site to narrow a status that never occurs.
          includeHttpResponseReturnType: false,
        },
        query: {
          // Neither `useQuery` nor `useMutation` is set on purpose. Each flag *forces* its
          // hook type onto every operation — `useQuery: true` gave POST routes a query hook
          // with no `.mutate`, and `useMutation: true` turned the GETs into mutations.
          // Unset, orval picks by HTTP method: GET → query, everything else → mutation.
          signal: true,
        },
      },
    },
  },
})
