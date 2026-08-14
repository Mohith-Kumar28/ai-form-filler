import { ApiErrorResponse, type Fill, type FillTier, type Skip } from '@aff/shared'
import { generateText, tool } from 'ai'
import type { Env } from '../env.js'
import { costMicroUsd, MODELS, type TokenUsage } from './models.js'
import type { UserMessageInput } from './prompt.js'
import { buildSystemBlocks, buildUserMessage, SubmitFillsSchema } from './prompt.js'
import { resolveModel } from './provider.js'

export interface GenerateInput extends UserMessageInput {
  tier: Exclude<FillTier, 0>
  profileDoc: string
  /** Carries the AI Gateway endpoint and token. */
  env: Env
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
 * under a provider-specific key. Anthropic reports them under `anthropic`. Google's models
 * do not support explicit caching, so tiers 1-2 legitimately report zero.
 */
function readCacheCounters(metadata: unknown): { read: number; write: number } {
  const meta = metadata as Record<string, Record<string, unknown> | undefined> | undefined

  const anthropic = meta?.anthropic ?? {}

  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0

  return {
    read: num(anthropic.cacheReadInputTokens),
    write: num(anthropic.cacheCreationInputTokens),
  }
}

/**
 * Turns a provider failure into something actionable.
 *
 * The AI SDK surfaces an HTTP status and little else, so a gateway responding 402 arrives as
 * the bare string "Payment Required" — which tells an operator nothing about what to do. The
 * gateway's own JSON body carries the real reason, and the cases below are the ones that are
 * configuration problems rather than genuine outages.
 */
function translateProviderError(cause: unknown): ApiErrorResponse {
  const message = cause instanceof Error ? cause.message : String(cause)
  const body = (cause as { responseBody?: string })?.responseBody ?? ''
  const combined = `${message} ${body}`

  if (/insufficient.*credit|wholesale credit/i.test(combined)) {
    return new ApiErrorResponse(
      'UPSTREAM_ERROR',
      'AI Gateway has no credits. Add them at Cloudflare dashboard → AI → AI Gateway → Settings.',
    )
  }

  if (/payment required|\b402\b/i.test(combined)) {
    return new ApiErrorResponse(
      'UPSTREAM_ERROR',
      'The inference provider rejected the request for billing reasons. Check AI Gateway credits.',
    )
  }

  if (/unauthorized|forbidden|\b401\b|\b403\b/i.test(combined)) {
    return new ApiErrorResponse(
      'UPSTREAM_ERROR',
      'AI Gateway rejected the credentials. Check AI_GATEWAY_TOKEN has the "AI Gateway Run" permission.',
    )
  }

  if (/not found|\b404\b/i.test(combined)) {
    return new ApiErrorResponse(
      'UPSTREAM_ERROR',
      'AI Gateway returned 404 — check AI_GATEWAY_URL account id and gateway name, and the model id in llm/models.ts.',
    )
  }

  return new ApiErrorResponse('UPSTREAM_ERROR', `Model call failed: ${message}`)
}

/**
 * One model call for one tier's worth of fields.
 *
 * Uses `generateText` with a **fixed** tool rather than `generateObject`. See prompt.ts —
 * `generateObject` builds a new tool per schema, which would silently break prompt caching.
 */
export async function generateFills(input: GenerateInput): Promise<GenerateResult> {
  const spec = MODELS[input.tier]
  // Cloudflare AI Gateway, Unified Billing. See provider.ts.
  const model = resolveModel(input.env, spec)

  const [instructions, profile] = buildSystemBlocks(input.profileDoc)

  const captured: { fills: Fill[]; skipped: Skip[] } = { fills: [], skipped: [] }

  const submitFills = tool({
    description: 'Return the answers for every field you were given.',
    inputSchema: SubmitFillsSchema,
    execute: async (args) => {
      const labels = new Map(input.fields.map((field) => [field.id, field.label]))
      captured.fills = args.fills.map((f) => ({
        fieldId: f.fieldId,
        label: labels.get(f.fieldId) ?? '',
        value: f.value,
        confidence: f.confidence,
        tier: input.tier,
        inferred: f.inferred ?? false,
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
    model,
    /**
     * System blocks go in `instructions`, not `messages`.
     *
     * AI SDK v7 rejects system-role entries inside `messages` outright. `instructions`
     * accepts an *array* of system messages though, which is what keeps the cache design
     * intact: the breakpoint sits on the profile block — the last stable thing before the
     * variable user message — so everything above it is cached. Collapsing these into a
     * single interpolated string would put the profile and the instructions in one block
     * and make an instruction edit invalidate every user's cached profile.
     */
    instructions: [
      { role: 'system' as const, content: instructions ?? '' },
      {
        role: 'system' as const,
        content: profile ?? '',
        ...(spec.supportsCaching
          ? {
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } },
              },
            }
          : {}),
      },
    ],
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    tools: { submit_fills: submitFills },
    // Force the tool so the model cannot answer in prose and leave us nothing to parse.
    toolChoice: { type: 'tool', toolName: 'submit_fills' },
  }).catch((cause: unknown) => {
    throw translateProviderError(cause)
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
    model: spec.modelId,
  }
}
