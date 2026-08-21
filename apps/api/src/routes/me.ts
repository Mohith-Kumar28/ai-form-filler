import { ApiErrorResponse } from '@aff/shared'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
import {
  Account,
  bearerAuth,
  DeleteAccountRequest,
  DeleteAccountResponse,
  errorResponses,
} from '../openapi/schemas.js'
import { confirmationMatches, deleteAccount } from '../services/delete-account.js'

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

/**
 * `POST /delete`, not `DELETE /`.
 *
 * The request carries a body — the typed confirmation — and a body on `DELETE` is the corner of
 * HTTP where intermediaries, CORS preflights and `fetch` polyfills all behave slightly
 * differently. Not worth discovering which one drops it on the request that erases an account.
 */
const deleteAccountRoute = createRoute({
  method: 'post',
  path: '/delete',
  tags: ['account'],
  summary: 'Permanently delete the account and everything in it',
  description:
    'Irreversible. Cancels the subscription, deletes every stored document and uploaded file, ' +
    'and removes every row belonging to the user. Existing session tokens stop working ' +
    'immediately, on every device.',
  operationId: 'deleteAccount',
  security: bearerAuth,
  request: {
    body: {
      content: { 'application/json': { schema: DeleteAccountRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'The account and all its data are gone',
      content: { 'application/json': { schema: DeleteAccountResponse } },
    },
    ...errorResponses,
  },
})

export const meRoutes = new OpenAPIHono<AppEnv>()

meRoutes.use('*', requireAuth)

/** Polled on side-panel open to refresh plan and quota. */
meRoutes.openapi(getMeRoute, (c) => c.json(c.get('account'), 200))

meRoutes.openapi(deleteAccountRoute, async (c) => {
  const { confirmEmail } = c.req.valid('json')
  const account = c.get('account')

  /**
   * The last gate, and the only one an attacker has to get through.
   *
   * Everything in front of this is a dialog in the side panel, which is to say it does not
   * exist as far as the API is concerned. Someone who holds a session token — a shared machine,
   * a stolen laptop still signed in — reaches this endpoint directly, and the email is what they
   * would have to know. It is a weak secret and deliberately so: this is a deliberateness check,
   * not authentication. The bearer token is the authentication.
   */
  if (!confirmationMatches(confirmEmail, account.email)) {
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      'That is not the email address on this account, so nothing has been deleted.',
    )
  }

  const report = await deleteAccount(c.env, account.id)

  /**
   * `warn`, not `debug`. This is unrecoverable and there is no row left to reconstruct it from, so
   * the log line is the only remaining evidence the request happened at all.
   */
  console.warn('[aff] account deleted', {
    userId: account.id,
    documents: report.documents,
    files: report.files,
    subscription: report.subscription,
  })

  return c.json(report, 200)
})
