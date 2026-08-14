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
  SourceKind,
  TextSourceRequest,
} from '../openapi/schemas.js'
import { fetchUrlAsMarkdown } from '../profile/fetch-url.js'
import { parseFreeform } from '../profile/parse.js'
import { mediaTypeFor, structureSource } from '../profile/structure.js'
import { addSource, deleteSource, getProfile, updateStructured } from '../services/profile.js'
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
    /**
     * The link goes to Supermemory, which renders and re-crawls the page itself.
     *
     * We still fetch it once here, but only to run the structuring pass: tier-0 needs typed
     * identity values (an email address, a phone number) and retrieval returns passages,
     * not fields. The full page content is Supermemory's copy, not ours.
     */
    const [memoryId, page] = await Promise.all([
      addUrl(c.env, userId, body.url, { kind: body.kind, label: body.label }),
      fetchUrlAsMarkdown(c.env, body.url),
    ])

    const { structured } = await structureSource(
      c.env,
      { kind: 'text', text: page.markdown },
      body.label,
    )

    const profile = await addSource(db, userId, {
      kind: body.kind,
      label: body.label,
      // Only the structured summary is kept locally; the full text lives in memory.
      text: structured.summary ?? '',
      ...(memoryId ? { memoryId } : {}),
      structured,
    })
    return c.json({ profile, truncated: page.truncated }, 200)
  }

  if (body.text) {
    const parsed = parseFreeform(body.text)
    const [memoryId, { structured }] = await Promise.all([
      addContent(c.env, userId, parsed.text, { kind: body.kind, label: body.label }),
      structureSource(c.env, { kind: 'text', text: parsed.text }, body.label),
    ])
    const profile = await addSource(db, userId, {
      kind: body.kind,
      label: body.label,
      text: parsed.text,
      ...(memoryId ? { memoryId } : {}),
      structured,
    })
    return c.json({ profile, truncated: parsed.truncated }, 200)
  }

  throw new ApiErrorResponse('INVALID_REQUEST', 'Provide either a url or text')
})

/**
 * File upload is declared as multipart rather than JSON: base64-encoding a PDF into a JSON
 * body costs a 33% size tax on every upload for no benefit.
 */
const uploadSourceRoute = createRoute({
  method: 'post',
  path: '/sources/upload',
  tags: ['profile'],
  summary: 'Upload a PDF or image source',
  operationId: 'uploadSource',
  security: bearerAuth,
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
            kind: SourceKind,
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
  const { file, kind } = c.req.valid('form')
  const db = drizzle(c.env.DB)
  const userId = c.get('userId')

  const mediaType = mediaTypeFor(file)
  if (!mediaType) {
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      'Unsupported file type. Upload a PDF or an image, or paste the text.',
    )
  }

  const bytes = await file.arrayBuffer()

  /**
   * Both calls take the file as-is, in parallel.
   *
   * Supermemory stores and indexes the original — including audio and video, and scans that
   * no text parser could read. The structuring pass reads the same bytes with a multimodal
   * model to pull out typed identity fields. Neither needs a local extraction step, which is
   * why the PDF parser, the transcription call, and the R2 bucket are all gone.
   */
  const [memoryId, { structured }] = await Promise.all([
    addFile(c.env, userId, file, { kind, label: file.name }),
    structureSource(c.env, { kind: 'file', bytes, mediaType }, file.name),
  ])

  const profile = await addSource(db, userId, {
    kind,
    label: file.name,
    // The document itself lives in memory; a second copy here would only bloat the profile
    // document that goes into every prompt.
    text: structured.summary ?? '',
    ...(memoryId ? { memoryId } : {}),
    structured,
  })
  return c.json({ profile, truncated: false }, 200)
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
  const { profile, memoryId } = await deleteSource(drizzle(c.env.DB), c.get('userId'), id)

  // Delete the stored original too. If the user removed their resume, leaving the document
  // in memory is a privacy failure, not just wasted storage. Awaited rather than
  // backgrounded so a failure surfaces as a retryable error instead of silently keeping it.
  if (memoryId) {
    await deleteDocument(c.env, memoryId)
  }

  return c.json({ profile }, 200)
})
