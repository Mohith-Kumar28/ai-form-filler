import type { FeedbackRequest } from '@aff/shared'
import { answerBank } from '../db/schema.js'
import type { Db } from './account.js'

/**
 * Retrieval over past accepted answers, using SQLite's built-in FTS5 BM25 ranking.
 *
 * No embedding model and no vector store. For a corpus of tens to low hundreds of answers,
 * lexical matching on the question text performs as well as semantic search and costs a
 * single indexed query — the complexity of an embedding pipeline only starts paying off in
 * the thousands. Cloudflare Vectorize is the upgrade path if that day comes.
 */

/**
 * FTS5's MATCH syntax treats many punctuation characters as operators, so a raw question
 * like `Why us? "culture fit"` is a syntax error rather than a search. Each word is quoted
 * and OR-ed instead: quoting neutralises operators, and OR gives partial-overlap matches
 * that BM25 then ranks.
 */
function toMatchQuery(text: string): string {
  const terms = text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length > 2)
    // Very common words contribute nothing to ranking and widen the scan.
    .filter((term) => !STOPWORDS.has(term))
    .slice(0, 12)

  if (terms.length === 0) return ''
  return terms.map((term) => `"${term}"`).join(' OR ')
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'you',
  'your',
  'are',
  'this',
  'that',
  'with',
  'from',
  'what',
  'how',
  'why',
  'would',
  'have',
  'has',
  'was',
  'were',
  'our',
  'their',
  'please',
  'describe',
  'tell',
  'about',
  'any',
  'can',
  'will',
  'not',
])

export interface RelatedAnswer {
  label: string
  answer: string
}

/**
 * Top-k past answers most similar to a question.
 *
 * `bm25()` returns a *negative* score where more negative is a better match, so ascending
 * order puts the best result first — the opposite of what most ranking functions do.
 */
export async function findRelatedAnswers(
  db: Db,
  userId: string,
  question: string,
  limit = 3,
): Promise<RelatedAnswer[]> {
  const match = toMatchQuery(question)
  if (!match) return []

  try {
    const rows = await db.all<{ label: string; answer: string }>(
      // Drizzle has no FTS5 builder, so this is raw SQL. Both parameters are bound, never
      // interpolated — `match` is derived from a page-supplied label and is untrusted.
      (await import('drizzle-orm')).sql`
        SELECT ab.label AS label, ab.answer AS answer
        FROM answer_bank_fts fts
        JOIN answer_bank ab ON ab.rowid = fts.rowid
        WHERE answer_bank_fts MATCH ${match}
          AND ab.user_id = ${userId}
        ORDER BY bm25(answer_bank_fts) ASC
        LIMIT ${limit}
      ` as never,
    )
    return rows
  } catch {
    // A malformed MATCH expression must degrade to "no extra context", never fail the fill.
    return []
  }
}

/**
 * Records what the user actually submitted.
 *
 * Edited answers are the highest-signal rows we ever get: the user cared enough to correct
 * us, so the correction is ground truth for both content and voice.
 */
export async function recordFeedback(
  db: Db,
  userId: string,
  payload: FeedbackRequest,
): Promise<number> {
  const rows = payload.entries
    // Very short answers ("Yes", "3") carry no reusable voice or substance.
    .filter((entry) => entry.accepted.trim().length > 20)
    .map((entry) => ({
      id: `ans_${crypto.randomUUID()}`,
      userId,
      label: entry.label,
      answer: entry.accepted,
      origin: payload.origin,
      wasEdited: entry.edited,
      createdAt: Date.now(),
    }))

  if (rows.length === 0) return 0

  await db.insert(answerBank).values(rows)
  return rows.length
}
