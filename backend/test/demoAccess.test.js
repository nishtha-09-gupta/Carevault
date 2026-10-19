import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import User from '../src/models/User.js'
import AccessGrant from '../src/models/AccessGrant.js'
import { demoDoctorPatient, requireWritableAccount } from '../src/middleware/demoAccess.js'
import { demoAccessEnabled, DEMO_IDENTITIES, isDemoAccountEmail, seedDemoAccounts } from '../src/services/demoSeed.js'
import { demoLogin, login } from '../src/controllers/authController.js'
import { listDoctorPatients, searchDoctors } from '../src/controllers/accessController.js'

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('demo accounts are blocked from every guarded write route', () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const res = response()
    let continued = false
    requireWritableAccount({ method, user: { isDemo: true } }, res, () => { continued = true })
    assert.equal(res.statusCode, 403)
    assert.equal(continued, false)
  }
  let continued = false
  requireWritableAccount({ method: 'POST', user: { isDemo: false } }, response(), () => { continued = true })
  assert.equal(continued, true)
})

test('demo doctor patient scope accepts only its paired demo patient', () => {
  const req = { params: { patientId: 'demo-patient-id' }, user: { demoRole: 'doctor', demoPartnerId: 'demo-patient-id' } }
  let continued = false
  demoDoctorPatient(req, response(), () => { continued = true })
  assert.equal(continued, true)
  const res = response()
  demoDoctorPatient({ ...req, params: { patientId: 'real-patient-id' } }, res, () => { continued = true })
  assert.equal(res.statusCode, 404)
  assert.equal(continued, true) // remains true only from the accepted request above
})

test('demo doctor patient list is queried only for its paired demo patient', async () => {
  const originalUpdateMany = AccessGrant.updateMany
  const originalFind = AccessGrant.find
  const originalCount = AccessGrant.countDocuments
  let updatedFilter
  let grantFilter
  AccessGrant.updateMany = async (filter) => { updatedFilter = filter }
  AccessGrant.find = (filter) => {
    grantFilter = filter
    return { populate() { return this }, sort() { return this }, lean: async () => [] }
  }
  AccessGrant.countDocuments = async () => 0
  const res = response()
  res.setHeader = () => {}
  try {
    await listDoctorPatients({ user: { id: 'demo-doctor-id', role: 'doctor', isDemo: true, demoRole: 'doctor', demoPartnerId: 'demo-patient-id' } }, res)
    assert.equal(grantFilter.patientId, 'demo-patient-id')
    assert.equal(updatedFilter.patientId, 'demo-patient-id')
    assert.deepEqual(res.body, { patients: [] })
  } finally {
    AccessGrant.updateMany = originalUpdateMany
    AccessGrant.find = originalFind
    AccessGrant.countDocuments = originalCount
  }
})

test('demo patients cannot search the real doctor directory', async () => {
  const originalFind = User.find
  let queried = false
  User.find = () => { queried = true; throw new Error('real doctor directory must not be queried') }
  try {
    const res = response()
    await searchDoctors({ user: { role: 'patient', isDemo: true }, query: { q: 'ab' } }, res)
    assert.equal(res.statusCode, 403)
    assert.equal(queried, false)
  } finally {
    User.find = originalFind
  }
})

test('demo fixture identities are reserved and legacy demo credentials stay disabled', () => {
  assert.equal(DEMO_IDENTITIES.patient.email.endsWith('@carevault.invalid'), true)
  assert.equal(DEMO_IDENTITIES.doctor.email.endsWith('@carevault.invalid'), true)
  assert.equal(isDemoAccountEmail('demo@gmail.com'), true)
  assert.equal(isDemoAccountEmail('doctor.demo@gmail.com'), true)
  assert.equal(isDemoAccountEmail(DEMO_IDENTITIES.patient.email), false)
})

test('production demo accounts remain disabled unless explicitly enabled', () => {
  const oldNodeEnv = process.env.NODE_ENV
  const oldEnabled = process.env.ENABLE_DEMO_ACCOUNTS
  process.env.NODE_ENV = 'production'
  delete process.env.ENABLE_DEMO_ACCOUNTS
  assert.equal(demoAccessEnabled(), false)
  process.env.ENABLE_DEMO_ACCOUNTS = 'false'
  assert.equal(demoAccessEnabled(), false)
  process.env.ENABLE_DEMO_ACCOUNTS = 'true'
  assert.equal(demoAccessEnabled(), true)
  if (oldNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = oldNodeEnv
  if (oldEnabled === undefined) delete process.env.ENABLE_DEMO_ACCOUNTS
  else process.env.ENABLE_DEMO_ACCOUNTS = oldEnabled
})

test('demo authentication issues a session only for an enabled, seeded role identity', async () => {
  const originalFindOne = User.findOne
  const oldNodeEnv = process.env.NODE_ENV
  const oldEnabled = process.env.ENABLE_DEMO_ACCOUNTS
  const oldSessionSecret = process.env.SESSION_SECRET
  process.env.NODE_ENV = 'production'
  process.env.ENABLE_DEMO_ACCOUNTS = 'true'
  process.env.SESSION_SECRET = randomBytes(48).toString('base64url')
  let query
  const user = { id: 'demo-user-id', role: 'patient', name: 'Synthetic Patient', email: DEMO_IDENTITIES.patient.email, demoRole: 'patient', sessionVersion: 0 }
  User.findOne = (filter) => { query = filter; return { select: async () => user } }
  const res = response()
  res.setHeader = (name, value) => { res[name] = value }
  try {
    await demoLogin({ body: { role: 'patient' } }, res)
    assert.deepEqual(query, { email: DEMO_IDENTITIES.patient.email, role: 'patient', demoRole: 'patient' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.user.isDemo, true)
    assert.match(res['Set-Cookie'], /HttpOnly/)
    const missing = response()
    await demoLogin({ body: { role: 'admin' } }, missing)
    assert.equal(missing.statusCode, 404)
  } finally {
    User.findOne = originalFindOne
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = oldNodeEnv
    if (oldEnabled === undefined) delete process.env.ENABLE_DEMO_ACCOUNTS
    else process.env.ENABLE_DEMO_ACCOUNTS = oldEnabled
    if (oldSessionSecret === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = oldSessionSecret
  }
})

test('normal password login rejects legacy demo credentials before database lookup', async () => {
  const originalFindOne = User.findOne
  let queried = false
  User.findOne = () => { queried = true; throw new Error('legacy demo credential must not reach database') }
  try {
    const res = response()
    await login({ body: { email: 'demo@gmail.com', password: 'unused-test-value' } }, res)
    assert.equal(res.statusCode, 401)
    assert.equal(queried, false)
  } finally {
    User.findOne = originalFindOne
  }
})

test('user schema stores demo markers as protected fields', () => {
  assert.equal(User.schema.path('demoRole').options.select, false)
  assert.equal(User.schema.path('demoPartnerId').options.select, false)
  assert.equal(User.schema.path('demoPartnerId').options.ref, 'User')
})

test('demo seeding stops on an identity collision without creating or changing accounts', async () => {
  const originalFindOne = User.findOne
  const originalCreate = User.create
  let creates = 0
  User.findOne = (filter) => ({
    select: async () => filter.email === DEMO_IDENTITIES.patient.email
      ? { email: filter.email, role: 'patient', demoRole: null }
      : null,
  })
  User.create = async () => { creates += 1; throw new Error('must not create') }
  try {
    await assert.rejects(seedDemoAccounts(), /identity collision/)
    assert.equal(creates, 0)
  } finally {
    User.findOne = originalFindOne
    User.create = originalCreate
  }
})
