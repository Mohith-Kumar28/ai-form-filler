import { ApiErrorResponse, type Profile, type ProfileSource, type SourceKind } from '@aff/shared'
import { and, eq } from 'drizzle-orm'
import { profileDocs, profileSources } from '../db/schema.js'
import { compileProfileDoc } from '../profile/compile.js'
import { extractIdentity, mergeIdentity } from '../profile/extract.js'
import type { Db } from './account.js'

/** A Profile with no sources yet — every field explicit so the compiler's input is total. */
export function emptyProfile(): Omit<Profile, 'sources'> {
  return {
    identity: { links: {} },
    education: [],
    experience: [],
    skills: [],
    custom: {},
    style: { exemplars: [], avoid: [] },
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

async function loadReadySources(db: Db, userId: string) {
  return db
    .select({
      label: profileSources.label,
      kind: profileSources.kind,
      text: profileSources.extractedText,
    })
    .from(profileSources)
    .where(and(eq(profileSources.userId, userId), eq(profileSources.status, 'ready')))
}

/**
 * Recompiles PROFILE_DOC and persists it.
 *
 * The version is bumped **only when the hash actually changes**. Recompiling produces
 * identical bytes for unchanged input (see compile.test.ts), so a no-op edit shouldn't
 * invalidate the extension's cached copy or churn the prompt cache.
 */
export async function recompileProfile(db: Db, userId: string): Promise<{ version: number }> {
  const [structured, sources] = await Promise.all([
    loadStructured(db, userId),
    loadReadySources(db, userId),
  ])

  const compiled = await compileProfileDoc(
    { ...structured, sources: [] },
    sources.map((s) => ({ label: s.label, kind: s.kind, text: s.text ?? '' })),
  )

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

export interface NewSource {
  kind: SourceKind
  label: string
  text: string
  r2Key?: string
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
    status: 'ready',
    r2Key: source.r2Key ?? null,
    extractedText: source.text,
    createdAt: Date.now(),
  })

  const structured = await loadStructured(db, userId)
  const identity = mergeIdentity(structured.identity, extractIdentity(source.text))

  return updateStructured(db, userId, { identity })
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
): Promise<{ profile: Profile; orphanedR2Key: string | null }> {
  const deleted = await db
    .delete(profileSources)
    // Scoped by userId as well as id — without it, any authenticated user could delete
    // another user's source by guessing an id.
    .where(and(eq(profileSources.id, sourceId), eq(profileSources.userId, userId)))
    .returning({ id: profileSources.id, r2Key: profileSources.r2Key })

  const row = deleted[0]
  if (!row) {
    throw new ApiErrorResponse('INVALID_REQUEST', 'No such source')
  }

  await recompileProfile(db, userId)
  return { profile: await getProfile(db, userId), orphanedR2Key: row.r2Key }
}
