import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/d1'
import type { AppEnv } from '../env.js'
import { improveAnswer } from '../llm/improve.js'
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

  /**
   * Log first, then charge, and only charge for work.
   *
   * Two separate faults were here. A form whose fields were all already filled produces an
   * empty plan and makes no model call, yet still cost the user one of their monthly forms —
   * they paid for nothing. And `writeFillLog` ran *after* `consumeQuota`, so a log-write
   * failure returned a 500 on a request whose quota had already been spent, costing them a
   * form for an error on our side.
   */
  await writeFillLog(db, userId, request, plan, tierCounts)

  const didWork = plan.fills.length > 0 || plan.usage.costMicroUsd > 0
  const used = didWork ? await consumeQuota(c.env, userId) : account.quota.used

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
  const recorded = await recordFeedback(drizzle(c.env.DB), c.env, c.get('userId'), payload)
  return c.json({ recorded }, 200)
})

/**
 * Rewrite one answer.
 *
 * Rate-limited like a fill but **not** quota-counted. Quota is denominated in forms, and
 * charging a form for polishing one sentence would make the user choose between improving an
 * answer and filling another page — which is exactly the wrong thing to make them weigh.
 */
const improveRoute = createRoute({
  method: 'post',
  path: '/improve',
  tags: ['fill'],
  summary: 'Rewrite a single answer to an instruction',
  operationId: 'improveAnswer',
  security: bearerAuth,
  middleware: [rateLimit] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            label: z.string().openapi({ description: 'The question being answered.' }),
            value: z.string().min(1),
            instruction: z
              .string()
              .min(1)
              .openapi({ description: "A preset instruction or the user's own words." }),
            maxLength: z.number().int().positive().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'The rewritten answer',
      content: { 'application/json': { schema: z.object({ value: z.string() }) } },
    },
    ...errorResponses,
  },
})

fillRoutes.openapi(improveRoute, async (c) => {
  const body = c.req.valid('json')
  const value = await improveAnswer({
    env: c.env,
    userId: c.get('userId'),
    label: body.label,
    value: body.value,
    instruction: body.instruction,
    ...(body.maxLength ? { maxLength: body.maxLength } : {}),
  })
  return c.json({ value }, 200)
})
