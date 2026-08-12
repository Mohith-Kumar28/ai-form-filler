import { ApiErrorResponse, type Request, type ResponseFor, type Result } from '@aff/shared'

/**
 * Typed wrapper over `chrome.runtime.sendMessage`.
 *
 * Normalises the two independent ways a runtime call fails — a rejected promise, and a
 * silently-set `chrome.runtime.lastError` alongside an `undefined` response — into one
 * `Result`, so no call site has to remember to check both.
 */
export async function sendMessage<R extends Request>(request: R): Promise<Result<ResponseFor<R>>> {
  try {
    const response = await chrome.runtime.sendMessage(request)
    if (chrome.runtime.lastError) {
      return {
        ok: false,
        error: { code: 'INTERNAL', message: chrome.runtime.lastError.message ?? 'Runtime error' },
      }
    }
    return response as Result<ResponseFor<R>>
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'INTERNAL', message: cause instanceof Error ? cause.message : String(cause) },
    }
  }
}

/** Wraps a handler so thrown errors become the `Result` error branch rather than a dropped port. */
export async function toResult<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (cause) {
    if (cause instanceof ApiErrorResponse) {
      return { ok: false, error: cause.toJSON() }
    }
    return {
      ok: false,
      error: { code: 'INTERNAL', message: cause instanceof Error ? cause.message : String(cause) },
    }
  }
}
