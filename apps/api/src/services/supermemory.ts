import type { Env } from '../env.js'

/**
 * Supermemory — ingestion, storage, and retrieval of everything we know about a user.
 *
 * This replaces a pipeline we were building by hand: URL rendering, PDF and image
 * extraction, chunking, embedding, and search. Supermemory does all of it behind two
 * endpoints, handles formats we had no path for at all (audio, video), and deduplicates
 * repeat content at the byte level.
 *
 * **What deliberately stays ours**, because it is not what a memory layer is for:
 *   - The tier-0 identity lookup. Retrieval returns *passages*; filling an email field with
 *     no model call needs a typed value. That path is why most fields cost nothing.
 *   - The form adapters and the tier router — nothing off the shelf does either.
 *
 * `containerTags` carries the user id, which is the isolation boundary: a search is scoped
 * to one user's container and cannot reach another's.
 */

const BASE_URL = 'https://api.supermemory.ai'

function containerFor(userId: string): string {
  return `user_${userId}`
}

/**
 * What Supermemory accepts as metadata values: strings, numbers and booleans only — no
 * nested objects and no arrays. An option set therefore travels as a joined string here, and
 * lives in the document *content* where retrieval can actually see it.
 */
export type Metadata = Record<string, string | number | boolean>

interface SupermemoryDocument {
  id?: string
  title?: string
  content?: string
  score?: number
  chunks?: { content?: string; score?: number }[]
}

async function call<T>(
  env: Env,
  path: string,
  init: {
    method: string
    body?: unknown
    formData?: FormData
    /**
     * Read a 404 as "already in the desired state" rather than as a failure.
     *
     * Only deletes set this, and only the account-wide one needs it. See `purgeDocument`.
     */
    missingIsSuccess?: boolean
  },
): Promise<T | null> {
  const key = env.SUPERMEMORY_API_KEY
  if (!key) return null

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
  let body: BodyInit | undefined

  if (init.formData) {
    // No Content-Type: the browser/runtime must set the multipart boundary itself.
    body = init.formData
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      signal: AbortSignal.timeout(60_000),
    })
    if (response.status === 404 && init.missingIsSuccess) return {} as T
    if (!response.ok) return null

    /**
     * A successful DELETE answers 204 with an empty body, and `json()` on an empty body
     * throws — which the catch below would turn into `null`, i.e. "failed". Deletes would
     * have reported failure every time they actually worked.
     */
    if (response.status === 204) return {} as T

    const text = await response.text()
    if (text === '') return {} as T

    return JSON.parse(text) as T
  } catch {
    // Memory is an enhancement, never a dependency: an outage should degrade answer
    // quality, not fail an ingest or a fill.
    return null
  }
}

/**
 * Sends a file exactly as uploaded — no local extraction first.
 *
 * A scanned résumé, a photo of a transcript, and a voice note all arrive here unchanged;
 * Supermemory does the extraction. That removes our vision call, our PDF parser, and the
 * "this looks like a scan, paste it instead" dead end in one step.
 */
export async function addFile(
  env: Env,
  userId: string,
  file: File,
  metadata: Metadata = {},
): Promise<string | null> {
  const form = new FormData()
  form.append('file', file)
  form.append('containerTags', JSON.stringify([containerFor(userId)]))
  form.append('metadata', JSON.stringify(metadata))

  const result = await call<{ id?: string }>(env, '/v3/documents/file', {
    method: 'POST',
    formData: form,
  })
  return result?.id ?? null
}

/**
 * A URL. Supermemory fetches and renders the page itself.
 *
 * Passing the link rather than scraped markdown removes our whole rendering step — it
 * handles JS-driven pages, follows what it needs to, and re-crawls on its own schedule so
 * a portfolio that changes does not go stale in our copy.
 */
export async function addUrl(
  env: Env,
  userId: string,
  url: string,
  metadata: Metadata = {},
): Promise<string | null> {
  const result = await call<{ id?: string }>(env, '/v3/documents', {
    method: 'POST',
    body: {
      content: url,
      // Naming the type stops it being indexed as a literal string of characters.
      type: 'url',
      containerTags: [containerFor(userId)],
      metadata,
    },
  })
  return result?.id ?? null
}

/**
 * Pasted text, and everything else we author ourselves.
 *
 * `customId` is **not** a dedup mechanism, however much it looks like one. Posting the same
 * `customId` twice does incremental processing — the new content is linked to the existing
 * document rather than replacing it — so a re-edited answer leaves both versions retrievable,
 * which is exactly the failure where "iOS" keeps coming back after the user changed it to
 * "Android". Replacement is `patchDocument`, and knowing which document to patch is what the
 * pointer table is for.
 *
 * It is still set on create, as a recovery key: if a pointer row is ever lost, the id is
 * derivable from the question again. Costs nothing, and is never read on the hot path.
 */
