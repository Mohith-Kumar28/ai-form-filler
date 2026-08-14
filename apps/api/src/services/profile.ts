import { ApiErrorResponse, type Profile, type ProfileSource, type SourceKind } from '@aff/shared'
import { and, eq } from 'drizzle-orm'
import { profileDocs, profileSources } from '../db/schema.js'
import { compileProfileDoc } from '../profile/compile.js'
import { extractIdentity, mergeIdentity } from '../profile/extract.js'
import type { StructuredSource } from '../profile/structure.js'
import type { Db } from './account.js'

/** A Profile with no sources yet — every field explicit so the compiler's input is total. */
export function emptyProfile(): Omit<Profile, 'sources'> {
  return {
    identity: { links: {} },
    custom: {},
    learned: [],
    version: 0,
  }
}

type StructuredProfile = Omit<Profile, 'sources'>

/** Drops undefined values so a spread cannot overwrite a stored field with nothing. */
function definedOnly<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

/**
 * Reads the stored structured profile, falling back to an empty one.
 *
 * Deliberately tolerant of malformed JSON: a parse failure here would otherwise brick a
 * user's entire profile page with a 500. An empty profile is recoverable; a hard error is not.
 */
/** The stored structured profile. Exported so the learning loop can read before it writes. */
export async function getStructured(db: Db, userId: string): Promise<StructuredProfile> {
  return loadStructured(db, userId)
}

async function loadStructured(db: Db, userId: string): Promise<StructuredProfile> {
  const rows = await db
    .select({ structured: profileDocs.structuredJson, version: profileDocs.version })
    .from(profileDocs)
    .where(eq(profileDocs.userId, userId))
    .limit(1)

  const row = rows[0]
  if (!row) return emptyProfile()

  try {
    return { ...emptyProfile(), ...(JSON.parse(row.structured) as StructuredProfile) }
  } catch {
    return { ...emptyProfile(), version: row.version }
  }
}

/**
 * Recompiles PROFILE_DOC and persists it.
 *
 * The version is bumped **only when the hash actually changes**. Recompiling produces
 * identical bytes for unchanged input (see compile.test.ts), so a no-op edit shouldn't
 * invalidate the extension's cached copy or churn the prompt cache.
 */
export async function recompileProfile(db: Db, userId: string): Promise<{ version: number }> {
  const structured = await loadStructured(db, userId)

  // Source text is no longer inlined: memory retrieval supplies it, selected against the
  // questions being asked rather than shipped whole on every request.
  const compiled = await compileProfileDoc({ ...structured, sources: [] })

  const existing = await db
    .select({ hash: profileDocs.hash, version: profileDocs.version })
    .from(profileDocs)
    .where(eq(profileDocs.userId, userId))
    .limit(1)

  const previous = existing[0]
  if (previous?.hash === compiled.hash) {
    return { version: previous.version }
  }

  const version = (previous?.version ?? 0) + 1
  const row = {
    userId,
    version,
    doc: compiled.doc,
    hash: compiled.hash,
    structuredJson: JSON.stringify({ ...structured, version }),
    estimatedTokens: compiled.estimatedTokens,
    updatedAt: Date.now(),
  }

  await db
    .insert(profileDocs)
    .values(row)
    .onConflictDoUpdate({ target: profileDocs.userId, set: row })

  return { version }
}

export async function getProfile(db: Db, userId: string): Promise<Profile> {
  const [structured, sourceRows] = await Promise.all([
    loadStructured(db, userId),
    db.select().from(profileSources).where(eq(profileSources.userId, userId)),
  ])

  const sources: ProfileSource[] = sourceRows
    .map((row) => ({
      id: row.id,
      kind: row.kind as SourceKind,
      label: row.label,
      status: row.status,
      ...(row.error ? { error: row.error } : {}),
      ...(row.extractedText ? { extractedChars: row.extractedText.length } : {}),
      ...(row.mediaType ? { mediaType: row.mediaType } : {}),
      ...(row.sizeBytes !== null ? { sizeBytes: row.sizeBytes } : {}),
      ...(row.url ? { url: row.url } : {}),
      // Whether the original bytes can be fetched back — what the UI needs to decide
      // between offering a preview and offering nothing.
      hasFile: row.r2Key !== null,
      createdAt: new Date(row.createdAt).toISOString(),
    }))
    // Newest first, with the id as a tiebreak so same-millisecond uploads have a stable order.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))

  return { ...structured, sources }
}

/**
 * Applies a partial edit from the side-panel editor and recompiles.
 *
 * `identity` is merged **field by field**; every other key is replaced wholesale.
 *
 * The asymmetry is deliberate. Identity is a flat bag of independently-editable fields, so
 * a wholesale replace means saving the name field wipes the auto-extracted email — silent
 * data loss the user only discovers when a form fills wrong. Lists (education, skills) are
 * edited as lists, where replace is exactly what the user means.
 *
 * To clear an identity field, send an empty string; omitting it keeps the stored value.
 */
export async function updateStructured(
  db: Db,
  userId: string,
  patch: Partial<StructuredProfile>,
): Promise<Profile> {
  const current = await loadStructured(db, userId)

  const identity = patch.identity
    ? {
        ...current.identity,
        ...definedOnly(patch.identity),
        links: { ...current.identity.links, ...(patch.identity.links ?? {}) },
      }
    : current.identity

  const merged: StructuredProfile = { ...current, ...patch, identity }

  const existing = await db
    .select({ version: profileDocs.version })
    .from(profileDocs)
    .where(eq(profileDocs.userId, userId))
    .limit(1)

  // Persist the edit first so recompile reads it; recompile then owns the version bump.
  await db
    .insert(profileDocs)
    .values({
      userId,
      version: existing[0]?.version ?? 0,
      doc: '',
      hash: '',
      structuredJson: JSON.stringify(merged),
      estimatedTokens: 0,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: profileDocs.userId,
      set: { structuredJson: JSON.stringify(merged), updatedAt: Date.now() },
    })

  await recompileProfile(db, userId)
  return getProfile(db, userId)
}

