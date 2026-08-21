import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
import { bearerAuth, errorResponses } from '../openapi/schemas.js'
import { createCheckout, createPortal, getDodoCustomerId } from '../services/billing.js'

const CheckoutRequest = z
  .object({
    country: z.string().min(2).max(2).optional(),
    /**
     * Ask for the trial rather than a plan picker.
     *
     * A flag rather than a plan name because there is only one trial on offer — 14 days of Pro —
     * and the client is not the right place to decide which product that is. `false` (or absent)
     * gets Collection Checkout, where Dodo shows Pro and Ultra side by side.
     */
    trial: z.boolean().optional(),
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
  const { country, trial } = c.req.valid('json')
  const account = c.get('account')

  /**
   * A trial is offered once, and the server decides that — not the caller.
   *
   * Asking for `trial: true` with a subscription already on file would otherwise hand a second
   * free fortnight to anyone who called the endpoint directly. Dodo's own "Prevent Trial Misuse"
   * setting is the durable backstop across accounts; this is the cheap check for the same account.
   */
  const eligible = trial === true && account.subscription == null

  const checkoutUrl = await createCheckout(c.env, {
    userId: c.get('userId'),
    email: account.email,
    country: country ?? 'US',
    trial: eligible,
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
