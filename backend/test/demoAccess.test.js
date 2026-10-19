import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import User from '../src/models/User.js'
import AccessGrant from '../src/models/AccessGrant.js'
import Document from '../src/models/Document.js'
import { cloudinary } from '../src/config/cloudinary.js'
import { demoAccessEnabled, DEMO_IDENTITIES, isDemoAccountEmail, seedDemoAccounts } from '../src/services/demoSeed.js'
import { demoLogin, login } from '../src/controllers/authController.js'
import { grantAccess, listDoctorPatients, revokeAccess, searchDoctors } from '../src/controllers/accessController.js'
import { listSharedPatientDocuments, uploadNewDocument } from '../src/controllers/documentController.js'

const DEMO_PATIENT_ID = '111111111111111111111111'
const DEMO_DOCTOR_ID = '222222222222222222222222'
const OTHER_PATIENT_ID = '333333333333333333333333'

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    setHeader(name, value) { this.headers[name] = value; return this },
  }
}

test('demo login issues a normal authenticated session for the requested seeded role', async () => {
  const originalFindOne = User.findOne
  const oldNodeEnv = process.env.NODE_ENV
  const oldEnabled = process.env.ENABLE_DEMO_ACCOUNTS
  const oldSessionSecret = process.env.SESSION_SECRET
  process.env.NODE_ENV = 'production'
  process.env.ENABLE_DEMO_ACCOUNTS = 'true'
  process.env.SESSION_SECRET = randomBytes(48).toString('base64url')
  let query
  User.findOne = (filter) => {
    query = filter
    return { select: async () => ({ id: DEMO_PATIENT_ID, role: 'patient', name: 'Synthetic Patient', email: DEMO_IDENTITIES.patient.email, demoRole: 'patient', sessionVersion: 0 }) }
  }
  const res = response()
  try {
    await demoLogin({ body: { role: 'patient' } }, res)
    assert.deepEqual(query, { email: DEMO_IDENTITIES.patient.email, role: 'patient', demoRole: 'patient' })
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.user.isDemo, true)
    assert.match(res.headers['Set-Cookie'], /HttpOnly/)
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

test('production demo access stays disabled unless explicitly enabled', () => {
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

test('demo patient can search the same doctor directory as a normal patient', async () => {
  const originalFind = User.find
  let query
  User.find = (filter) => {
    query = filter
    return { select() { return this }, sort() { return this }, limit() { return this }, lean: async () => [{ _id: DEMO_DOCTOR_ID, name: 'Demo Doctor', email: DEMO_IDENTITIES.doctor.email }] }
  }
  try {
    const res = response()
    await searchDoctors({ user: { id: DEMO_PATIENT_ID, role: 'patient', isDemo: true }, query: { q: 'demo' } }, res)
    assert.equal(query.role, 'doctor')
    assert.equal('demoRole' in query, false)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.doctors[0].id, DEMO_DOCTOR_ID)
  } finally {
    User.find = originalFind
  }
})

test('demo patient can grant and revoke doctor access through the normal patient handlers', async () => {
  const originals = { findOne: User.findOne, findById: User.findById, grantFindOne: AccessGrant.findOne, updateMany: AccessGrant.updateMany, create: AccessGrant.create }
  const doctor = { _id: DEMO_DOCTOR_ID, name: 'Demo Doctor', email: DEMO_IDENTITIES.doctor.email }
  const grant = {
    _id: '444444444444444444444444', patientId: DEMO_PATIENT_ID, doctorId: DEMO_DOCTOR_ID,
    status: 'active', grantedAt: new Date(), expiresAt: new Date(Date.now() + 3600000), revokedAt: null,
    async save() {},
  }
  let created
  let revokeFilter
  User.findOne = (filter) => ({ select: async () => { assert.equal(filter._id, DEMO_DOCTOR_ID); return doctor } })
  User.findById = () => ({ select: async () => doctor })
  AccessGrant.updateMany = async () => ({ modifiedCount: 0 })
  AccessGrant.create = async (data) => { created = data; return grant }
  AccessGrant.findOne = (filter) => { revokeFilter = filter; return Promise.resolve(grant) }
  try {
    const grantRes = response()
    await grantAccess({ user: { id: DEMO_PATIENT_ID, role: 'patient', isDemo: true }, body: { doctorId: DEMO_DOCTOR_ID, durationHours: 24 } }, grantRes)
    assert.equal(grantRes.statusCode, 201)
    assert.equal(String(created.patientId), DEMO_PATIENT_ID)
    assert.equal(String(created.doctorId), DEMO_DOCTOR_ID)

    const revokeRes = response()
    await revokeAccess({ user: { id: DEMO_PATIENT_ID, role: 'patient', isDemo: true }, params: { id: grant._id } }, revokeRes)
    assert.equal(revokeFilter.patientId, DEMO_PATIENT_ID)
    assert.equal(grant.status, 'revoked')
    assert.equal(revokeRes.statusCode, 200)
  } finally {
    User.findOne = originals.findOne
    User.findById = originals.findById
    AccessGrant.updateMany = originals.updateMany
    AccessGrant.create = originals.create
    AccessGrant.findOne = originals.grantFindOne
  }
})

test('demo doctor access to another patient still requires that patient’s active grant', async () => {
  const originalGrantFind = AccessGrant.findOne
  const originalDocumentFind = Document.find
  let grantFilter
  let documentFilter
  AccessGrant.findOne = (filter) => {
    grantFilter = filter
    return { select: async () => null }
  }
  Document.find = (filter) => {
    documentFilter = filter
    return { select() { return this }, sort: async () => [] }
  }
  try {
    const denied = response()
    await listSharedPatientDocuments({ user: { id: DEMO_DOCTOR_ID, role: 'doctor', isDemo: true }, params: { patientId: OTHER_PATIENT_ID } }, denied)
    assert.equal(denied.statusCode, 403)
    assert.deepEqual(grantFilter, { patientId: OTHER_PATIENT_ID, doctorId: DEMO_DOCTOR_ID, status: 'active', expiresAt: { $gt: grantFilter.expiresAt.$gt } })
    assert.equal(documentFilter, undefined)

    AccessGrant.findOne = (filter) => {
      grantFilter = filter
      return { select: async () => ({ _id: '555555555555555555555555', expiresAt: new Date(Date.now() + 3600000) }) }
    }
    const allowed = response()
    await listSharedPatientDocuments({ user: { id: DEMO_DOCTOR_ID, role: 'doctor', isDemo: true }, params: { patientId: OTHER_PATIENT_ID } }, allowed)
    assert.equal(allowed.statusCode, 200)
    assert.equal(documentFilter.ownerId, OTHER_PATIENT_ID)
  } finally {
    AccessGrant.findOne = originalGrantFind
    Document.find = originalDocumentFind
  }
})

test('demo doctor patient list follows grants instead of being restricted to the seeded demo patient', async () => {
  const originals = { updateMany: AccessGrant.updateMany, find: AccessGrant.find, countDocuments: Document.countDocuments }
  let listFilter
  AccessGrant.updateMany = async () => ({ modifiedCount: 0 })
  AccessGrant.find = (filter) => {
    listFilter = filter
    return { populate() { return this }, sort() { return this }, lean: async () => [] }
  }
  try {
    const res = response()
    await listDoctorPatients({ user: { id: DEMO_DOCTOR_ID, role: 'doctor', isDemo: true, demoRole: 'doctor', demoPartnerId: DEMO_PATIENT_ID } }, res)
    assert.equal(listFilter.doctorId, DEMO_DOCTOR_ID)
    assert.equal('patientId' in listFilter, false)
    assert.deepEqual(res.body, { patients: [] })
  } finally {
    AccessGrant.updateMany = originals.updateMany
    AccessGrant.find = originals.find
    Document.countDocuments = originals.countDocuments
  }
})

test('demo patient can upload a document through the normal validated document handler', async () => {
  const originalCreate = Document.create
  const originalUploadStream = cloudinary.uploader.upload_stream
  const originalCloudinaryConfig = cloudinary.config()
  let saved
  cloudinary.config({ cloud_name: 'test', api_key: 'test', api_secret: 'test' })
  cloudinary.uploader.upload_stream = (options, callback) => {
    const stream = new PassThrough()
    setImmediate(() => callback(null, { secure_url: 'https://storage.invalid/demo.pdf', public_id: 'synthetic/demo.pdf' }))
    return stream
  }
  Document.create = async (data) => {
    saved = data
    return { toObject: () => ({ _id: '666666666666666666666666', ...data, uploadedAt: new Date() }) }
  }
  try {
    const res = response()
    await uploadNewDocument({
      user: { id: DEMO_PATIENT_ID, role: 'patient', isDemo: true },
      body: {},
      file: { originalname: 'sample.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), size: 8 },
    }, res)
    assert.equal(res.statusCode, 201)
    assert.equal(saved.ownerId, DEMO_PATIENT_ID)
    assert.equal(saved.originalFileName, 'sample.pdf')
  } finally {
    Document.create = originalCreate
    cloudinary.uploader.upload_stream = originalUploadStream
    cloudinary.config(originalCloudinaryConfig)
  }
})

test('normal password login still rejects legacy demo identities', async () => {
  const originalFindOne = User.findOne
  let queried = false
  User.findOne = () => { queried = true; throw new Error('legacy demo identity must not reach password login') }
  try {
    const res = response()
    await login({ body: { email: 'demo@gmail.com', password: 'unused-test-value' } }, res)
    assert.equal(res.statusCode, 401)
    assert.equal(queried, false)
  } finally {
    User.findOne = originalFindOne
  }
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

test('demo identity settings remain reserved and model markers are protected fields', () => {
  assert.equal(DEMO_IDENTITIES.patient.email.endsWith('@carevault.invalid'), true)
  assert.equal(DEMO_IDENTITIES.doctor.email.endsWith('@carevault.invalid'), true)
  assert.equal(isDemoAccountEmail('demo@gmail.com'), true)
  assert.equal(User.schema.path('demoRole').options.select, false)
  assert.equal(User.schema.path('demoPartnerId').options.select, false)
})
