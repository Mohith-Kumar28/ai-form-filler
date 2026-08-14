import type { Env } from '../env.js'
import { type MemoryChunk, searchMemory } from './supermemory.js'

/**
 * Retrieval over the user's corpus. Two layers, each carrying what it is actually good for.
 *
 *   1. Structured facts, preferences, and voice samples live in `PROFILE_DOC` and are
 *      **always** in the prompt. They are small and bounded, and retrieval over them would
 *      only introduce a way to miss the user's own email address.
 *
 *   2. Everything else — documents, scraped pages, and the user's own past answers — comes
 *      from one Supermemory search. It is a single index, so a resume line and a past
 *      answer compete on the same ranking instead of arriving from two separately-tuned
 *      stores that then have to be merged and re-ranked by hand.
 *
 * This replaced three hand-built layers: Cloudflare AI Search over markdown in R2, BM25 over
 * a D1 answer bank, and the R2 bucket underneath both. Layer 1 is why losing them is safe —
 * the facts that must never be missed were never being retrieved in the first place.
 */

export interface FillContextInput {
  env: Env
  userId: string
  /** The field labels being answered, used as the retrieval query. */
  questions: string[]
}

export interface FillContext {
  sourceChunks: MemoryChunk[]
}

/**
 * Gathers everything the generative tiers need beyond the always-present profile.
 *
 * One query built from all the field labels at once, rather than one per field: the fields
 * on a form are about the same person and the same application, so per-field searches
 * return heavily overlapping passages at N times the latency.
 */
export async function gatherFillContext(input: FillContextInput): Promise<FillContext> {
  const query = input.questions.join('\n')
  return { sourceChunks: await searchMemory(input.env, input.userId, query, 6) }
}
