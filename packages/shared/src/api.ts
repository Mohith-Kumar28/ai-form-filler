import { z } from 'zod'

/**
 * Every non-2xx response from the Worker uses this envelope, so the extension has exactly
 * one error path to handle. `code` is what clients branch on; `message` is user-facing.
 */
export const ApiErrorCode = z.enum([
  'UNAUTHENTICATED',
  'INVALID_TOKEN',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'PROFILE_NOT_READY',
  'INVALID_REQUEST',
  'UPSTREAM_ERROR',
  'INTERNAL',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCode>

export const ApiError = z.object({
  code: ApiErrorCode,
  message: z.string(),
  /** Seconds to wait. Set on RATE_LIMITED so the client can back off precisely. */
  retryAfter: z.number().int().nonnegative().optional(),
  /** Set on QUOTA_EXCEEDED so the upgrade prompt can show real numbers. */
  quota: z
    .object({ used: z.number().int(), limit: z.number().int(), resetsAt: z.string() })
    .optional(),
})
export type ApiError = z.infer<typeof ApiError>

export const HTTP_STATUS_FOR_CODE: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID_TOKEN: 401,
  QUOTA_EXCEEDED: 402,
  RATE_LIMITED: 429,
  PROFILE_NOT_READY: 409,
  INVALID_REQUEST: 400,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
}

export class ApiErrorResponse extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly extra: Omit<ApiError, 'code' | 'message'> = {},
  ) {
    super(message)
    this.name = 'ApiErrorResponse'
  }

  get status(): number {
    return HTTP_STATUS_FOR_CODE[this.code]
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, ...this.extra }
  }
}
