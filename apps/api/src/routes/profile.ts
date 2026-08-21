import {
  ApiErrorResponse,
  MAX_TEXT_BYTES,
  PLAN_FACT_LIMITS,
  PLAN_SOURCE_LIMITS,
  PLAN_UPLOAD_LIMITS,
} from '@aff/shared'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { profileSources } from '../db/schema.js'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
import { consumeQuota, enforceQuota, rateLimit } from '../middleware/quota.js'
import {
  AddSourceResponse,
  bearerAuth,
  errorResponses,
  Profile,
  ProfilePatch,
  ProfileResponse,
  TextSourceRequest,
} from '../openapi/schemas.js'
import { fetchUrlAsMarkdown } from '../profile/fetch-url.js'
import { isPreviewableInline, mediaTypeFor, sourceKindFor } from '../profile/media.js'
import { parseFreeform } from '../profile/parse.js'
import { structureSource } from '../profile/structure.js'
import {
  addSource,
  deleteSource,
  getProfile,
  getSource,
  getSourceFile,
  recordReingest,
  renameSource,
  updateStructured,
} from '../services/profile.js'
import { addContent, addFile, addUrl, deleteDocument } from '../services/supermemory.js'

export const profileRoutes = new OpenAPIHono<AppEnv>()

profileRoutes.use('*', requireAuth)

/**
 * Ingest is rate limited too.
 *
 * Only `/v1/fill` was metered, but every source added costs real money — a page render, a
 * multimodal model call, a 15 MB R2 write and a memory ingest — and none of it consumed
 * quota. One authenticated account could loop this endpoint indefinitely for free.
 */
profileRoutes.use('/sources', rateLimit)
profileRoutes.use('/sources/upload', rateLimit)
profileRoutes.use('/sources/:id/reprocess', rateLimit)

/**
 * One ingest, one field's worth of allowance.
 *
 * Adding a source runs a multimodal extraction call and a memory ingest, both of which we pay
 * for, and until now neither was counted anywhere. The rate limiter above bounded how *fast*
 * somebody could do it and nothing bounded how *much* — which is the same hole the fill route
 * closed by metering, with the added twist that a source ingest is the more expensive of the two.
 *
 * Charged at one action, the same as answering one field, and spent only after the ingest
 * actually succeeded (see `chargeIngest`). A failed upload costs the user nothing.
 *
 * What this deliberately does *not* do is call `enforceQuota` on the add-source routes. An account
 * with no subscription has a limit of zero, so enforcing here would make "add your résumé" the
 * paywall — and the whole onboarding order depends on it not being: put your information in, see
 * what it knows, and meet the price at the moment you ask it to fill something. So the first
 * sources are recorded as spent and are simply free of charge in practice, because at limit zero
 * there is nothing to spend. Reprocess is the opposite case and does enforce; see its route.
 */
async function chargeIngest(env: AppEnv['Bindings'], userId: string): Promise<void> {
  await consumeQuota(env, userId, 1)
}

const getProfileRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['profile'],
  summary: 'The full profile, including sources',
  operationId: 'getProfile',
  security: bearerAuth,
  responses: {
    200: { description: 'The profile', content: { 'application/json': { schema: Profile } } },
    ...errorResponses,
  },
})

profileRoutes.openapi(getProfileRoute, async (c) =>
  c.json(await getProfile(drizzle(c.env.DB), c.get('userId')), 200),
)

/**
 * Drops keys whose value is `undefined`.
 *
 * Under `exactOptionalPropertyTypes`, `{ skills: undefined }` and `{}` are different types
 * and mean different things: an absent key is "leave this alone", whereas an explicit
 * undefined spread over the stored profile would erase the field.
 */
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> }

function definedKeysOnly<T extends object>(input: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Defined<T>
}

const patchProfileRoute = createRoute({
  method: 'patch',
  path: '/',
  tags: ['profile'],
  summary: 'Edit structured profile fields',
  description:
    'Identity is merged field by field; array fields are replaced wholesale. Send an empty string to clear an identity field.',
  operationId: 'patchProfile',
  security: bearerAuth,
  request: {
    body: { content: { 'application/json': { schema: ProfilePatch } }, required: true },
  },
  responses: {
    200: {
      description: 'The updated profile',
      content: { 'application/json': { schema: Profile } },
    },
    ...errorResponses,
  },
})