/**
 * Looks up one source's stored file, scoped to its owner.
 *
 * The userId is in the WHERE clause rather than assumed from the key's prefix: the prefix
 * does contain it, but a lookup that trusts the caller's id to match is one refactor away
 * from letting anyone read anyone's resume by guessing a source id.
 */
export async function getSourceFile(
  db: Db,
  userId: string,
  sourceId: string,
): Promise<{ r2Key: string | null; mediaType: string | null; label: string } | null> {
  const rows = await db
    .select({
      r2Key: profileSources.r2Key,
      mediaType: profileSources.mediaType,
      label: profileSources.label,
    })
    .from(profileSources)
    .where(and(eq(profileSources.id, sourceId), eq(profileSources.userId, userId)))
    .limit(1)

  return rows[0] ?? null
}

export interface NewSource {
  kind: SourceKind
  label: string
  text: string
  /** Supermemory document id, kept so deleting the source deletes the original too. */
  memoryId?: string
  /** R2 key for the original file, when there is one. Drives preview and form attachment. */
  r2Key?: string
  mediaType?: string
  sizeBytes?: number
  /** Where a link source points. */
  url?: string
  /** Structured extraction from the ingest pass, merged into the profile below. */
  structured?: StructuredSource
}

/**
 * Folds a structured extraction into the stored profile.
 *
 * Union rather than replace, deduplicated by a natural key: a person adds a resume, then a
 * portfolio, then a LinkedIn export, and each should *add* to what we know rather than
 * overwrite it. User-entered values still win over anything extracted.
 */
/** Treats undefined, null, and whitespace-only as absent — a cleared field is an empty one. */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}

/**
 * Extraction fills gaps. It never overwrites.
 *
 * A value already in the profile was either typed by the user or read from a document they
 * chose to add, and in both cases it is the more trustworthy of the two — an extractor
 * reading a stale resume should not be able to replace the phone number someone just
 * corrected by hand.
 *
 * `??=` was not enough on its own: it only skips `undefined`, so a field the user had
 * *cleared* to an empty string stayed permanently empty and could never be refilled by a
 * later source. Blank means empty, and empty means fillable.
 */
function fillIfEmpty(
  current: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (!isBlank(current)) return current
  return isBlank(incoming) ? current : incoming
}

function mergeStructured(
  current: StructuredProfile,
  extracted: StructuredSource,
): StructuredProfile {
  const identity = { ...current.identity }
  identity.fullName = fillIfEmpty(identity.fullName, extracted.identity.fullName)
  identity.email = fillIfEmpty(identity.email, extracted.identity.email)
  identity.phone = fillIfEmpty(identity.phone, extracted.identity.phone)
  identity.location = fillIfEmpty(identity.location, extracted.identity.location)
  identity.pronouns = fillIfEmpty(identity.pronouns, extracted.identity.pronouns)
  identity.workAuthorization = fillIfEmpty(
    identity.workAuthorization,
    extracted.identity.workAuthorization,
  )

  // Same rule per platform: a link already recorded wins over a newly extracted one.
  identity.links = {
    ...Object.fromEntries(extracted.identity.links.map((l) => [l.platform, l.url])),
    ...current.identity.links,
  }

  // `custom` is user-typed only. Nothing extracted is allowed in, so there is nothing to
  // merge — the whole point of that field is that it is theirs.
  return { ...current, identity }
}

/**
 * Stores a parsed source, folds any newly-discovered contact details into the identity,
 * and recompiles. Heuristic extraction never overwrites a user-entered value.
 */
export async function addSource(db: Db, userId: string, source: NewSource): Promise<Profile> {
  const id = `src_${crypto.randomUUID()}`

  await db.insert(profileSources).values({
    id,
    userId,
    kind: source.kind,
    label: source.label,
    memoryId: source.memoryId ?? null,
    r2Key: source.r2Key ?? null,
    mediaType: source.mediaType ?? null,
    sizeBytes: source.sizeBytes ?? null,
    url: source.url ?? null,
    status: 'ready',
    extractedText: source.text,
    createdAt: Date.now(),
  })

  const current = await loadStructured(db, userId)

  // The LLM pass is authoritative when it ran; the regex extractor is the fallback for
  // sources that were ingested without it.
  const merged = source.structured
    ? mergeStructured(current, source.structured)
    : { ...current, identity: mergeIdentity(current.identity, extractIdentity(source.text)) }

  return updateStructured(db, userId, merged)
}

/**
 * Deletes a source and reports the R2 key the caller must also delete.
 *
 * The key is returned rather than deleted here so this module stays DB-only, but the caller
 * *must* act on it: leaving the object behind means a user who deleted their resume still
 * has it stored with us. That is a privacy failure, not just wasted storage.
 */
export async function deleteSource(
  db: Db,
  userId: string,
  sourceId: string,
): Promise<{ profile: Profile; memoryId: string | null; r2Key: string | null }> {
  const deleted = await db
    .delete(profileSources)
    // Scoped by userId as well as id — without it, any authenticated user could delete
    // another user's source by guessing an id.
    .where(and(eq(profileSources.id, sourceId), eq(profileSources.userId, userId)))
    .returning({
      id: profileSources.id,
      memoryId: profileSources.memoryId,
      r2Key: profileSources.r2Key,
    })

  const row = deleted[0]
  if (!row) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'No such source')
  }

  await recompileProfile(db, userId)
  return { profile: await getProfile(db, userId), memoryId: row.memoryId, r2Key: row.r2Key }
}
