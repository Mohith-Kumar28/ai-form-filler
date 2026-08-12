import { type ApiError, ApiErrorResponse } from '@aff/shared'
import { API_URL, STORAGE_KEYS } from './config.js'
import { readLocal, removeLocal } from './storage.js'

/**
 * The single transport behind every generated endpoint.
 *
 * orval generates the URL, method, and types; this supplies the three things an OpenAPI
 * document cannot describe — where the API lives, how requests are authenticated, and how
 * the error envelope becomes a typed throw. Keeping it in one place is what stops auth and
 * error handling from drifting between endpoints.
 *
 * Signature is orval's fetch-mutator contract: `(url, RequestInit) => Promise<T>`.
 */
export async function httpClient<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await readLocal<string>(STORAGE_KEYS.sessionToken)

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  // FormData must carry no explicit Content-Type — the browser has to set it so the
  // multipart boundary matches the body. orval sets a JSON type on non-form requests only,
  // but strip it defensively so an upload can never be sent with the wrong type.
  if (init.body instanceof FormData) headers.delete('Content-Type')

  const absolute = url.startsWith('http') ? url : `${API_URL}${url}`

  let response: Response
  try {
    response = await fetch(absolute, { ...init, headers })
  } catch (cause) {
    // No response at all, so there is no envelope to parse.
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      cause instanceof Error ? cause.message : 'Network request failed',
    )
  }

  if (response.status === 204) return undefined as T
  if (response.ok) return (await response.json()) as T

  let error: ApiError
  try {
    error = (await response.json()) as ApiError
  } catch {
    // A non-2xx without our envelope came from in front of the Worker — a proxy or a
    // platform error — and carries nothing structured to surface.
    throw new ApiErrorResponse('UPSTREAM_ERROR', `Unexpected ${response.status} from the API`)
  }

  // An expired or revoked session must not leave a dead token behind to retry with.
  if (error.code === 'UNAUTHENTICATED' || error.code === 'INVALID_TOKEN') {
    await removeLocal([STORAGE_KEYS.sessionToken, STORAGE_KEYS.account])
  }

  const { code, message, ...extra } = error
  throw new ApiErrorResponse(code, message, extra)
}

/** orval references the mutator's error and body types by name. */
export type ErrorType<_E = unknown> = ApiErrorResponse
export type BodyType<T> = T

export default httpClient
