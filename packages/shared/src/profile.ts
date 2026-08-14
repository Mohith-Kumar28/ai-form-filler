import { z } from 'zod'

/** Where a piece of knowledge came from. Everything is normalised to text at ingest. */
/**
 * What a source *is*, by medium rather than by purpose.
 *
 * The previous set named intents — resume, transcript, linkedin, portfolio — which the user
 * had to pick from a dropdown before we would accept their file, and which told us nothing
 * we could act on: a resume and a transcript are both a PDF we hand to memory unchanged.
 * Medium is the thing the interface actually needs, because it decides the icon, whether a
 * preview opens in a tab or a lightbox, and whether the file can be attached to a form.
 */
export const SourceKind = z.enum(['document', 'link', 'text', 'image', 'audio'])
export type SourceKind = z.infer<typeof SourceKind>

export const SourceStatus = z.enum(['pending', 'parsing', 'ready', 'failed'])
export type SourceStatus = z.infer<typeof SourceStatus>

export const ProfileSource = z.object({
  id: z.string(),
  kind: SourceKind,
  label: z.string(),
  status: SourceStatus,
  /** Populated only on `failed`, shown inline in the side panel. */
  error: z.string().optional(),
  /** Extracted character count — a cheap proxy for "did parsing actually work". */
  extractedChars: z.number().int().nonnegative().optional(),
  /** Present when an original file is stored: what it is, how big, and where it came from. */
  mediaType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  /** The address a link source points at, so the list can show and open it. */
  url: z.string().optional(),
  /** True when the original bytes are retrievable — drives preview and form attachment. */
  hasFile: z.boolean().default(false),
  createdAt: z.string().datetime(),
})
export type ProfileSource = z.infer<typeof ProfileSource>

/**
 * Facts that answer deterministic fields without a model call. Tier 0 reads straight
 * from here, which is why keeping it well-populated is the single biggest cost lever.
 */
export const Identity = z.object({
  fullName: z.string().optional(),
  preferredName: z.string().optional(),
  /**
   * `''` is legal and means "cleared".
   *
   * The PATCH route documents an empty string as the way to clear a field, but a bare
   * `.email()` rejects it — so email was the one field a user could set and never unset,
   * and every later save of the whole identity failed validation with no way out from the UI.
   */
  email: z.union([z.literal(''), z.string().email()]).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  /** Keyed by platform: `linkedin`, `github`, `website`, `twitter`, ... */
  /** Same as email: `''` clears a link rather than failing the whole profile save. */
  links: z.record(z.string(), z.union([z.literal(''), z.string().url()])).default({}),
  workAuthorization: z.string().optional(),
  pronouns: z.string().optional(),
})
export type Identity = z.infer<typeof Identity>

/**
 * What we keep locally about a person — deliberately almost nothing.
 *
 * An earlier version modelled education, experience, skills, inferred preferences, a writing
 * voice, and a summary. All of it was a second, worse copy of what the memory layer already
 * builds from the same documents, and it had to be re-derived by an LLM on every ingest,
 * kept deterministic for the prompt cache, and rendered into every single prompt whether the
 * form needed it or not.
 *
 * Two things survive, because retrieval genuinely cannot do them:
 *
 *   - `identity`: tier 0 answers an email or phone field with **no model call at all**, which
 *     needs a typed value. Retrieval returns passages, and a passage is not a field.
 *   - `custom`: facts the user typed themselves. Their own answer outranks anything inferred
 *     from a document, so it is stored rather than searched for.
 *
 * Everything else — history, projects, voice, opinions — is retrieved from memory at fill
 * time, ranked against the question actually being asked.
 */
/**
 * One question the user has answered before, and what they answered.
 *
 * The third store, and the one the product was missing. Identity covers a fixed set of
 * contact slots; memory covers prose. Neither could hold "which device do you use? → iOS": too
 * specific to be an identity slot, too short to survive semantic retrieval against a résumé.
 * So the answer was learned, stored, and never seen again — the user picked iOS on every
 * single form.
 *
 * Keyed by the question because that is how it will be asked again. Rendered into the cached
 * profile prefix, so a repeat question is answered from what the user chose last time rather
 * than from whatever a search happened to return.
 */
export const LearnedAnswer = z.object({
  /**
   * The question as asked, normalised for whitespace. Doubles as the identity of the row.
   *
   * Both caps here sit deliberately **above** what the write path allows (see
   * `MAX_LEARNED_QUESTION_CHARS` and `MAX_CHOICE_FACT_CHARS`). A stored row that exceeded its
   * schema would fail validation on every later profile save, and the user could not clear it
   * from the UI — the failure mode `email` already carries a scar from. The write path is where
   * size is enforced; this is only a sanity bound.
   */
  question: z.string().max(400),
  answer: z.string().max(1000),
  /** The site it was learned on, shown in the UI so a remembered answer is traceable. */
  origin: z.string().max(200).optional(),
})
export type LearnedAnswer = z.infer<typeof LearnedAnswer>

export const Profile = z.object({
  identity: Identity,
  /** Facts the user typed: visa status, dietary needs, t-shirt size, notice period. */
  custom: z.record(z.string(), z.string()).default({}),
  /**
   * Answers learned from submitted forms, newest last.
   *
   * Deliberately **not** length-capped in the schema. The write path bounds it (see
   * `MAX_LEARNED_ANSWERS`), and a stored array that outgrew a schema cap would fail
   * validation on every later profile save with no way for the user to clear it — the same
   * failure mode `email` already carries a scar from.
   */
  learned: z.array(LearnedAnswer).default([]),
  sources: z.array(ProfileSource).default([]),
  /** Bumped on every recompile. The extension uses it to invalidate its cached copy. */
  version: z.number().int().nonnegative().default(0),
})
export type Profile = z.infer<typeof Profile>
