import { z } from 'zod'

/** Where a piece of knowledge came from. Everything is normalised to text at ingest. */
export const SourceKind = z.enum([
  'resume',
  'transcript',
  'linkedin',
  'github',
  'portfolio',
  'freeform',
  'image',
])
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
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  /** Keyed by platform: `linkedin`, `github`, `website`, `twitter`, ... */
  links: z.record(z.string(), z.string().url()).default({}),
  workAuthorization: z.string().optional(),
  pronouns: z.string().optional(),
})
export type Identity = z.infer<typeof Identity>

export const EducationEntry = z.object({
  institution: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  /** Free text, not a number — "8.4 CGPA", "3.7/4.0", and "First Class" are all valid. */
  grade: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})
export type EducationEntry = z.infer<typeof EducationEntry>

export const ExperienceEntry = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).default([]),
})
export type ExperienceEntry = z.infer<typeof ExperienceEntry>

/**
 * Learned writing voice, applied to every tier-2/3 answer. Derived from accepted answers
 * over time rather than asked for up front — users describe their own writing badly.
 */
export const StyleProfile = z.object({
  tone: z.string().optional(),
  averageSentenceLength: z.number().optional(),
  /** Short excerpts of the user's own accepted writing, used as few-shot examples. */
  exemplars: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
})
export type StyleProfile = z.infer<typeof StyleProfile>

export const Profile = z.object({
  identity: Identity,
  education: z.array(EducationEntry).default([]),
  experience: z.array(ExperienceEntry).default([]),
  skills: z.array(z.string()).default([]),
  /** Anything that doesn't fit the schema above — visa status, dietary needs, t-shirt size. */
  custom: z.record(z.string(), z.string()).default({}),
  style: StyleProfile,
  sources: z.array(ProfileSource).default([]),
  /** Bumped on every recompile. The extension uses it to invalidate its cached copy. */
  version: z.number().int().nonnegative().default(0),
})
export type Profile = z.infer<typeof Profile>
