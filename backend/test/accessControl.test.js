import assert from 'node:assert/strict'
import { test } from 'node:test'
import AccessGrant from '../src/models/AccessGrant.js'
import { activeGrantQuery, isAccessGrantActive, isValidAccessDurationHours, MAX_ACCESS_DURATION_HOURS } from '../src/utils/accessControl.js'

test('access duration validation accepts bounded whole-hour durations only', () => {
  assert.equal(isValidAccessDurationHours(1), true)
  assert.equal(isValidAccessDurationHours(24), true)
  assert.equal(isValidAccessDurationHours(MAX_ACCESS_DURATION_HOURS), true)
  assert.equal(isValidAccessDurationHours(0), false)
  assert.equal(isValidAccessDurationHours(1.5), false)
  assert.equal(isValidAccessDurationHours(MAX_ACCESS_DURATION_HOURS + 1), false)
  assert.equal(isValidAccessDurationHours('24'), false)
})

test('an access grant is active only when its status is active and its expiry is in the future', () => {
  const now = new Date('2026-10-04T00:00:00Z')
  assert.equal(isAccessGrantActive({ status: 'active', expiresAt: new Date(now.getTime() + 1) }, now), true)
  assert.equal(isAccessGrantActive({ status: 'active', expiresAt: now }, now), false)
  assert.equal(isAccessGrantActive({ status: 'active', expiresAt: new Date(now.getTime() - 1) }, now), false)
  assert.equal(isAccessGrantActive({ status: 'revoked', expiresAt: new Date(now.getTime() + 1) }, now), false)
  assert.equal(isAccessGrantActive({ status: 'expired', expiresAt: new Date(now.getTime() + 1) }, now), false)
})

test('authorization lookup requires the matching patient and doctor, active status, and future expiry', () => {
  const now = new Date('2026-10-04T00:00:00Z')
  assert.deepEqual(activeGrantQuery('patient-id', 'doctor-id', now), {
    patientId: 'patient-id',
    doctorId: 'doctor-id',
    status: 'active',
    expiresAt: { $gt: now },
  })
})

test('access grants store patient and doctor relationships and prevent duplicate active grants', () => {
  const schema = AccessGrant.schema
  assert.equal(schema.path('patientId').options.ref, 'User')
  assert.equal(schema.path('doctorId').options.ref, 'User')
  assert.equal(schema.path('revokedBy').options.ref, 'User')
  assert.deepEqual(schema.path('status').enumValues, ['active', 'revoked', 'expired'])
  assert.ok(schema.path('expiresAt').isRequired)
  assert.ok(schema.indexes().some(([fields, options]) => fields.patientId === 1 && fields.doctorId === 1 && options.unique && options.partialFilterExpression?.status === 'active'))
})
