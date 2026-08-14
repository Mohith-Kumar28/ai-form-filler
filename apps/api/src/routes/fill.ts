import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/d1'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
import { consumeQuota, enforceQuota, rateLimit } from '../middleware/quota.js'
import {
  bearerAuth,
  errorResponses,
  FeedbackRequest,
  FillPlan,
  FillRequest,
} from '../openapi/schemas.js'
import { recordFeedback } from '../services/answer-bank.js'
import { runFill, writeFillLog } from '../services/fill.js'

export const fillRoutes = new OpenAPIHono<AppEnv>()

// Order matters. Auth identifies the user, the rate limiter bounds burst spend, and the
// quota check runs before any provider call — never after, and never on the client.
fillRoutes.use('*', requireAuth)

const fillRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['fill'],
  summary: 'Produce answers for a detected form',
  operationId: 'fillForm',
  security: bearerAuth,
  middleware: [rateLimit, enforceQuota] as const,
  request: {
    body: { content: { 'application/json': { schema: FillRequest } }, required: true },
  },
  responses: {
    200: {
      description: 'Answers, skips, and usage accounting',
      content: { 'application/json': { schema: FillPlan } },
    },
    409: {
      description: 'Profile has no sources yet',
      content: {
        'application/json': { schema: errorResponses[400].content['application/json'].schema },
      },
    },
    ...errorResponses,
  },
})

fillRoutes.openapi(fillRoute, async (c) => {
  const request = c.req.valid('json')
  const db = drizzle(c.env.DB)
  const userId = c.get('userId')
  const account = c.get('account')

  const { plan, tierCounts } = await runFill(
    {
      db,
      userId,
      env: c.env,
      quotaRemaining: account.quota.limit - account.quota.used,
    },
    request,
  )

  // Quota is consumed only after a successful fill, so a failed model call does not cost the
  // user a form. `fill_log` is written regardless — a zero-cost fill still tells us
  // something about the free tier's real economics.
  const used = await consumeQuota(c.env, userId)
  await writeFillLog(db, userId, request, plan, tierCounts)

  return c.json({ ...plan, quotaRemaining: Math.max(0, account.quota.limit - used) }, 200)
})

const feedbackRoute = createRoute({
  method: 'post',
  path: '/feedback',
  tags: ['fill'],
  summary: 'Record what the user actually submitted',
  description:
    'Accepted answers enter the answer bank and become retrieval context for future fills. Edited answers are the highest-signal rows we get.',
  operationId: 'submitFeedback',
  security: bearerAuth,
  request: {
    body: { content: { 'application/json': { schema: FeedbackRequest } }, required: true },
  },
  responses: {
    200: {
      description: 'Recorded',
      content: { 'application/json': { schema: z.object({ recorded: z.number().int() }) } },
    },
    ...errorResponses,
  },
})

fillRoutes.openapi(feedbackRoute, async (c) => {
  const payload = c.req.valid('json')
  const recorded = await recordFeedback(c.env, c.get('userId'), payload)
  return c.json({ recorded }, 200)
})
