import type { Env } from '../env.js'
import { type MemoryChunk, searchMemory } from './supermemory.js'

/**
 * Retrieval over the user's corpus. Two layers, each carrying what it is actually good for.
 *
 *   1. Structured facts, preferences, and past short answers live in `PROFILE_DOC` and are
 *      **always** in the prompt. They are small and bounded, and retrieval over them would
 *      only introduce a way to miss the user's own email address.
 *
 *   2. Everything else — documents, scraped pages, and the user's own past writing — comes
 *      from Supermemory, **searched once per question**.
 *
 * ### Why per question
 *
 * This used to be one search for the whole form, with every field label concatenated into a
 * single query. That is the wrong shape for an embedding search: a twenty-question blob has no
 * single meaning, so it retrieves passages that are vaguely near the average of the form and
 * specifically right for nothing. Six chunks then had to serve twenty questions, and the essay
 * that needed three of them competed with a dropdown that needed none.
 *
 * One query per question is what the index is actually built for. Each question gets passages
 * chosen for *it*, and the searches run concurrently, so the wall-clock cost is one round trip
 * rather than twenty. Searches are the cheap part of this pipeline — far cheaper than the model
 * call they improve.
 */

/** Chunks per question. Small on purpose: these are targeted now, not a shared pool. */
const CHUNKS_PER_QUESTION = 4

/**
 * Ceiling on searches per form.
 *
 * A Worker has a hard subrequest limit per request, and the model calls need their share of it.
 * Twenty-five distinct questions is far past any real form; beyond it the remaining fields
 * still get the profile and the page context, and the drop is logged rather than silent.
 */
const MAX_SEARCHES = 25

export interface RetrievalRequest {
  fieldId: string
  question: string
}

export interface FillContextInput {
  env: Env
  userId: string
  /** The fields a model still has to answer. Recalled and identity fields are already done. */
  questions: RetrievalRequest[]
}

export interface FillContext {
  /** fieldId → the passages retrieved for that question. */
  byField: Map<string, MemoryChunk[]>
}

export async function gatherFillContext(input: FillContextInput): Promise<FillContext> {
  const byField = new Map<string, MemoryChunk[]>()

  const wanted = input.questions.filter((entry) => entry.question.trim() !== '')
  if (wanted.length === 0) return { byField }

  /**
   * One search per *distinct* question, not per field.
   *
   * Forms repeat labels — "Yes/No" compliance questions, an address block asked twice — and
   * searching the same string twice pays two round trips for one result.
   */
  const byQuestion = new Map<string, string[]>()
  for (const entry of wanted) {
    const key = entry.question.trim().toLowerCase()
    const fields = byQuestion.get(key)
    if (fields) fields.push(entry.fieldId)
    else byQuestion.set(key, [entry.fieldId])
  }

  const queries = [...byQuestion.entries()].slice(0, MAX_SEARCHES)

  if (byQuestion.size > MAX_SEARCHES) {
    console.debug('[aff] retrieval capped', {
      questions: byQuestion.size,
      searched: MAX_SEARCHES,
    })
  }

  const results = await Promise.all(
    queries.map(async ([question, fieldIds]) => ({
      fieldIds,
      chunks: await searchMemory(input.env, input.userId, question, CHUNKS_PER_QUESTION),
    })),
  )

  for (const { fieldIds, chunks } of results) {
    for (const fieldId of fieldIds) byField.set(fieldId, chunks)
  }

  return { byField }
}
