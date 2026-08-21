import {
  Account as AccountBase,
  ApiError as ApiErrorBase,
  DeletionReport as DeletionReportBase,
  FeedbackRequest as FeedbackRequestBase,
  FillPlan as FillPlanBase,
  FillRequest as FillRequestBase,
  Identity as IdentityBase,
  Profile as ProfileBase,
  ProfileSource as ProfileSourceBase,
  SourceKind as SourceKindBase,
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
    /** The user's own key/value facts. Replaced wholesale, like any array field. */
    custom: z.record(z.string(), z.string()).optional(),
  })
  .openapi('ProfilePatch')

export const TextSourceRequest = z
  .object({
    /**
     * A name for this source, required for links and optional for pasted text.
     *
     * A list of sources called "Untitled" three times over is unusable, and only the person
     * adding a link knows whether it is their portfolio or a job posting they are answering
     * about. Pasted text is the exception: it carries its own opening line, so demanding a
     * title before accepting it is friction with nothing behind it.
     */
    label: z.string().max(200).optional(),
    url: z.string().url().optional(),
    text: z.string().optional(),
  })
  .openapi('TextSourceRequest')

export const AddSourceResponse = z
  .object({ profile: Profile, truncated: z.boolean() })
  .openapi('AddSourceResponse')

export const DeleteAccountRequest = z
  .object({
    /**
     * The account's own email address, typed out by the user.
     *
     * Re-checked on the server, not merely collected by the panel. A confirmation only the
     * client enforces is decoration — the request is one `fetch` away from being sent without
     * it — and this is the request that cannot be undone. Matching is case- and
     * whitespace-insensitive; see `confirmationMatches`.
     */
    confirmEmail: z.string().min(1),
  })
  .openapi('DeleteAccountRequest')

export const DeleteAccountResponse = DeletionReportBase.openapi('DeleteAccountResponse')

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
