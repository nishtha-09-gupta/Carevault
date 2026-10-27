import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canRevokeAccess, countAccessHistory, effectiveGrantStatus, filterAccessHistory, paginateAccessHistory, visiblePageNumbers } from '../src/utils/sharingHistory.js'

const now = new Date('2026-10-27T12:00:00.000Z').getTime()
const grants = [
  { id: 'a', status: 'active', expiresAt: '2026-10-28T12:00:00.000Z', doctor: { name: 'Alex Rivera', email: 'alex@example.test' } },
  { id: 'b', status: 'active', expiresAt: '2026-10-26T12:00:00.000Z', doctor: { name: 'Morgan Lee', email: 'morgan@example.test' } },
  { id: 'c', status: 'expired', expiresAt: '2026-10-20T12:00:00.000Z', doctor: { name: 'Alex Kim', email: 'alex.kim@example.test' } },
  { id: 'd', status: 'revoked', expiresAt: '2026-10-30T12:00:00.000Z', revokedAt: '2026-10-25T12:00:00.000Z', doctor: { name: 'Taylor Jones', email: 'taylor@example.test' } },
]

test('status filtering and counts use persisted status plus grant expiry', () => {
  assert.deepEqual(grants.map((grant) => effectiveGrantStatus(grant, now)), ['active', 'expired', 'expired', 'revoked'])
  assert.deepEqual(countAccessHistory(grants, now), { all: 4, active: 1, expired: 2, revoked: 1 })
  assert.deepEqual(filterAccessHistory(grants, { status: 'active', now }).map((grant) => grant.id), ['a'])
  assert.deepEqual(filterAccessHistory(grants, { status: 'revoked', now }).map((grant) => grant.id), ['d'])
})

test('name/email search combines with status and supports doctor patient names', () => {
  assert.deepEqual(filterAccessHistory(grants, { status: 'active', search: 'ALEX@EXAMPLE.TEST', now }).map((grant) => grant.id), ['a'])
  assert.deepEqual(filterAccessHistory(grants, { status: 'expired', search: 'morgan', now }).map((grant) => grant.id), ['b'])
  const doctorView = [{ ...grants[0], patient: { name: 'Jamie Patient', email: 'jamie@example.test' } }]
  assert.equal(filterAccessHistory(doctorView, { search: 'jamie', isDoctor: true, now }).length, 1)
})

test('pagination shows six per page, clamps boundaries, and handles empty results', () => {
  const items = Array.from({ length: 14 }, (_, index) => index + 1)
  assert.deepEqual(paginateAccessHistory(items, 1), { page: 1, pageCount: 3, items: [1, 2, 3, 4, 5, 6], start: 1, end: 6 })
  assert.deepEqual(paginateAccessHistory(items, 3), { page: 3, pageCount: 3, items: [13, 14], start: 13, end: 14 })
  assert.equal(paginateAccessHistory(items, 99).page, 3)
  assert.deepEqual(paginateAccessHistory([], 4), { page: 1, pageCount: 0, items: [], start: 0, end: 0 })
  assert.deepEqual(visiblePageNumbers(6, 12), [4, 5, 6, 7, 8])
})

test('revocation remains available only for active unexpired grants', () => {
  assert.equal(canRevokeAccess(grants[0], now), true)
  assert.equal(canRevokeAccess(grants[1], now), false)
  assert.equal(canRevokeAccess(grants[3], now), false)
})
