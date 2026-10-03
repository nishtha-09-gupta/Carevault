import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const RESET_OTP_TTL_MS = 10 * 60 * 1000
export const RESET_RESEND_COOLDOWN_MS = 60 * 1000
export const RESET_GRANT_TTL_MS = 10 * 60 * 1000
export const RESET_OTP_MAX_ATTEMPTS = 5

export function isResetSecretUnexpired(expiresAt, now = Date.now()) {
  return expiresAt instanceof Date && expiresAt.getTime() > now
}

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function generateResetGrant() {
  return randomBytes(32).toString('base64url')
}

export function hashResetSecret(value) {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Reset service is unavailable.')
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function resetSecretMatches(value, hash) {
  if (typeof value !== 'string' || typeof hash !== 'string') return false
  const expected = Buffer.from(hashResetSecret(value), 'hex')
  const supplied = Buffer.from(hash, 'hex')
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}