profileRoutes.openapi(patchProfileRoute, async (c) => {
  const patch = c.req.valid('json')
  const account = c.get('account')
  const factLimit = PLAN_FACT_LIMITS[account.quota.plan]

  if (patch.custom) {
    const factCount = Object.keys(patch.custom).length
    if (factCount > factLimit) {
      throw new ApiErrorResponse(
        'LIMIT_EXCEEDED',
        `Your plan allows ${factLimit} custom facts. Upgrade to add more.`,
      )
    }
  }

  const updated = await updateStructured(drizzle(c.env.DB), c.get('userId'), definedKeysOnly(patch))
  return c.json(updated, 200)
})

const addTextSourceRoute = createRoute({
  method: 'post',
  path: '/sources',
  tags: ['profile'],
  summary: 'Add a source from a URL or pasted text',
  operationId: 'addTextSource',
  security: bearerAuth,
  request: {
    body: { content: { 'application/json': { schema: TextSourceRequest } }, required: true },
  },
  responses: {
    200: {
      description: 'Source added and profile recompiled',
      content: { 'application/json': { schema: AddSourceResponse } },
    },
    ...errorResponses,
  },
})

profileRoutes.openapi(addTextSourceRoute, async (c) => {
  const body = c.req.valid('json')
  const db = drizzle(c.env.DB)
  const userId = c.get('userId')
  const account = c.get('account')

  const sourceLimit = PLAN_SOURCE_LIMITS[account.quota.plan]
  const sourceRows = await db
    .select({ count: count() })
    .from(profileSources)
    .where(eq(profileSources.userId, userId))
  const currentSources = sourceRows[0]?.count ?? 0
  if (currentSources >= sourceLimit) {
    throw new ApiErrorResponse(
      'LIMIT_EXCEEDED',
      `Your plan allows ${sourceLimit} sources. Upgrade to add more.`,
    )
  }

  if (body.url) {
    const label = body.label?.trim()
    if (!label) {
      throw new ApiErrorResponse('INVALID_REQUEST', 'Give this link a name so you can find it')
    }

    /**
     * The link goes to Supermemory, which renders and re-crawls the page itself.
     *
     * We still fetch it once here, but only to run the structuring pass: tier 0 needs typed
     * identity values and retrieval returns passages, not fields.
     */
    const [memoryId, page] = await Promise.all([
      addUrl(c.env, userId, body.url, { label }),
      fetchUrlAsMarkdown(c.env, body.url),
    ])

    const { structured } = await structureSource(
      c.env,
      { kind: 'text', text: page.markdown },
      label,
      userId,
    )

    const profile = await addSource(db, userId, {
      kind: 'link',
      label,
      text: '',
      url: body.url,
      ...(memoryId ? { memoryId } : {}),
      structured,
    })
    await chargeIngest(c.env, userId)
    return c.json({ profile, truncated: page.truncated }, 200)
  }

  if (body.text) {
    /**
     * Measured in bytes, not characters, because the limit being respected is Supermemory's own
     * 1 MB ceiling on text and that is a byte limit — a note of emoji or Devanagari is several
     * times longer on the wire than its length suggests. Nothing checked this before, so an
     * oversized paste failed downstream in memory with an error we did not write.
     */
    const bytes = new TextEncoder().encode(body.text).length
    if (bytes > MAX_TEXT_BYTES) {
      throw new ApiErrorResponse(
        'INVALID_REQUEST',
        `That note is ${(bytes / 1024 / 1024).toFixed(1)} MB. Notes are limited to 1 MB — attach it as a file instead.`,
      )
    }

    const parsed = parseFreeform(body.text)
    // Pasted text names itself: its first line is a better label than "Untitled note".
    const label = body.label?.trim() || firstLineOf(parsed.text)

    const [memoryId, { structured }] = await Promise.all([
      addContent(c.env, userId, parsed.text, { label }),
      structureSource(c.env, { kind: 'text', text: parsed.text }, label, userId),
    ])
    const profile = await addSource(db, userId, {
      kind: 'text',
      label,
      text: parsed.text,
      ...(memoryId ? { memoryId } : {}),
      structured,
    })
    await chargeIngest(c.env, userId)
    return c.json({ profile, truncated: parsed.truncated }, 200)
  }

  throw new ApiErrorResponse('INVALID_REQUEST', 'Provide either a url or text')
})

/** First meaningful line, trimmed to something that fits a list row. */
function firstLineOf(text: string): string {
  const line =
    text
      .split('\n')
      .find((l) => l.trim().length > 0)
      ?.trim() ?? 'Note'
  return line.length > 60 ? `${line.slice(0, 57)}…` : line
}

/**
 * File upload is declared as multipart rather than JSON: base64-encoding a file into a JSON
 * body costs a 33% size tax on every upload for no benefit.
 */
