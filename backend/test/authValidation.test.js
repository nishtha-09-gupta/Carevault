import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidPassword, PASSWORD_ERROR } from '../src/utils/passwordValidation.js'

test('password validation accepts only strings from 6 through 128 characters', () => {
  assert.equal(isValidPassword('a'.repeat(6)), true)
  assert.equal(isValidPassword('a'.repeat(128)), true)
  assert.equal(isValidPassword('a'.repeat(5)), false)
  assert.equal(isValidPassword('a'.repeat(129)), false)
  assert.equal(isValidPassword(null), false)
})

test('password validation uses the approved user-facing message', () => {
  assert.equal(PASSWORD_ERROR, 'Password must be at least 6 characters long')
  assert.doesNotMatch(PASSWORD_ERROR, /128/)
})
