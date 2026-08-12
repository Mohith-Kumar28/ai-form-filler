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
import { parseFreeform, parsePdf, parseUrl } from '../profile/parse.js'
import { addSource, deleteSource, getProfile, updateStructured } from '../services/profile.js'

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
    const parsed = await parseUrl(body.url)
    const profile = await addSource(db, userId, {
      kind: body.kind,
      label: body.label,
      text: parsed.text,
    })
    return c.json({ profile, truncated: parsed.truncated }, 200)
  }

  if (body.text) {
    const parsed = parseFreeform(body.text)
    const profile = await addSource(db, userId, {
      kind: body.kind,
      label: body.label,
      text: parsed.text,
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
  summary: 'Upload a PDF source',
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

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    throw new ApiErrorResponse(
      'INVALID_REQUEST',
      'Only PDF uploads are supported right now. Paste the text for other formats.',
    )
  }

  const bytes = await file.arrayBuffer()

  // Parse before storing. A PDF we cannot read should fail the request outright rather than
  // leave an unusable object in R2 and a `failed` row for the user to clean up.
  const parsed = await parsePdf(bytes)

  const r2Key = `${userId}/${crypto.randomUUID()}-${file.name}`
  await c.env.UPLOADS.put(r2Key, bytes, { httpMetadata: { contentType: 'application/pdf' } })

  const profile = await addSource(db, userId, {
    kind,
    label: file.name,
    text: parsed.text,
    r2Key,
  })
  return c.json({ profile, truncated: parsed.truncated }, 200)
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
  const { profile, orphanedR2Key } = await deleteSource(drizzle(c.env.DB), c.get('userId'), id)

  // Delete the stored original too. If the user removed their resume, keeping the file is a
  // privacy failure. Awaited rather than backgrounded so a failure surfaces as a retryable
  // error instead of silently leaving the document behind.
  if (orphanedR2Key) {
    await c.env.UPLOADS.delete(orphanedR2Key)
  }

  return c.json({ profile }, 200)
})
