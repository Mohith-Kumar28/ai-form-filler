import { ApiErrorResponse } from '@aff/shared'
import { drizzle } from 'drizzle-orm/d1'
import { createMiddleware } from 'hono/factory'
import { verifySessionToken } from '../auth/session.js'
import type { AppEnv } from '../env.js'
import { loadAccount } from '../services/account.js'

/** Populates `userId` and `account`. Every route mounted under this can assume both exist. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new ApiErrorResponse('UNAUTHENTICATED', 'Missing bearer token')
  }

  const userId = await verifySessionToken(header.slice('Bearer '.length), c.env.JWT_SECRET)
  const account = await loadAccount(drizzle(c.env.DB), userId)

  // A valid signature for a deleted user. Treat as unauthenticated, not as a 500.
  if (!account) {
    throw new ApiErrorResponse('UNAUTHENTICATED', 'Account no longer exists')
  }

  c.set('userId', userId)
  c.set('account', account)
  await next()
})
