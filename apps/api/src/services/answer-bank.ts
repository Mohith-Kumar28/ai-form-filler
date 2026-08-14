import type { FeedbackRequest } from '@aff/shared'
import type { Env } from '../env.js'
import { rememberUserWriting } from './supermemory.js'

/**
 * The learning loop: what the user actually submitted goes back into memory.
 *
 * An answer the user corrected is the strongest signal the product ever receives — it is
 * their own writing, on a question they cared enough to fix. Storing it in Supermemory
 * rather than a local table means the next fill retrieves it alongside their resume and
 * everything else, ranked together, with no second index to maintain and no separate
 * relevance function to tune.
 *
 * This used to write to a D1 `answer_bank` table with an FTS5 index and a hand-written BM25
 * query. That table is gone: it was a lexical search engine built to do one narrow part of
 * what the memory layer already does across the whole corpus.
 */
export async function recordFeedback(
  env: Env,
  userId: string,
  payload: FeedbackRequest,
): Promise<number> {
  const entries = payload.entries
    // Very short answers ("Yes", "3") carry no reusable voice or substance.
    .filter((entry) => entry.accepted.trim().length > 20)

  if (entries.length === 0) return 0

  const results = await Promise.all(
    entries.map((entry) =>
      rememberUserWriting(env, userId, entry.label, entry.accepted, payload.origin, entry.edited),
    ),
  )

  // Report what was actually stored, not what was attempted — memory failures are swallowed
  // inside the client so a fill never breaks, which would otherwise make this always lie.
  return results.filter(Boolean).length
}