const uploadSourceRoute = createRoute({
  method: 'post',
  path: '/sources/upload',
  tags: ['profile'],
  summary: 'Upload a file of any kind memory can read',
  operationId: 'uploadSource',
  security: bearerAuth,
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
            /** Required: an unnamed file is unfindable in a list a month later. */
            label: z.string().min(1).max(200),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Source added and profile recompiled',
      content: { 'application/json': { schema: AddSourceResponse } },
    },
    ...errorResponses,
  },
})

profileRoutes.openapi(uploadSourceRoute, async (c) => {
  const { file, label } = c.req.valid('form')
  const db = drizzle(c.env.DB)
  const userId = c.get('userId')
  const account = c.get('account')

  const sourceLimit = PLAN_SOURCE_LIMITS[account.quota.plan]
  const sourceRows = await db
    .select({ count: count() })
    .from(profileSources)
    .where(eq(profileSources.userId, userId))
  const currentSources = sourceRows[0]?.count ?? 0
  if (currentSources >= sourceLimit) {
    throw new ApiErrorResponse(
      'LIMIT_EXCEEDED',
      `Your plan allows ${sourceLimit} sources. Upgrade to add more.`,
    )
  }

  const maxUpload = PLAN_UPLOAD_LIMITS[account.quota.plan]
  if (file.size > maxUpload) {
    const maxMB = Math.round(maxUpload / 1024 / 1024)
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit for your plan is ${maxMB} MB.`,
    )
  }

  const mediaType = mediaTypeFor(file)
  const kind = sourceKindFor(mediaType)
  const bytes = await file.arrayBuffer()

  /**
   * Three destinations, and each has a distinct job:
   *
   *   memory — extraction, indexing, and retrieval at fill time. Handles formats we have no
   *            reader for, which is why there is no allowlist any more.
   *   R2     — the original bytes, so the source can be previewed and so a stored resume can
   *            be attached to a form's file input later.
   *   the structuring pass — typed identity fields for tier 0, which retrieval cannot supply.
   *
   * Only the structuring pass is skipped for audio and images: it reads for contact details,
   * and a voice note or a photo of a whiteboard has none to find, so the call would be spent
   * to learn nothing.
   */
  const r2Key = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '-')}`

  const [memoryId] = await Promise.all([
    addFile(c.env, userId, file, { label }),
    c.env.UPLOADS.put(r2Key, bytes, { httpMetadata: { contentType: mediaType } }),
  ])

  /**
   * Structuring runs *after* storage, and its failure must not orphan what was stored.
   *
   * These three used to run together in one `Promise.all`. When the structuring call threw —
   * any provider error does — the file was already in memory and in R2, but the row that
   * records their ids was never written. The user saw "upload failed" while their resume
   * stayed indexed and retrievable forever, with nothing left anywhere that could delete it.
   *
   * Identity extraction is an optimisation; storage is the thing the user asked for. So a
   * failure here is swallowed and the source is still recorded, ids intact and deletable.
   */
  let structured: Awaited<ReturnType<typeof structureSource>>['structured'] | undefined
  if (kind === 'document') {
    structured = await structureSource(c.env, { kind: 'file', bytes, mediaType }, label, userId)
      .then((r) => r.structured)
      .catch(() => undefined)
  }

  const profile = await addSource(db, userId, {
    kind,
    label,
    // The document itself lives in memory and R2; nothing is duplicated into the profile.
    text: '',
    r2Key,
    mediaType,
    sizeBytes: file.size,
    ...(memoryId ? { memoryId } : {}),
    ...(structured ? { structured } : {}),
    /**
     * A source that never reached memory is not ready.
     *
     * `addFile` returns `null` for a missing key, any non-2xx, or a timeout — all swallowed
     * so a fill never breaks. Marking it `ready` anyway showed the user a healthy resume
     * that was in no index, that retrieval would never return, and that reported no error.
     */
    ...(memoryId ? {} : { status: 'failed' as const, error: 'Could not be indexed. Try again.' }),
  })
  await chargeIngest(c.env, userId)
  return c.json({ profile, truncated: false }, 200)
})

/**
 * Serves an original back.
 *
 * Scoped by userId in the query, not just the key — the R2 prefix already contains the user
 * id, but relying on a caller-supplied id to be in the right prefix is one refactor away
 * from being an object-enumeration bug.
 */
const getSourceFileRoute = createRoute({
  method: 'get',
  path: '/sources/{id}/file',
  tags: ['profile'],
  summary: 'Download or preview a stored original',
  operationId: 'getSourceFile',
  security: bearerAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'The file', content: { '*/*': { schema: z.any() } } },
    ...errorResponses,
  },
})

