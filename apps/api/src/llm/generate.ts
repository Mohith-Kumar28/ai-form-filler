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
  /** Tags this call in AI Gateway's logs so spend and quality are attributable. */
  userId: string
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
export function translateProviderError(cause: unknown): ApiErrorResponse {
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
  const model = resolveModel(input.env, spec, {
    user: input.userId,
    feature: 'fill',
    tier: input.tier,
    origin: input.origin,
  })

  const [instructions, profile] = buildSystemBlocks(input.profileDoc)

  const captured: { fills: Fill[]; skipped: Skip[] } = { fills: [], skipped: [] }

  const submitFills = tool({
    description: 'Return the answers for every field you were given.',
    inputSchema: SubmitFillsSchema,
    execute: async (args) => {
      const labels = new Map(input.fields.map((field) => [field.id, field.label]))
      const optionsFor = new Map(
        input.fields.map((field) => [field.id, (field.options ?? []).map((o) => o.label)]),
      )

      /**
       * Model output is filtered against the fields actually asked about.
       *
       * Nothing constrains `fieldId` to the batch — it is a string, and the model will
       * sometimes answer a multi-select by emitting one entry per chosen option, inventing
       * an id for each. Those extra entries matched no field, so they got an empty label
       * and surfaced in the review as answers to no question, repeating the same reasoning
       * over and over. They are dropped here rather than rendered around.
       *
       * Duplicates on a real id are collapsed to the first, which is the one the model
       * committed to before it started elaborating.
       */
      const byId = new Map(input.fields.map((field) => [field.id, field]))

      /**
       * Whether an answer is actually one of the choices offered.
       *
       * `optionsFor` was built and then used only for display. A model answering a select or
       * radio with something not on the list had that value passed straight to the content
       * script, which matched nothing and left the field blank — reported as an answer.
       * Skipping instead tells the user the truth and leaves the field visibly empty.
       */
      const answersTheOptions = (fieldId: string, value: string): boolean => {
        const field = byId.get(fieldId)
        const options = field?.options ?? []
        if (options.length === 0) return true

        const keys = new Set(
          options.flatMap((o) => [o.value.toLowerCase().trim(), o.label.toLowerCase().trim()]),
        )

        // Multiselect answers arrive comma-separated; every part has to be a real option.
        const parts =
          field?.kind === 'multiselect'
            ? value.split(',').map((v) => v.trim().toLowerCase())
            : [value.trim().toLowerCase()]

        return parts.every((part) => keys.has(part))
      }

      const rejected: { fieldId: string; reason: string }[] = []
      const seen = new Set<string>()
      captured.fills = args.fills
        .filter((f) => {
          if (!labels.has(f.fieldId) || seen.has(f.fieldId)) return false

          if (!answersTheOptions(f.fieldId, f.value)) {
            rejected.push({
              fieldId: f.fieldId,
              reason: 'The answer was not one of the offered choices',
            })
            seen.add(f.fieldId)
            return false
          }

          const max = byId.get(f.fieldId)?.maxLength
          if (max && f.value.length > max) {
            // Programmatic writes bypass `maxlength`, so an over-long answer is accepted by
            // the DOM and rejected at submit. Truncating is kinder than a silent failure.
            f.value = f.value.slice(0, max)
          }

          seen.add(f.fieldId)
          return true
        })
        .map((f) => ({
          fieldId: f.fieldId,
          label: labels.get(f.fieldId) ?? '',
          value: f.value,
          confidence: f.confidence,
          tier: input.tier,
          inferred: f.inferred ?? false,
          options: optionsFor.get(f.fieldId) ?? [],
          ...(f.reasoning ? { reasoning: f.reasoning } : {}),
        }))
      captured.skipped = [
        ...args.skipped
          .filter((s) => labels.has(s.fieldId) && !seen.has(s.fieldId))
          .map((s) => ({
            fieldId: s.fieldId,
            reason: 'no_matching_knowledge' as const,
            detail: s.reason,
          })),
        ...rejected.map((r) => ({
          fieldId: r.fieldId,
          reason: 'model_error' as const,
          detail: r.reason,
        })),
      ]
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

  /**
   * Every field is accounted for, even when the model says nothing about it.
   *
   * `captured` is populated only inside the tool's `execute`. A provider that returns no
   * tool call at all — Gemini's `MALFORMED_FUNCTION_CALL` is the realistic case — resolves
   * normally, and the whole batch then appeared in neither `fills` nor `skipped`: no answer,
   * no skip, no error, and the quota spent regardless.
   */
  const accounted = new Set([
    ...captured.fills.map((f) => f.fieldId),
    ...captured.skipped.map((s) => s.fieldId),
  ])

  for (const field of input.fields) {
    if (accounted.has(field.id)) continue
    captured.skipped.push({
      fieldId: field.id,
      reason: 'model_error',
      detail: 'No answer came back for this field',
    })
  }

  return {
    fills: captured.fills,
    skipped: captured.skipped,
    usage,
    costMicroUsd: costMicroUsd(spec, usage),
    model: spec.modelId,
  }
}
