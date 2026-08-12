import { ApiErrorResponse } from '@aff/shared'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/d1'
import { verifyGoogleAccessToken } from '../auth/google.js'
import { issueSessionToken } from '../auth/session.js'
import type { AppEnv } from '../env.js'
import { errorResponses, SignInRequest, SignInResponse } from '../openapi/schemas.js'
import { getOrCreateUser, loadAccount } from '../services/account.js'

const signInRoute = createRoute({
  method: 'post',
  path: '/google',
  tags: ['auth'],
  summary: 'Exchange a Google access token for a session token',
  operationId: 'signInWithGoogle',
  request: {
    body: { content: { 'application/json': { schema: SignInRequest } }, required: true },
  },
  responses: {
    200: {
      description: 'Signed in',
      content: { 'application/json': { schema: SignInResponse } },
    },
    ...errorResponses,
  },
})

export const authRoutes = new OpenAPIHono<AppEnv>()

authRoutes.openapi(signInRoute, async (c) => {
  const { accessToken } = c.req.valid('json')

  const identity = await verifyGoogleAccessToken(accessToken, c.env.GOOGLE_CLIENT_ID)

  const db = drizzle(c.env.DB)
  const userId = await getOrCreateUser(db, identity)
  const [token, account] = await Promise.all([
    issueSessionToken(userId, c.env.JWT_SECRET),
    loadAccount(db, userId),
  ])

  if (!account) {
    throw new ApiErrorResponse('INTERNAL', 'Account vanished immediately after creation')
  }

  return c.json({ token, account }, 200)
})