export async function addContent(
  env: Env,
  userId: string,
  content: string,
  metadata: Metadata = {},
  options: { customId?: string } = {},
): Promise<string | null> {
  const result = await call<{ id?: string }>(env, '/v3/documents', {
    method: 'POST',
    body: {
      content,
      containerTags: [containerFor(userId)],
      metadata,
      ...(options.customId ? { customId: options.customId } : {}),
    },
  })
  return result?.id ?? null
}

/**
 * Replaces a document's content in place. The only true replacement the API offers.
 *
 * Used when an answer is superseded: the user said "iOS" last month and "Android" today, and
 * both being in the index means the next form gets whichever ranks higher, at random from the
 * user's point of view. Appending a second document is not a smaller version of this — it is
 * the bug.
 *
 * Returns false on failure so the caller can fall back to delete-then-create; unlike most of
 * this module, "it didn't work" is actionable here.
 */
export async function patchDocument(
  env: Env,
  documentId: string,
  body: { content?: string; metadata?: Metadata },
): Promise<boolean> {
  return (await call(env, `/v3/documents/${documentId}`, { method: 'PATCH', body })) !== null
}

/**
 * The three shapes a learned answer can take.
 *
 * Not a cosmetic distinction — it decides whether the answer is findable again. See
 * `learnedDocument`.
 */
export type LearnedShape = 'prose' | 'choice' | 'boolean'

export interface LearnedInput {
  shape: LearnedShape
  question: string
  /** The answer in the words the user saw: option labels, or "Yes"/"No" for a checkbox. */
  answer: string
  /** The labels this answer was chosen from. Choice shape only. */
  options?: string[]
  origin: string
  edited: boolean
  /** The normalised reading of a yes/no question. Boolean shape only. */
  boolean?: boolean
}

/**
 * The document we store for one learned answer, and the only place its bytes are decided.
 *
 * One function rather than a call site per shape, because creating and *replacing* a document
 * must not be able to produce different text for the same answer — if they diverge, patching
 * a document silently rewrites it into a shape retrieval ranks differently, and the symptom
 * is an answer that used to come back and now doesn't.
 *
 * ### Why the shapes differ at all
 *
 * Retrieval here is semantic search over chunk text. Metadata never reaches a prompt, so
 * anything the next question has to match against must be *in the content*:
 *
 *   - **Prose** answers are self-describing. This is the original shape and its bytes are
 *     unchanged, deliberately: the index already holds thousands of documents in it, and
 *     rewriting them would only make old and new answers rank differently for no gain.
 *   - **Choices** carry the option set, because a short answer is meaningless without it.
 *     "10" retrieves nothing useful; "10, chosen from 1-10" is a fact about the person.
 *   - **Booleans** spell the answer out in a sentence. This is the important one. An
 *     embedding of the bare token "No" matches everything and retrieves nothing, so a user
 *     who declined visa sponsorship on one form was re-asked and re-guessed on the next,
 *     forever. The negation has to be lexically present for the next search to find it.
 */
/**
 * The exact bytes that open a learned document, and the marker that splits it.
 *
 * Constants because two functions now depend on them: `learnedDocument` writes this shape and
 * `parseLearnedAnswer` reads it back out of a retrieved chunk. A literal in each would be a
 * silent divergence — the writer would keep working, the reader would simply stop recognising
 * anything, and the symptom would be the user's own answers quietly demoted to ordinary
 * passages with no error anywhere.
 */
const QUESTION_PREFIX = 'Question: '
const ANSWER_SEPARATOR = '\n\nTheir answer: '

export function learnedDocument(input: LearnedInput): {
  content: string
  metadata: Metadata
} {
  const head = `${QUESTION_PREFIX}${input.question}${ANSWER_SEPARATOR}${input.answer}`

  const metadata: Metadata = {
    kind: input.shape === 'prose' ? 'user_answer' : 'user_choice',
    // Edited answers are corrections of ours, so they carry more weight than accepted ones.
    edited: String(input.edited),
    origin: input.origin,
    question: input.question,
  }

  if (input.shape === 'prose') return { content: head, metadata }

  metadata.answer = input.answer
  if (input.boolean !== undefined) metadata.boolean = input.boolean

  if (input.shape === 'boolean') {
    metadata.optionSet = 'Yes | No'
    return {
      content: `${head}\n\nThis was a yes/no question and they answered ${input.answer}.`,
      metadata,
    }
  }

  const offered = (input.options ?? []).filter((option) => option.trim() !== '')
  if (offered.length === 0) return { content: head, metadata }

  const optionSet = offered.join(' | ')
  metadata.optionSet = optionSet
  return { content: `${head}\n\nChosen from: ${optionSet}`, metadata }
}

