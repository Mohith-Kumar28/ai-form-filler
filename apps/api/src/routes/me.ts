import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
import { Account, bearerAuth, errorResponses } from '../openapi/schemas.js'

const getMeRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['account'],
  summary: 'Current account, plan, and quota',
  operationId: 'getAccount',
  security: bearerAuth,
  responses: {
    200: { description: 'The account', content: { 'application/json': { schema: Account } } },
    ...errorResponses,
  },
})

export const meRoutes = new OpenAPIHono<AppEnv>()

meRoutes.use('*', requireAuth)

/** Polled on side-panel open to refresh plan and quota. */
meRoutes.openapi(getMeRoute, (c) => c.json(c.get('account'), 200))
