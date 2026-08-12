import { ApiErrorResponse } from '@aff/shared'
import { jwtVerify, SignJWT } from 'jose'

const ISSUER = 'aff-api'
const AUDIENCE = 'aff-extension'
const TTL_SECONDS = 60 * 60 * 24 * 30

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function issueSessionToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key(secret))
}

export async function verifySessionToken(token: string, secret: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (!payload.sub) {
      throw new ApiErrorResponse('INVALID_TOKEN', 'Session token has no subject')
    }
    return payload.sub
  } catch (cause) {
    if (cause instanceof ApiErrorResponse) throw cause
    throw new ApiErrorResponse('INVALID_TOKEN', 'Session token is invalid or expired')
  }
}
