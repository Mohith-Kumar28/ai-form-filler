import { ApiErrorResponse } from '@aff/shared'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import type { Env } from '../env.js'
import type { ModelSpec } from './models.js'

/**
 * All inference goes through **Cloudflare AI Gateway with Unified Billing**.
 *
 * There are no provider accounts and no provider API keys: credits are loaded into
 * Cloudflare, and it settles with Anthropic and Google AI Studio directly. One credential,
 * one invoice, and request logging plus analytics for free. Swapping a model means editing
 * an id in `models.ts` — never adding a key.
 *
 * **Provider-native endpoints are used deliberately, not the OpenAI-compat one.** The compat
 * layer normalises requests to OpenAI's schema, and `cache_control` is Anthropic-specific
 * with no OpenAI equivalent — routing tier 3 through it would silently drop the prompt
 * cache. That is a ~10x cost difference that produces no error message. Native endpoints
 * forward the provider's own request body untouched.
 *
 * Verify after any change here with `pnpm db:costs`, which warns when the cache is never hit.
 */
/**
 * Supermemory's AI SDK wrapper is NOT used, deliberately.
 *
 * `@supermemory/tools@2.1.1` is built against `@ai-sdk/provider@4` — LanguageModelV2 — while
 * `ai@7` produces LanguageModelV4. The wrapper would be rewriting a request spec it does not
 * understand, and casting past the type error compiles but breaks at runtime.
 *
 * Memory is used through its REST API instead (`services/supermemory.ts`), which is
 * version-independent and gives us per-tier control the wrapper does not: retrieval runs for
 * tier 3 only, where a long-form answer benefits from it, rather than on every dropdown.
 *
 * Revisit when the package ships a v4-compatible build.
 */
/**
 * What every inference call is tagged with in AI Gateway's logs.
 *
 * Without this, every request in the dashboard is an anonymous row: you can see that spend
 * happened and not who caused it, which feature caused it, or which tier. That is exactly
 * the information needed to answer the two questions that actually come up — "why did the
 * bill move" and "why is this user's fill bad" — and it cannot be reconstructed afterwards,
 * because the logs are all there is.
 *
 * `user` is our internal user id, never an email. It is the join key back to `fill_log` and
 * to the user row, so support and cost attribution both work, while the gateway's logs stay
 * free of anything that identifies a person on its own.
 *
 * Kept to five keys deliberately: Cloudflare caps custom metadata, and a tag nobody filters
 * on is a tag that costs payload on every request for nothing.
 */
export interface GatewayMetadata {
  /** Internal user id. Never an email or a name. */
  user: string
  /** Which part of the product spent the money. */
  feature: 'fill' | 'ingest' | 'improve'
  /** Tier for a fill; absent elsewhere. The single biggest driver of per-request cost. */
  tier?: number
  /** The site the form was on — a hostname, for spotting a site that answers badly. */
  origin?: string
}

export function resolveModel(env: Env, spec: ModelSpec, meta?: GatewayMetadata): LanguageModel {
  const base = (env.AI_GATEWAY_URL ?? '').replace(/\/$/, '')

  if (base === '') {
    throw new ApiErrorResponse(
      'INTERNAL',
      'AI_GATEWAY_URL is not configured. See apps/api/.dev.vars.example.',
    )
  }

  // Unified Billing authenticates with a Cloudflare token in `cf-aig-authorization`; the
  // provider's own auth header is empty because there is no provider account behind it.
  const headers: Record<string, string> = {
    'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN ?? ''}`,
  }

  if (meta) {
    // Values must be primitives; the gateway rejects a nested object outright rather than
    // flattening it, and a rejected header takes the whole request with it.
    headers['cf-aig-metadata'] = JSON.stringify({
      user: meta.user,
      feature: meta.feature,
      model: spec.modelId,
      ...(meta.tier !== undefined ? { tier: meta.tier } : {}),
      ...(meta.origin ? { origin: meta.origin } : {}),
    })
  }

  if (spec.family === 'anthropic') {
    return createAnthropic({
      baseURL: `${base}/anthropic/v1`,
      apiKey: '',
      headers,
    })(spec.modelId)
  }

  // `/v1beta`, not `/v1`. Google only exposes function calling on the beta path, and the
  // whole fill design depends on a forced tool call — `/v1` answers plain generation fine
  // and then rejects tools with "Function calling is not enabled for api version v1".
  return createGoogleGenerativeAI({
    baseURL: `${base}/google-ai-studio/v1beta`,
    apiKey: '',
    headers,
  })(spec.modelId)
}
