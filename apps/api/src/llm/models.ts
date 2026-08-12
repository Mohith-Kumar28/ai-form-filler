import type { FillTier } from '@aff/shared'

/**
 * Per-tier model selection and pricing.
 *
 * Prices are USD per million tokens, as listed by OpenRouter. They are used only to record
 * cost in `fill_log` — the number that decides whether the free tier is affordable — so an
 * outdated entry produces misleading accounting rather than a wrong charge. Re-check when
 * changing a model id.
 */
export interface ModelSpec {
  /** OpenRouter model id. */
  id: string
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
    id: 'google/gemini-2.5-flash-lite',
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
    cacheReadMultiplier: 1,
    cacheWriteMultiplier: 1,
    supportsCaching: false,
  },
  2: {
    id: 'google/gemini-2.5-flash',
    inputPerMTok: 0.3,
    outputPerMTok: 2.5,
    cacheReadMultiplier: 1,
    cacheWriteMultiplier: 1,
    supportsCaching: false,
  },
  3: {
    id: 'anthropic/claude-opus-4.1',
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheReadMultiplier: 0.1,
    cacheWriteMultiplier: 1.25,
    supportsCaching: true,
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
