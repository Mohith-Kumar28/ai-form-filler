import type { FillTier } from '@aff/shared'

/**
 * Per-tier model selection and pricing.
 *
 * Prices are USD per million tokens as billed by the provider. They are used only to record
 * cost in `fill_log` — the number that decides whether the free tier is affordable — so an
 * outdated entry produces misleading accounting rather than a wrong charge. Re-check when
 * changing a model id.
 */
export interface ModelSpec {
  /** Which native API this model speaks, when routed through AI Gateway. */
  family: 'anthropic' | 'google'
  /** Model id as the provider's own API names it. */
  modelId: string
  inputPerMTok: number
  outputPerMTok: number
  /** Cache reads bill at a fraction of input. Only Anthropic models support this today. */
  cacheReadMultiplier: number
  /** Cache writes carry a premium; break-even is two requests within the TTL. */
  cacheWriteMultiplier: number
  supportsCaching: boolean
}

export const MODELS: Record<Exclude<FillTier, 0>, ModelSpec> = {
  1: {
    family: 'google',
    modelId: 'gemini-2.5-flash-lite',
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
    cacheReadMultiplier: 1,
    cacheWriteMultiplier: 1,
    supportsCaching: false,
  },
  2: {
    family: 'google',
    modelId: 'gemini-2.5-flash',
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    cacheReadMultiplier: 1,
    cacheWriteMultiplier: 1,
    supportsCaching: false,
  },
  /**
   * Long-form answers. Gemini 2.5 Pro rather than a frontier Anthropic model: at $1.25/$10
   * it is roughly a quarter the price of Opus for prose that a reader cannot tell apart,
   * and staying inside one provider family keeps the whole path on one API shape.
   */
  3: {
    family: 'google',
    modelId: 'gemini-2.5-pro',
    inputPerMTok: 1.25,
    outputPerMTok: 10,
    cacheReadMultiplier: 1,
    cacheWriteMultiplier: 1,
    supportsCaching: false,
  },
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/**
 * Cost in **micro-dollars as an integer**, so money never touches a float on its way into
 * D1. Cached reads and writes are priced off the input rate by their multipliers.
 */
export function costMicroUsd(spec: ModelSpec, usage: TokenUsage): number {
  const uncachedInput = Math.max(
    0,
    usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens,
  )

  const dollars =
    (uncachedInput * spec.inputPerMTok) / 1_000_000 +
    (usage.cacheReadTokens * spec.inputPerMTok * spec.cacheReadMultiplier) / 1_000_000 +
    (usage.cacheWriteTokens * spec.inputPerMTok * spec.cacheWriteMultiplier) / 1_000_000 +
    (usage.outputTokens * spec.outputPerMTok) / 1_000_000

  return Math.round(dollars * 1_000_000)
}