export interface MemoryChunk {
  text: string
  source: string
  score: number
  /**
   * Set when this passage is an answer *this person* gave to a form question before.
   *
   * The distinction the prompt could not previously make, and the reason a correction seemed
   * not to stick. A learned answer and a paragraph of somebody's résumé arrived as the same
   * kind of thing — an untitled passage, prefixed with the question it was found for — so the
   * strongest signal the product ever receives was presented as background reading. Asked the
   * same question again, the model would compose something new and generic from it, which from
   * the user's side is indistinguishable from never having learned the answer at all.
   */
  past?: { question: string; answer: string }
}

/**
 * Reads one of our own learned documents back out of a retrieved chunk.
 *
 * Only recognises the shape `learnedDocument` writes, which is the point: everything else in
 * the index is a document the user gave us, and mislabelling one of those as "their answer to
 * this question" would put words in their mouth. A chunk that is a *fragment* of a learned
 * document — Supermemory chunks long content — has no head and is correctly not recognised;
 * it is still a perfectly good passage, just not a quotable answer.
 */
export function parseLearnedAnswer(text: string): { question: string; answer: string } | null {
  if (!text.startsWith(QUESTION_PREFIX)) return null

  const split = text.indexOf(ANSWER_SEPARATOR)
  if (split === -1) return null

  const question = text.slice(QUESTION_PREFIX.length, split).trim()
  let answer = text.slice(split + ANSWER_SEPARATOR.length).trim()

  /**
   * The trailing sentence the choice and boolean shapes add is for *retrieval*, not for
   * quoting: it exists so an embedding of the bare token "No" is not the only thing in the
   * index. Reading it back as part of the answer would have the model reply to a form with
   * "Yes. This was a yes/no question and they answered Yes."
   */
  const tail = answer.indexOf('\n\n')
  if (tail !== -1) answer = answer.slice(0, tail).trim()

  if (question === '' || answer === '') return null
  return { question, answer }
}

/** Semantic search across everything the user has given us, scoped to their container. */
export async function searchMemory(
  env: Env,
  userId: string,
  query: string,
  limit = 6,
): Promise<MemoryChunk[]> {
  const result = await call<{ results?: SupermemoryDocument[] }>(env, '/v3/search', {
    method: 'POST',
    body: {
      q: query,
      containerTags: [containerFor(userId)],
      limit,
      // Below this, passages are noise that costs prompt tokens and dilutes the answer.
      documentThreshold: 0.3,
      chunkThreshold: 0.3,
    },
  })

  if (!result?.results) return []

  return result.results
    .map((doc) => {
      const text = (doc.chunks?.map((c) => c.content ?? '').join('\n') || doc.content || '').trim()
      const past = parseLearnedAnswer(text)
      return {
        text,
        source: doc.title ?? 'memory',
        score: doc.score ?? 0,
        ...(past ? { past } : {}),
      }
    })
    .filter((chunk) => chunk.text.length > 0)
    .slice(0, limit)
}

/**
 * Removes a document.
 *
 * Called when the user deletes a source. If someone removes their resume, leaving the file
 * in memory is a privacy failure rather than merely wasted storage — and unlike the rest of
 * this module, a failure here is worth surfacing, so the caller can decide.
 */
export async function deleteDocument(env: Env, documentId: string): Promise<boolean> {
  return (await call(env, `/v3/documents/${documentId}`, { method: 'DELETE' })) !== null
}

/**
 * Deletes a document, counting one that is already gone as deleted.
 *
 * `deleteDocument` cannot do this, because `call` collapses every non-2xx into `null` — so a
 * 404 is indistinguishable from an outage. That distinction does not matter when a single
 * source is removed: the id is in hand, and a retry is one fresh request either way.
 *
 * It decides whether **account deletion can ever finish**. That runs over every document a
 * user has and refuses to drop the rows unless all of them are gone, so a run that deletes
 * nine of ten and then hits a timeout leaves nine ids that now answer 404. Reading those as
 * failures would make a half-finished deletion permanently unfinishable — the user asking to
 * be forgotten would get "try again" forever, with their data still there.
 */
export async function purgeDocument(env: Env, documentId: string): Promise<boolean> {
  return (
    (await call(env, `/v3/documents/${documentId}`, {
      method: 'DELETE',
      missingIsSuccess: true,
    })) !== null
  )
}
