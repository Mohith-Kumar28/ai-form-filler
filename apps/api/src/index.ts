import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './env.js'
import { onError } from './middleware/error.js'
import { authRoutes } from './routes/auth.js'
import { billingRoutes } from './routes/billing.js'
import { fillRoutes } from './routes/fill.js'
import { meRoutes } from './routes/me.js'
import { profileRoutes } from './routes/profile.js'
import { webhookRoutes } from './routes/webhook.js'

const app = new OpenAPIHono<AppEnv>({
  /**
   * Route the framework's own validation failures through our error envelope, so the client
   * has exactly one error shape to parse rather than two.
   */
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          code: 'INVALID_REQUEST' as const,
          message: 'Request failed validation',
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        400,
      )
    }
  },
})

app.onError(onError)
app.use('*', secureHeaders())

/**
 * Only our own extension may call this API. `chrome-extension://` origins are opaque and
 * unguessable, so an allow-list of them is a meaningful control rather than theatre — but it
 * is defence in depth, not authentication. Every real check is the bearer token.
 */
app.use('/v1/*', async (c, next) => {
  const allowed = new Set<string>()
  if (c.env.EXTENSION_ORIGIN) allowed.add(c.env.EXTENSION_ORIGIN)
  if (c.env.ENVIRONMENT === 'development') allowed.add('http://localhost:3000')

  return cors({
    origin: (origin) => (allowed.has(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true, environment: c.env.ENVIRONMENT }))

/**
 * Post-checkout landing page. Dodo redirects the customer here after payment; Chrome refuses
 * to navigate to a `chrome-extension://` URL, so this lives on the Worker instead. It only
 * tells the user to go back to the panel — the webhook is what actually flips the plan.
 */
app.get('/v1/billing/return', (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment complete — Fillaform</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #f4f2ee; color: #1a1a1a; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      main { text-align: center; padding: 2rem; }
      h1 { font-size: 1.5rem; font-weight: 600; }
      p { color: #555; }
    </style>
  </head>
  <body>
    <main>
      <h1>Payment complete</h1>
      <p>You can close this tab. Your plan is updating in the extension — reopen the side panel to see it.</p>
    </main>
  </body>
</html>`),
)

app.route('/v1/auth', authRoutes)
app.route('/v1/me', meRoutes)
app.route('/v1/profile', profileRoutes)
app.route('/v1/fill', fillRoutes)
app.route('/v1/billing', billingRoutes)
app.route('/v1/billing', webhookRoutes)

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

/**
 * The generated client's source of truth. `orval` reads this during
 * `pnpm --filter @aff/extension api:generate`, so adding a route here is all it takes for a
 * typed hook to appear in the extension — there is no hand-written client to keep in sync.
 */
app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'Fillaform API', version: '0.1.0' },
})

export default app