profileRoutes.openapi(getSourceFileRoute, async (c) => {
  const { id } = c.req.valid('param')
  const source = await getSourceFile(drizzle(c.env.DB), c.get('userId'), id)

  if (!source?.r2Key) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'That source has no stored file')
  }

  const object = await c.env.UPLOADS.get(source.r2Key)
  if (!object) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'The stored file is no longer available')
  }

  const mediaType = source.mediaType ?? 'application/octet-stream'

  return new Response(object.body, {
    headers: {
      'Content-Type': mediaType,
      // Inline for what a browser renders; attachment for everything else, so a .docx
      // downloads instead of opening a blank tab.
      'Content-Disposition': `${isPreviewableInline(mediaType) ? 'inline' : 'attachment'}; filename="${source.label.replace(
        /"/g,
        '',
      )}"`,
      // Originals never change under a key, and the key contains a uuid.
      'Cache-Control': 'private, max-age=3600',
    },
  }) as never
})

const renameSourceRoute = createRoute({
  method: 'patch',
  path: '/sources/{id}',
  tags: ['profile'],
  summary: 'Rename a source',
  description:
    'Changes the display label only. The extracted text and the stored original are untouched, so this does not recompile the profile.',
  operationId: 'renameSource',
  security: bearerAuth,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ label: z.string().min(1).max(120) }).openapi('RenameSourceRequest'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Source renamed',
      content: { 'application/json': { schema: ProfileResponse } },
    },
    ...errorResponses,
  },
})

profileRoutes.openapi(renameSourceRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { label } = c.req.valid('json')
  const profile = await renameSource(drizzle(c.env.DB), c.get('userId'), id, label.trim())
  return c.json({ profile }, 200)
})

/**
 * Read a source again, from scratch.
 *
 * Three things make this worth an endpoint rather than the "add it again" the failure footer used
 * to offer. A re-upload burns a source slot until the dead one is removed by hand; it loses the
 * id, so the row moves and any link to it breaks; and for a link there is nothing to re-upload at
 * all — the page changed, which is the whole reason to ask. Reprocessing keeps the row, the slot
 * and the stored original, and redoes only the part that can go wrong or go stale: the memory
 * ingest and the identity extraction.
 *
 * It is metered, and unlike adding a source it is also **enforced**. The difference is who is
 * asking. Adding a source is onboarding — refusing it at a limit of zero would put the paywall in
 * front of the résumé instead of in front of the fill. Reprocessing is only reachable from a
 * source that already exists, by somebody who has already been through that, and it is the one
 * endpoint here that can be called an unbounded number of times on unchanged input: a loop over
 * this would otherwise re-run a multimodal extraction and a memory ingest, on our bill, forever.
 * The rate limiter caps the rate; the quota caps the total.
 */
const reprocessSourceRoute = createRoute({
  method: 'post',
  path: '/sources/{id}/reprocess',
  tags: ['profile'],
  summary: 'Read a source again',
  description:
    'Re-runs the ingest for an existing source: re-indexes it and re-extracts identity details. The stored original and the source id are unchanged. Costs one action.',
  operationId: 'reprocessSource',
  security: bearerAuth,
  middleware: [enforceQuota] as const,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Source re-read and profile recompiled',
      content: { 'application/json': { schema: ProfileResponse } },
    },
    ...errorResponses,
  },
})

