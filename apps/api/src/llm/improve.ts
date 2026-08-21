import { ApiErrorResponse } from '@aff/shared'
import { generateText } from 'ai'
import type { Env } from '../env.js'
import { searchMemory } from '../services/supermemory.js'
import { translateProviderError } from './generate.js'
import { costMicroUsd, MODELS, type TokenUsage } from './models.js'
import { resolveModel } from './provider.js'

/**
 * Rewrites one answer, on request, in the review panel.
 *
 * The fill pass answers every field at once under a shared instruction. This is the opposite:
 * a single answer the user has looked at and decided is not right yet, with an instruction
 * they chose. That makes it worth a separate call — the rewrite gets the whole budget and the
 * user's actual intent, rather than being one row in a batch of thirty.
 *
 * Memory is retrieved again for the same reason it is retrieved during a fill: "add more
 * detail" is impossible to honour without the facts to add, and inventing them is the one
 * failure this feature could introduce that the user cannot easily catch.
 *
 * ### There is deliberately no preset vocabulary here
 *
 * There was one — `IMPROVE_STYLES`, four carefully written sentences — and **nothing ever
 * imported it**. The panel sent `instruction: style.key`, so this function received the word
 * "professional" and passed the line `Instruction: professional` to a frontier model. The
 * sentences never reached a model once.
 *
 * The presets now live in `@aff/shared/rewrite`, on the side that shows them to the user, and
 * arrive here as the full sentence — identical in kind to something they typed themselves.
 * That is what makes the failure impossible rather than merely fixed: what the chip says and
 * what the model is told are one object, so they cannot drift apart again.
 */

const SYSTEM = `You rewrite a single answer a person is about to submit on a form.

Rules:
- Keep every fact. Never introduce a fact that is not in the answer or the supplied passages.
- Write in this person's voice, not a generic professional register. Match the passages.
- Never use an em dash. Use a comma, a colon, a semicolon, or two sentences instead.
- Return only the rewritten answer. No preamble, no quotes, no explanation, no options.
- Respect any stated length limit. If none is given, do not exceed the original by much.
- If the instruction cannot be honoured without inventing something, return the answer unchanged.`

export interface ImproveInput {
  env: Env
  userId: string
  /** The question, so the rewrite stays an answer to it. */
  label: string
  value: string
  /** A preset, or the user's own words. */
  instruction: string
  maxLength?: number
}

export interface ImproveResult {
  value: string
  usage: TokenUsage
  costMicroUsd: number
  /** The provider's own id for the model that answered, for the cost log. */
  model: string
}

/**
 * Returns the usage alongside the answer.
 *
 * It used to return a bare string, which is why every rewrite this product has ever performed is
 * absent from `fill_log` and therefore from `pnpm db:costs`. Rewrites run on the tier-3 model with
 * an extra retrieval — the most expensive request we make — so the one report that decides whether
 * the plans are affordable was blind to the largest line on it.
 */
export async function improveAnswer(input: ImproveInput): Promise<ImproveResult> {
  const original = input.value.trim()
  if (original === '') {
    throw new ApiErrorResponse('INVALID_REQUEST', 'There is nothing to improve yet')
  }

  // Tier 3's model: this is a writing task the user is watching, on one field rather than
  // thirty, so it is the one place where paying for the better model is obviously right.
  const spec = MODELS[3]
  const model = resolveModel(input.env, spec, { user: input.userId, feature: 'improve' })

  const passages = await searchMemory(input.env, input.userId, `${input.label}\n${original}`, 4)

  const context =
    passages.length > 0
      ? `\n\nPassages from this person's own documents and past answers:\n${passages
          .map((p) => `[${p.source}]\n${p.text}`)
          .join('\n\n')}`
      : ''

  const result = await generateText({
    model,
    instructions: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Question: ${input.label}\n\nCurrent answer:\n${original}\n\nInstruction: ${input.instruction}${
          input.maxLength ? `\n\nHard limit: ${input.maxLength} characters.` : ''
        }${context}`,
      },
    ],
  }).catch((cause: unknown) => {
    throw translateProviderError(cause)
  })

  const improved = result.text.trim()

  // Tier 3 is a Google model and `supportsCaching` is false for it, so the cache counters the
  // batch path reads out of `providerMetadata` are structurally zero here.
  const usage: TokenUsage = {
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }

  return {
    // A model that returns nothing usable must not silently blank the user's answer.
    value: improved === '' ? original : improved,
    usage,
    costMicroUsd: costMicroUsd(spec, usage),
    model: spec.modelId,
  }
}
