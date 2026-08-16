import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
import { bearerAuth, errorResponses } from '../openapi/schemas.js'
import { createCheckout, createPortal, getDodoCustomerId } from '../services/billing.js'

const CheckoutRequest = z
  .object({
    country: z.string().min(2).max(2).optional(),
  })
  .openapi('CheckoutRequest')

const CheckoutResponse = z.object({ checkoutUrl: z.string() }).openapi('CheckoutResponse')

const PortalResponse = z.object({ portalUrl: z.string() }).openapi('PortalResponse')

const checkoutRoute = createRoute({
  method: 'post',
  path: '/checkout',
  tags: ['billing'],
  summary: 'Create a Dodo checkout session to upgrade',
  operationId: 'createCheckout',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: CheckoutRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Checkout URL',
      content: { 'application/json': { schema: CheckoutResponse } },
    },
    ...errorResponses,
  },
})

const portalRoute = createRoute({
  method: 'get',
  path: '/portal',
  tags: ['billing'],
  summary: 'Get the Dodo customer portal URL to manage subscription',
  operationId: 'getPortal',
  security: bearerAuth,
  responses: {
    200: {
      description: 'Portal URL',
      content: { 'application/json': { schema: PortalResponse } },
    },
    ...errorResponses,
  },
})

export const billingRoutes = new OpenAPIHono<AppEnv>()

billingRoutes.use('/checkout', requireAuth)
billingRoutes.use('/portal', requireAuth)

billingRoutes.openapi(checkoutRoute, async (c) => {
  const { country } = c.req.valid('json')
  const account = c.get('account')

  const checkoutUrl = await createCheckout(c.env, {
    userId: c.get('userId'),
    email: account.email,
    country: country ?? 'US',
  })

  return c.json({ checkoutUrl }, 200)
})

billingRoutes.openapi(portalRoute, async (c) => {
  const dodoCustomerId = await getDodoCustomerId(c.env, c.get('userId'))
  if (!dodoCustomerId) {
    return c.json({ portalUrl: '' }, 200)
  }

  const portalUrl = await createPortal(c.env, dodoCustomerId)
  return c.json({ portalUrl }, 200)
})
