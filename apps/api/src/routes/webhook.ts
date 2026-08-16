import { ApiErrorResponse } from '@aff/shared'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Webhook } from 'standardwebhooks'
import type { AppEnv } from '../env.js'
import { applyWebhook } from '../services/billing.js'

export const webhookRoutes = new OpenAPIHono<AppEnv>()

webhookRoutes.post('/webhook', async (c) => {
  const rawBody = await c.req.text()

  const webhookId = c.req.header('webhook-id')
  const webhookSignature = c.req.header('webhook-signature')
  const webhookTimestamp = c.req.header('webhook-timestamp')

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'Missing webhook headers')
  }

  const wh = new Webhook(c.env.DODO_WEBHOOK_SECRET)

  try {
    wh.verify(rawBody, {
      'webhook-id': webhookId,
      'webhook-signature': webhookSignature,
      'webhook-timestamp': webhookTimestamp,
    })
  } catch {
    throw new ApiErrorResponse('INVALID_REQUEST', 'Invalid webhook signature')
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    throw new ApiErrorResponse('INVALID_REQUEST', 'Invalid webhook body')
  }

  await applyWebhook(
    c.env,
    event as {
      type: string
      data: {
        subscription_id: string
        customer: { customer_id: string }
        metadata?: Record<string, string>
      }
    },
    webhookId,
  )

  return c.json({ received: true }, 200)
})
