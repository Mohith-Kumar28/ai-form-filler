import { ApiErrorResponse } from '@aff/shared'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import type { Env } from '../env.js'
import { MODELS } from '../llm/models.js'
import { resolveModel } from '../llm/provider.js'

/**
 * Turns a raw source into structure, once at ingest.
 *
 * The previous design stored source text verbatim and let the fill-time model read it cold.
 * That is why answers were thin: a portfolio page dumped as 7,000 characters of prose gives
 * the model no handle on what is a *fact* about the person versus a project description
 * versus navigation text.
 *
 * Doing this at ingest rather than per-fill matters for cost as much as quality — it is
 * paid once per document instead of once per form, and every later fill reads the compact
 * structured version.
 *
 * The three outputs each serve a distinct job at fill time:
 *   facts        — deterministic answers, no model call needed
 *   preferences  — what lets the model answer a judgement call the way this person would
 *   writingSamples — what makes a long-form answer sound like them rather than like an LLM
 */

const StructuredProfileSchema = z.object({
  identity: z
    .object({
      fullName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      pronouns: z.string().optional(),
      workAuthorization: z.string().optional(),
      links: z
        .array(z.object({ platform: z.string(), url: z.string() }))
        .describe('Any profile or project URL, keyed by platform name.')
        .default([]),
    })
    .describe('Only what the document actually states about this person.'),

  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string().optional(),
        field: z.string().optional(),
        grade: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .default([]),

  experience: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        summary: z.string().optional(),
        highlights: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  skills: z.array(z.string()).default([]),

  /**
   * Free-form facts that don't fit the schema — visa status, notice period, salary
   * expectation, dietary needs, t-shirt size. Deliberately open-ended, because forms ask
   * about anything and a fixed schema is what makes every other autofiller narrow.
   */
  facts: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe('Any other concrete, stated fact about this person.')
    .default([]),

  /**
   * The part that lets the tool answer questions the sources never literally address.
   * Inferred from what the person builds, writes about, and chooses to highlight.
   */
  preferences: z
    .array(
      z.object({
        topic: z.string().describe('What this is a preference about, e.g. "work environment".'),
        stance: z.string().describe("The person's likely position, in their terms."),
        evidence: z.string().describe('What in the source supports this.'),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe('1.0 only if explicitly stated. Below 0.7 if inferred from context.'),
      }),
    )
    .describe('Interests, values, and likely choices — what this person would opt into.')
    .default([]),

  /** Verbatim prose by this person, used as few-shot voice examples for long answers. */
  writingSamples: z
    .array(z.string())
    .describe('Two or three passages written by the person, quoted exactly. Prose, not bullets.')
    .default([]),

  summary: z.string().describe('Two sentences describing who this person is.'),
})

export type StructuredSource = z.infer<typeof StructuredProfileSchema>

const SYSTEM = `You extract a durable profile of a person from a document they provided about themselves.

The output is used later to fill forms on their behalf, so accuracy about facts matters more than completeness.

Rules:
- Facts must be stated in the document. Never invent a date, employer, grade, or contact detail.
- Preferences are different: infer them from what the person builds, writes about, and chooses to highlight. Mark how confident you are, and say what supports it.
- Writing samples must be quoted exactly, and must be the person's own prose.
- Ignore navigation, cookie banners, footers, and boilerplate.
- If the document is not about a person, return empty arrays and say so in the summary.`

export interface StructureResult {
  structured: StructuredSource
  model: string
  inputTokens: number
  outputTokens: number
}

/** What we can hand the model directly. Anything else must be pasted as text. */
const READABLE_MEDIA_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function mediaTypeFor(file: { type: string; name: string }): string | null {
  if (READABLE_MEDIA_TYPES.has(file.type)) return file.type

  // Browsers sometimes send an empty or wrong type; fall back to the extension.
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  const byExtension: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    heic: 'image/heic',
  }
  return byExtension[extension] ?? null
}

/** A scanned document reads fine well below this; above it, the upload is likely a book. */
const MAX_FILE_BYTES = 20 * 1024 * 1024

/**
 * The document to structure: either text we already have, or a file the model reads itself.
 */
export type StructureSourceInput =
  | { kind: 'text'; text: string }
  | { kind: 'file'; bytes: ArrayBuffer; mediaType: string }

/**
 * Files go straight to the model rather than through a text extractor first.
 *
 * Gemini is natively multimodal, so a text-layer PDF, a scanned resume, and a photo of a
 * transcript are all one code path and one call. The previous design ran a PDF parser,
 * fell back to a separate transcription call when it found no text layer, and then made a
 * second call to structure the result — two round trips, two failure modes, and a dead end
 * ("paste the text instead") for exactly the scanned documents people most often have.
 */
export async function structureSource(
  env: Env,
  source: StructureSourceInput,
  label: string,
): Promise<StructureResult> {
  if (source.kind === 'file' && source.bytes.byteLength > MAX_FILE_BYTES) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'That file is larger than 20 MB')
  }
  // Flash: extraction is a reading task, and this runs on every ingested document.
  const spec = MODELS[2]
  const model = resolveModel(env, spec)

  let captured: StructuredSource | null = null

  const submit = tool({
    description: 'Return the structured profile extracted from the document.',
    inputSchema: StructuredProfileSchema,
    execute: async (args) => {
      captured = args
      return 'recorded'
    },
  })

  const result = await generateText({
    model,
    instructions: SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          source.kind === 'file'
            ? [
                { type: 'text' as const, text: `Source: ${label}` },
                {
                  type: 'file' as const,
                  data: new Uint8Array(source.bytes),
                  mediaType: source.mediaType,
                },
              ]
            : `Source: ${label}\n\n---\n\n${source.text}`,
      },
    ],
    tools: { submit_profile: submit },
    toolChoice: { type: 'tool', toolName: 'submit_profile' },
  }).catch((cause: unknown) => {
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      `Could not read that source: ${cause instanceof Error ? cause.message : 'unknown error'}`,
    )
  })

  if (!captured) {
    throw new ApiErrorResponse('UPSTREAM_ERROR', 'The model returned no structured profile')
  }

  return {
    structured: captured,
    model: spec.modelId,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
  }
}
