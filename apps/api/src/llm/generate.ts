import { ApiErrorResponse, type Fill, type FillTier, type Skip } from '@aff/shared'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, tool } from 'ai'
import { costMicroUsd, MODELS, type TokenUsage } from './models.js'
import type { UserMessageInput } from './prompt.js'
import { buildSystemBlocks, buildUserMessage, SubmitFillsSchema } from './prompt.js'

export interface GenerateInput extends UserMessageInput {
  tier: Exclude<FillTier, 0>
  profileDoc: string
  apiKey: string
}

export interface GenerateResult {
  fills: Fill[]
  skipped: Skip[]
  usage: TokenUsage
  costMicroUsd: number
  model: string
}

/**
 * Pulls cache-hit counts out of the provider's usage payload.
 *
 * The AI SDK normalises the common fields but leaves cache counters in `providerMetadata`,
 * where the key differs per provider. Anthropic reports them under `anthropic`; OpenRouter
 * forwards them under `openrouter`. Reading both is what keeps the caching assertion honest
 * regardless of which route the request took.
 */
function readCacheCounters(metadata: unknown): { read: number; write: number } {
  const meta = metadata as Record<string, Record<string, unknown> | undefined> | undefined

  const anthropic = meta?.anthropic ?? {}
  const openrouter = meta?.openrouter ?? {}

  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0

  return {
    read: num(anthropic.cacheReadInputTokens) || num(openrouter.cachedTokens),
    write: num(anthropic.cacheCreationInputTokens),
  }
}

/**
 * One model call for one tier's worth of fields.
 *
 * Uses `generateText` with a **fixed** tool rather than `generateObject`. See prompt.ts —
 * `generateObject` builds a new tool per schema, which would silently break prompt caching.
 */
export async function generateFills(input: GenerateInput): Promise<GenerateResult> {
  const spec = MODELS[input.tier]
  const openrouter = createOpenRouter({ apiKey: input.apiKey })

  const [instructions, profile] = buildSystemBlocks(input.profileDoc)

  const captured: { fills: Fill[]; skipped: Skip[] } = { fills: [], skipped: [] }

  const submitFills = tool({
    description: 'Return the answers for every field you were given.',
    inputSchema: SubmitFillsSchema,
    execute: async (args) => {
      captured.fills = args.fills.map((f) => ({
        fieldId: f.fieldId,
        value: f.value,
        confidence: f.confidence,
        tier: input.tier,
        ...(f.reasoning ? { reasoning: f.reasoning } : {}),
      }))
      captured.skipped = args.skipped.map((s) => ({
        fieldId: s.fieldId,
        reason: 'no_matching_knowledge' as const,
        detail: s.reason,
      }))
      return 'recorded'
    },
  })

  // Inference has to flow from the call: annotating the result with
  // `Awaited<ReturnType<typeof generateText>>` erases the tool-set type parameter and the
  // assignment stops compiling. Hence `.catch()` rather than a try/catch around an
  // explicitly-typed binding.
  const result = await generateText({
    model: openrouter(spec.id),
    // Cache breakpoint on the profile block — the last stable thing before the variable
    // user message. Providers that do not support caching ignore the annotation.
    messages: [
      { role: 'system', content: instructions ?? '' },
      {
        role: 'system',
        content: profile ?? '',
        ...(spec.supportsCaching
          ? {
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } },
                openrouter: { cacheControl: { type: 'ephemeral', ttl: '1h' } },
              },
            }
          : {}),
      },
      { role: 'user', content: buildUserMessage(input) },
    ],
    tools: { submit_fills: submitFills },
    // Force the tool so the model cannot answer in prose and leave us nothing to parse.
    toolChoice: { type: 'tool', toolName: 'submit_fills' },
  }).catch((cause: unknown) => {
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      `Model call failed: ${cause instanceof Error ? cause.message : 'unknown error'}`,
    )
  })

  const cache = readCacheCounters(result.providerMetadata)
  const usage: TokenUsage = {
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cacheReadTokens: cache.read,
    cacheWriteTokens: cache.write,
  }

  return {
    fills: captured.fills,
    skipped: captured.skipped,
    usage,
    costMicroUsd: costMicroUsd(spec, usage),
    model: spec.id,
  }
}
