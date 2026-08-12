import type { Account } from '@aff/shared'

export interface Env {
  DB: D1Database
  RATE_LIMIT: KVNamespace
  UPLOADS: R2Bucket

  ENVIRONMENT: 'development' | 'production'
  /** `chrome-extension://<id>` — the only origin allowed through CORS in production. */
  EXTENSION_ORIGIN?: string

  /** OAuth client ID. Every inbound Google token is checked against this — see auth.ts. */
  GOOGLE_CLIENT_ID: string
  /** HMAC key for our own session JWTs. */
  JWT_SECRET: string

  OPENROUTER_API_KEY: string
  ANTHROPIC_API_KEY: string

  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}

/** Populated by the auth middleware; every route below it can rely on `user` existing. */
export interface Variables {
  userId: string
  account: Account
}

export type AppEnv = { Bindings: Env; Variables: Variables }
