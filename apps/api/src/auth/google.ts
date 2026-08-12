import { ApiErrorResponse } from '@aff/shared'
import { z } from 'zod'

/**
 * `chrome.identity.getAuthToken` hands the extension an OAuth **access token**, not an
 * ID token — so there is no signature for us to verify locally. We validate it with
 * Google instead.
 *
 * The `aud` check below is the load-bearing part. Without it, an access token minted for
 * *any* Google OAuth app would authenticate here, and any extension or site the user has
 * ever granted a Google scope to could impersonate them against our API.
 */
const TokenInfo = z.object({
  aud: z.string(),
  sub: z.string(),
  email: z.string().email().optional(),
  email_verified: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
  expires_in: z.coerce.number().optional(),
})

const UserInfo = z.object({
  sub: z.string(),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
})

export interface GoogleIdentity {
  sub: string
  email: string
  name?: string
  avatarUrl?: string
}

export async function verifyGoogleAccessToken(
  accessToken: string,
  expectedClientId: string,
): Promise<GoogleIdentity> {
  const [tokenInfoRes, userInfoRes] = await Promise.all([
    fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    ),
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ])

  if (!tokenInfoRes.ok) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Google rejected the access token')
  }

  const tokenInfo = TokenInfo.safeParse(await tokenInfoRes.json())
  if (!tokenInfo.success) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Unexpected token introspection response')
  }

  // The whole point of introspection. Do not remove.
  if (tokenInfo.data.aud !== expectedClientId) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Token was not issued for this application')
  }

  if (!userInfoRes.ok) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Could not read Google profile')
  }

  const userInfo = UserInfo.safeParse(await userInfoRes.json())
  if (!userInfo.success) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Unexpected profile response')
  }

  // Guard against the two responses describing different people.
  if (userInfo.data.sub !== tokenInfo.data.sub) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Token and profile subject mismatch')
  }

  if (userInfo.data.email_verified === false) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'Google account email is not verified')
  }

  return {
    sub: userInfo.data.sub,
    email: userInfo.data.email,
    ...(userInfo.data.name ? { name: userInfo.data.name } : {}),
    ...(userInfo.data.picture ? { avatarUrl: userInfo.data.picture } : {}),
  }
}
