import { ApiErrorResponse } from '@aff/shared'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import type { AppEnv } from '../env.js'

/**
 * Single exit point for every failure, so the extension has exactly one error shape to
 * parse. Unknown throws are deliberately flattened to INTERNAL with a generic message —
 * a stack trace or DB error string reaching the client is an information leak.
 */
export function onError(err: Error, c: Context<AppEnv>): Response {
  if (err instanceof ApiErrorResponse) {
    return c.json(err.toJSON(), err.status as ContentfulStatusCode)
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        code: 'INVALID_REQUEST' as const,
        message: 'Request failed validation',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      400,
    )
  }

  console.error('unhandled', { message: err.message, stack: err.stack })
  return c.json({ code: 'INTERNAL' as const, message: 'Something went wrong' }, 500)
}
