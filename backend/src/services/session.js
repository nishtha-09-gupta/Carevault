import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'carevault_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60

export function assertSessionSecret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    const error = new Error('SESSION_SECRET must contain at least 32 characters.')
    error.statusCode = 503
    throw error
  }
  return process.env.SESSION_SECRET
}

function signature(value) {
  return createHmac('sha256', assertSessionSecret()).update(value).digest('base64url')
}

export function createSession(userId, version = 0) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, ver: version, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifySession(token) {
  const [payload, supplied] = token.split('.')
  if (!payload || !supplied) throw new Error('Malformed session.')
  const expected = Buffer.from(signature(payload))
  const actual = Buffer.from(supplied)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid session signature.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
  if (!claims.sub || claims.exp <= Date.now() / 1000) throw new Error('Session expired.')
  return claims
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`)
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`)
}
