import {
  Account as AccountBase,
  ApiError as ApiErrorBase,
  EducationEntry as EducationEntryBase,
  ExperienceEntry as ExperienceEntryBase,
  FeedbackRequest as FeedbackRequestBase,
  FillPlan as FillPlanBase,
  FillRequest as FillRequestBase,
  Identity as IdentityBase,
  Profile as ProfileBase,
  ProfileSource as ProfileSourceBase,
  SourceKind as SourceKindBase,
  StyleProfile as StyleProfileBase,
} from '@aff/shared'
import { z } from '@hono/zod-openapi'

/**
 * Names the shared Zod schemas as OpenAPI components.
 *
 * The schemas themselves live in `@aff/shared` and stay the single source of truth — this
 * module only attaches the names orval turns into TypeScript interfaces. Defining shapes
 * here instead would reintroduce exactly the drift the shared package exists to prevent.
 */

export const Identity = IdentityBase.openapi('Identity')
export const EducationEntry = EducationEntryBase.openapi('EducationEntry')
export const ExperienceEntry = ExperienceEntryBase.openapi('ExperienceEntry')
export const StyleProfile = StyleProfileBase.openapi('StyleProfile')
export const ProfileSource = ProfileSourceBase.openapi('ProfileSource')
export const Profile = ProfileBase.openapi('Profile')
export const SourceKind = SourceKindBase.openapi('SourceKind')
export const Account = AccountBase.openapi('Account')
export const ApiError = ApiErrorBase.openapi('ApiError')
export const FillRequest = FillRequestBase.openapi('FillRequest')
export const FillPlan = FillPlanBase.openapi('FillPlan')
export const FeedbackRequest = FeedbackRequestBase.openapi('FeedbackRequest')

export const SignInRequest = z
  .object({
    /** The value returned by `chrome.identity.getAuthToken`. */
    accessToken: z.string().min(1),
  })
  .openapi('SignInRequest')

export const SignInResponse = z
  .object({ token: z.string(), account: Account })
  .openapi('SignInResponse')

export const ProfilePatch = z
  .object({
    identity: Identity.optional(),
    education: z.array(EducationEntry).optional(),
    experience: z.array(ExperienceEntry).optional(),
    skills: z.array(z.string()).optional(),
    custom: z.record(z.string(), z.string()).optional(),
    style: StyleProfile.optional(),
  })
  .openapi('ProfilePatch')

export const TextSourceRequest = z
  .object({
    kind: SourceKind,
    label: z.string().min(1).max(200),
    url: z.string().url().optional(),
    text: z.string().optional(),
  })
  .openapi('TextSourceRequest')

export const AddSourceResponse = z
  .object({ profile: Profile, truncated: z.boolean() })
  .openapi('AddSourceResponse')

export const ProfileResponse = z.object({ profile: Profile }).openapi('ProfileResponse')

/** Shared error responses, attached to every route so the generated client knows them. */
export const errorResponses = {
  400: {
    description: 'Request failed validation',
    content: { 'application/json': { schema: ApiError } },
  },
  401: {
    description: 'Missing, invalid, or expired credentials',
    content: { 'application/json': { schema: ApiError } },
  },
  402: {
    description: 'Monthly quota exhausted',
    content: { 'application/json': { schema: ApiError } },
  },
  429: {
    description: 'Rate limited',
    content: { 'application/json': { schema: ApiError } },
  },
  500: {
    description: 'Internal error',
    content: { 'application/json': { schema: ApiError } },
  },
} as const

/** Referenced by every authenticated route so orval emits the auth requirement. */
export const bearerAuth = [{ bearerAuth: [] as string[] }]
