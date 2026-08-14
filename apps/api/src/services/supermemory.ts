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
  init: { method: string; body?: unknown; formData?: FormData },
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
  metadata: Record<string, string> = {},
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
  metadata: Record<string, string> = {},
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

/** Pasted text. */
export async function addContent(
  env: Env,
  userId: string,
  content: string,
  metadata: Record<string, string> = {},
): Promise<string | null> {
  const result = await call<{ id?: string }>(env, '/v3/documents', {
    method: 'POST',
    body: {
      content,
      containerTags: [containerFor(userId)],
      metadata,
    },
  })
  return result?.id ?? null
}

/**
 * Records something the user wrote themselves.
 *
 * The highest-signal content the product ever sees: an answer they corrected is ground
 * truth for both substance and voice. Storing it here rather than in a local table means
 * every future fill retrieves it alongside everything else, with no separate index to
 * maintain and no separate ranking to tune.
 */
export async function rememberUserWriting(
  env: Env,
  userId: string,
  question: string,
  answer: string,
  origin: string,
  edited: boolean,
): Promise<string | null> {
  return addContent(env, userId, `Question: ${question}\n\nTheir answer: ${answer}`, {
    kind: 'user_answer',
    // Edited answers are corrections of ours, so they carry more weight than accepted ones.
    edited: String(edited),
    origin,
    question,
  })
}

export interface MemoryChunk {
  text: string
  source: string
  score: number
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
    .map((doc) => ({
      text: (doc.chunks?.map((c) => c.content ?? '').join('\n') || doc.content || '').trim(),
      source: doc.title ?? 'memory',
      score: doc.score ?? 0,
    }))
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