profileRoutes.openapi(reprocessSourceRoute, async (c) => {
  const { id } = c.req.valid('param')
  const db = drizzle(c.env.DB)
  const userId = c.get('userId')

  const source = await getSource(db, userId, id)

  /**
   * The new document is created before the old one is deleted, and the delete is best-effort.
   *
   * Deleting first would mean a failure in the middle leaves the user with a source row pointing
   * at nothing — indexed content gone, and no way to get it back short of re-uploading. This way
   * the worst case is one orphaned document in memory, which costs us a little storage and costs
   * the user nothing. The row always ends up pointing at whichever document actually exists.
   */
  let memoryId: string | null = null
  const text = source.extractedText ?? ''
  let structured: Awaited<ReturnType<typeof structureSource>>['structured'] | undefined

  if (source.kind === 'link') {
    if (!source.url) {
      throw new ApiErrorResponse('INVALID_REQUEST', 'That link has no address stored')
    }
    const [documentId, page] = await Promise.all([
      addUrl(c.env, userId, source.url, { label: source.label }),
      fetchUrlAsMarkdown(c.env, source.url),
    ])
    memoryId = documentId
    structured = await structureSource(
      c.env,
      { kind: 'text', text: page.markdown },
      source.label,
      userId,
    )
      .then((r) => r.structured)
      .catch(() => undefined)
  } else if (source.kind === 'text') {
    if (!text) {
      throw new ApiErrorResponse('INVALID_REQUEST', 'That note has no text stored')
    }
    const [documentId, extracted] = await Promise.all([
      addContent(c.env, userId, text, { label: source.label }),
      structureSource(c.env, { kind: 'text', text }, source.label, userId)
        .then((r) => r.structured)
        .catch(() => undefined),
    ])
    memoryId = documentId
    structured = extracted
  } else {
    /*
      A file source is re-read from R2, not from the user.

      This is the case the old "add it again" could not do at all without asking them to find the
      file a second time — and the common reason to want it is that the first memory ingest
      returned null, which has nothing to do with the bytes.
    */
    if (!source.r2Key) {
      throw new ApiErrorResponse(
        'INVALID_REQUEST',
        'The original file is no longer stored, so it cannot be read again. Remove it and add it again.',
      )
    }
    const object = await c.env.UPLOADS.get(source.r2Key)
    if (!object) {
      throw new ApiErrorResponse(
        'INVALID_REQUEST',
        'The original file is no longer stored, so it cannot be read again. Remove it and add it again.',
      )
    }

    const mediaType = source.mediaType ?? 'application/octet-stream'
    const bytes = await object.arrayBuffer()
    const file = new File([bytes], source.label, { type: mediaType })

    memoryId = await addFile(c.env, userId, file, { label: source.label })

    // Same rule as the upload route: extraction reads for contact details, and a voice note or a
    // photograph has none, so the call would be spent to learn nothing.
    if (source.kind === 'document') {
      structured = await structureSource(
        c.env,
        { kind: 'file', bytes, mediaType },
        source.label,
        userId,
      )
        .then((r) => r.structured)
        .catch(() => undefined)
    }
  }

  if (source.memoryId && source.memoryId !== memoryId) {
    // Best-effort, and never fatal: see above. `deleteDocument` reports rather than throws.
    const gone = await deleteDocument(c.env, source.memoryId)
    if (!gone) console.debug('[aff] orphaned memory document after reprocess', source.memoryId)
  }

  const profile = await recordReingest(db, userId, id, {
    memoryId,
    text,
    structured,
    // A source that reached no index is not ready, however well the extraction went — the same
    // judgement the upload route makes, for the same reason.
    ...(memoryId
      ? { status: 'ready' as const, error: null }
      : { status: 'failed' as const, error: 'Could not be indexed. Try again.' }),
  })

  /*
    Charged whether or not the index accepted it.

    The provider calls have already been made and paid for by this point, and the ingest is the
    expensive half. Refunding a failed reprocess would leave the one endpoint that can be retried
    without limit free to retry without limit, which is the loop this is metered to prevent.
  */
  await chargeIngest(c.env, userId)

  return c.json({ profile }, 200)
})

const deleteSourceRoute = createRoute({
  method: 'delete',
  path: '/sources/{id}',
  tags: ['profile'],
  summary: 'Remove a source and its stored original',
  operationId: 'deleteSource',
  security: bearerAuth,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Source removed and profile recompiled',
      content: { 'application/json': { schema: ProfileResponse } },
    },
    ...errorResponses,
  },
})

profileRoutes.openapi(deleteSourceRoute, async (c) => {
  const { id } = c.req.valid('param')
  const { profile, memoryId, r2Key } = await deleteSource(drizzle(c.env.DB), c.get('userId'), id)

  // Delete the stored original too. If the user removed their resume, leaving the document
  // in memory is a privacy failure, not just wasted storage. Awaited rather than
  // backgrounded so a failure surfaces as a retryable error instead of silently keeping it.
  /**
   * Report a failed delete instead of swallowing it.
   *
   * `deleteDocument` returns `false` rather than throwing, and this used to discard that
   * boolean — so "remove my resume" could leave the document indexed forever while the UI
   * said it was gone. The row is already deleted by this point, which means the id is
   * unrecoverable, so the honest thing is to tell the user it needs retrying.
   */
  const [memoryGone] = await Promise.all([
    memoryId ? deleteDocument(c.env, memoryId) : Promise.resolve(true),
    r2Key ? c.env.UPLOADS.delete(r2Key).then(() => true) : Promise.resolve(true),
  ])

  if (!memoryGone) {
    throw new ApiErrorResponse(
      'UPSTREAM_ERROR',
      'Removed from your profile, but the stored copy could not be deleted. Try again.',
    )
  }

  return c.json({ profile }, 200)
})
