import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  generateOtp,
  generateResetGrant,
  hashResetSecret,
  isResetSecretUnexpired,
  resetSecretMatches,
  RESET_GRANT_TTL_MS,
  RESET_OTP_TTL_MS,
} from '../src/services/passwordReset.js'

test('password reset OTPs are cryptographically generated six-digit strings', () => {
  for (let index = 0; index < 100; index += 1) assert.match(generateOtp(), /^\d{6}$/)
})

test('reset grants are unguessable and reset secrets are stored as keyed hashes', () => {
  const previous = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = 'test-only-session-secret-with-more-than-32-characters'
  try {
    const otp = generateOtp()
    const hash = hashResetSecret(otp)
    const grant = generateResetGrant()
    assert.notEqual(hash, otp)
    assert.equal(resetSecretMatches(otp, hash), true)
    assert.equal(resetSecretMatches('000000', hash), otp === '000000')
    assert.ok(grant.length >= 40)
    assert.notEqual(hashResetSecret(grant), grant)
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = previous
  }
})

test('OTP and reset-grant expirations reject expired or malformed dates', () => {
  const now = Date.now()
  assert.equal(RESET_OTP_TTL_MS, 10 * 60 * 1000)
  assert.equal(RESET_GRANT_TTL_MS, 10 * 60 * 1000)
  assert.equal(isResetSecretUnexpired(new Date(now + 1), now), true)
  assert.equal(isResetSecretUnexpired(new Date(now), now), false)
  assert.equal(isResetSecretUnexpired(new Date(now - 1), now), false)
  assert.equal(isResetSecretUnexpired(undefined, now), false)
})
