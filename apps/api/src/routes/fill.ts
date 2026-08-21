import { ApiErrorResponse, isPresetInstruction } from '@aff/shared'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/d1'
import type { AppEnv } from '../env.js'
import { improveAnswer } from '../llm/improve.js'
import { requireAuth } from '../middleware/auth.js'
import {
  consumeQuota,
  enforceLongformQuota,
  enforceQuota,
  feedbackRateLimit,
  rateLimit,
} from '../middleware/quota.js'
import {
  bearerAuth,
  errorResponses,
  FeedbackRequest,
  FillPlan,
  FillRequest,
} from '../openapi/schemas.js'
import { recordFeedback } from '../services/answer-bank.js'
import { runFill, writeFillLog, writeRewriteLog } from '../services/fill.js'

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
      plan: account.quota.plan,
      quotaRemaining: account.quota.limit - account.quota.used,
      longRemaining: account.quota.longLimit - account.quota.longUsed,
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

  /**
   * Charged per answer the model wrote, and nothing else.
   *
   * Tier 0 is excluded because it is a lookup against the user's own saved information: no model
   * call, no cost to us, and charging for it would mean billing somebody for typing their own
   * name. In the data behind these plan sizes that was a third of all fields, so the exclusion is
   * worth about half again as much allowance as the headline number suggests.
   *
   * Tier 3 is counted twice over — once as an action and once against the long-answer ceiling —
   * because it costs roughly a hundred times a short answer and is the only thing that can make a
   * plan unaffordable.
   *
   * This replaces a rule that charged one *form* per request and therefore had to exempt
   * `scope: 'field'` entirely, on the reasoning that spending one of fifty forms on a single input
   * would teach people not to use the feature. That reasoning was sound and the unit was the
   * problem: a single field now costs exactly one field.
   */
  const actions = plan.fills.filter((fill) => fill.tier !== 0).length
  const longActions = plan.fills.filter((fill) => fill.tier === 3).length
  const used = await consumeQuota(c.env, userId, account.quota.plan, actions, longActions)

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
  /**
   * Rate limited, in its own bucket, and deliberately **not** quota-counted.
   *
   * Quota is denominated in answers the model wrote. Somebody who has used their last action of
   * the month still deserves their corrections recorded — the entire point of learning is that
   * next month starts smarter, and charging for teaching us something would make the product
   * worse at the one thing it is for. `learningBudget` bounds the work instead.
   */
  middleware: [feedbackRateLimit] as const,
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
  const { quota } = c.get('account')
  const recorded = await recordFeedback(
    drizzle(c.env.DB),
    c.env,
    c.get('userId'),
    quota.plan,
    payload,
  )
  return c.json({ recorded }, 200)
})

/**
 * Rewrite one answer. One AI action, and one long answer.
 *
 * This used to be free. The reasoning was that the allowance was denominated in *forms*, so
 * charging a whole form for polishing one sentence would force a choice between improving an
 * answer and filling another page. That was true, and it made the most expensive request in the
 * product the only unmetered one: `improveAnswer` runs on the tier-3 frontier model with an extra
 * memory search, about a hundred times the cost of a short answer.
 *
 * Metering it per action removes the dilemma the old comment was worried about — a rewrite now
 * costs the same as one field, which is what it is — and it counts against the long-answer ceiling
 * because that is the ceiling its cost belongs to.
 */
const improveRoute = createRoute({
  method: 'post',
  path: '/improve',
  tags: ['fill'],
  summary: 'Rewrite a single answer to an instruction',
  operationId: 'improveAnswer',
  security: bearerAuth,
  middleware: [rateLimit, enforceQuota, enforceLongformQuota] as const,
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
            origin: z
              .string()
              .optional()
              .openapi({ description: 'Page the rewrite happened on, for cost accounting only.' }),
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
  const userId = c.get('userId')
  const { quota } = c.get('account')

  /**
   * Typing your own instruction is the paid half of this feature.
   *
   * The presets stay available to anyone with allowance, because they are what makes the feature
   * discoverable and they are the same cost to run. What paying buys is asking for something we did
   * not think of — which is also the version people reach for on the answers that matter most.
   */
  if (quota.plan === 'free' && !isPresetInstruction(body.instruction)) {
    throw new ApiErrorResponse(
      'LIMIT_EXCEEDED',
      'Your own instructions are part of Pro. The preset rewrites are available now.',
    )
  }

  const startedAt = Date.now()
  const result = await improveAnswer({
    env: c.env,
    userId,
    label: body.label,
    value: body.value,
    instruction: body.instruction,
    ...(body.maxLength ? { maxLength: body.maxLength } : {}),
  })

  // Logged before charging, and charged only for work done — the same order, and for the same
  // reason, as the form fill above.
  await writeRewriteLog(drizzle(c.env.DB), userId, {
    origin: body.origin ?? '',
    usage: result.usage,
    costMicroUsd: result.costMicroUsd,
    latencyMs: Date.now() - startedAt,
    model: result.model,
  })
  await consumeQuota(c.env, userId, c.get('account').quota.plan, 1, 1)

  return c.json({ value: result.value }, 200)
})
