import { ApiErrorResponse } from '@aff/shared'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/d1'
import type { AppEnv } from '../env.js'
import { requireAuth } from '../middleware/auth.js'
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
import {
  isPreviewableInline,
  MAX_UPLOAD_BYTES,
  mediaTypeFor,
  sourceKindFor,
} from '../profile/media.js'
import { parseFreeform } from '../profile/parse.js'
import { structureSource } from '../profile/structure.js'
import {
  addSource,
  deleteSource,
  getProfile,
  getSourceFile,
  updateStructured,
} from '../services/profile.js'
import { addContent, addFile, addUrl, deleteDocument } from '../services/supermemory.js'

export const profileRoutes = new OpenAPIHono<AppEnv>()

profileRoutes.use('*', requireAuth)

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
    return c.json({ profile, truncated: page.truncated }, 200)
  }

  if (body.text) {
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

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.`,
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

  const [memoryId, structured] = await Promise.all([
    addFile(c.env, userId, file, { label }),
    c.env.UPLOADS.put(r2Key, bytes, { httpMetadata: { contentType: mediaType } }),
    kind === 'document'
      ? structureSource(c.env, { kind: 'file', bytes, mediaType }, label, userId).then(
          (r) => r.structured,
        )
      : Promise.resolve(undefined),
  ]).then(([id, , extracted]) => [id, extracted] as const)

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
  })
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
  await Promise.all([
    memoryId ? deleteDocument(c.env, memoryId) : Promise.resolve(),
    r2Key ? c.env.UPLOADS.delete(r2Key) : Promise.resolve(),
  ])

  return c.json({ profile }, 200)
})
