import type { Account } from '@aff/shared'

export interface Env {
  DB: D1Database
  RATE_LIMIT: KVNamespace
  /**
   * Original uploads. A blob store, deliberately not a search index — that was the job it
   * held before and the job memory took over. Files live here so a source can be previewed
   * and so a stored resume can be attached to a form's file input.
   */
  UPLOADS: R2Bucket

  ENVIRONMENT: 'development' | 'production'
  /** `chrome-extension://<id>` — the only origin allowed through CORS in production. */
  EXTENSION_ORIGIN?: string

  /** OAuth client ID. Every inbound Google token is checked against this — see auth.ts. */
  GOOGLE_CLIENT_ID: string
  /** HMAC key for our own session JWTs. */
  JWT_SECRET: string

  /**
   * Cloudflare AI Gateway endpoint. All inference goes through it.
   *   https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_name>
   */
  AI_GATEWAY_URL: string

  /** Cloudflare API token with "AI Gateway Run" — the only inference credential. */
  AI_GATEWAY_TOKEN: string

  /**
   * Supermemory. Owns ingestion of every format, storage of the originals, and retrieval.
   *
   * Required, not optional. It previously had a fallback path — local PDF extraction, an R2
   * bucket, Cloudflare AI Search, and BM25 over a D1 answer bank — which was a second full
   * implementation of the same job, permanently less capable and separately debuggable.
   * Carrying both meant every ingest and every retrieval had two behaviours to reason about.
   */
  SUPERMEMORY_API_KEY: string

  /*
   * `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` were declared here and read by nothing —
   * migration 0001 dropped the Stripe columns and Dodo has owned billing since. A declared
   * credential nobody uses still has to be explained to whoever pushes secrets next.
   */

  DODO_PAYMENTS_API_KEY: string
  DODO_WEBHOOK_SECRET: string
  /** 'test_mode' | 'live_mode' — passed to the Dodo SDK. */
  DODO_ENVIRONMENT: 'test_mode' | 'live_mode'
  /**
   * JSON mapping of plan → currency → Dodo product id.
   * Example: '{"pro":{"usd":"pdt_abc","inr":"pdt_def"},"ultra":{"usd":"pdt_ghi","inr":"pdt_jkl"}}'
   */
  DODO_PRODUCT_IDS: string
  /**
   * JSON: {"usd":"pdc_...","inr":"pdc_..."} — collection ids for collection checkout.
   */
  DODO_COLLECTION_IDS: string
}

/** Populated by the auth middleware; every route below it can rely on `user` existing. */
export interface Variables {
  userId: string
  account: Account
}

export type AppEnv = { Bindings: Env; Variables: Variables }
