import { promisify } from 'node:util'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import User from '../models/User.js'
import AccessGrant from '../models/AccessGrant.js'
import { ensureDemoPatientDocuments } from './demoPatientData.js'

const scrypt = promisify(scryptCallback)
const DEMO_PATIENT = { email: 'demo@gmail.com', password: 'demo123', name: 'Shikha Sharma', role: 'patient' }
const DEMO_DOCTOR = { email: 'doctor.demo@gmail.com', password: 'doctor123', name: 'Dr. Anika Sharma', role: 'doctor' }
const LEGACY_DEMO_EMAIL = 'demo@carevault.invalid'
const DEMO_GRANT_HOURS = 24 * 30

async function passwordFields(password) {
  const passwordSalt = randomBytes(16).toString('hex')
  const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex')
  return { passwordSalt, passwordHash }
}

async function findOrPromoteLegacyPatient() {
  const existing = await User.findOne({ email: DEMO_PATIENT.email })
  if (existing) return existing

  // Reuse the account created by the old demo shortcut, preserving its user ID and records.
  const legacy = await User.collection.findOne({ email: LEGACY_DEMO_EMAIL, isDemo: true })
  if (!legacy) return null
  await User.collection.updateOne(
    { _id: legacy._id },
    { $set: { email: DEMO_PATIENT.email, name: DEMO_PATIENT.name, role: 'patient' }, $unset: { isDemo: '' } },
  )
  return User.findById(legacy._id)
}

async function upsertDemoUser(account, { promoteLegacy = false } = {}) {
  let user = promoteLegacy ? await findOrPromoteLegacyPatient() : null
  user ||= await User.findOne({ email: account.email })
  const credentials = await passwordFields(account.password)
  if (!user) {
    try {
      user = await User.create({ ...account, ...credentials })
    } catch (error) {
      if (error.code !== 11000) throw error
      user = await User.findOne({ email: account.email })
    }
  }
  if (!user) throw new Error(`Could not initialize the CareVault account ${account.email}.`)
  user.name = account.name
  user.email = account.email
  user.role = account.role
  user.passwordSalt = credentials.passwordSalt
  user.passwordHash = credentials.passwordHash
  await user.save()
  await User.collection.updateOne({ _id: user._id }, { $unset: { isDemo: '' } })
  return user
}

async function ensureDemoAccess(patient, doctor) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DEMO_GRANT_HOURS * 60 * 60 * 1000)
  let grant = await AccessGrant.findOne({ patientId: patient._id, doctorId: doctor._id }).sort({ grantedAt: -1 })
  if (!grant) {
    try {
      await AccessGrant.create({ patientId: patient._id, doctorId: doctor._id, status: 'active', grantedAt: now, expiresAt })
    } catch (error) {
      if (error.code !== 11000) throw error
      grant = await AccessGrant.findOne({ patientId: patient._id, doctorId: doctor._id, status: 'active' })
    }
    return
  }

  // This initializer runs at server startup, not on ordinary API requests. Restore the demo
  // fixture after expiry/revocation while keeping each grant in the normal access model.
  if (grant.status !== 'active' || grant.expiresAt <= now) {
    grant.status = 'active'
    grant.grantedAt = now
    grant.expiresAt = expiresAt
    grant.revokedAt = null
    grant.revokedBy = null
    await grant.save()
  }
}

export async function seedDemoAccounts() {
  const patient = await upsertDemoUser(DEMO_PATIENT, { promoteLegacy: true })
  const doctor = await upsertDemoUser(DEMO_DOCTOR)
  await ensureDemoAccess(patient, doctor)
  // Keep Cloudinary latency/outages from blocking the HTTP server and regular login flow.
  void ensureDemoPatientDocuments(patient)
    .then(() => console.log('CareVault interview records are ready.'))
    .catch((error) => console.error('CareVault demo accounts are ready, but demo documents could not be seeded:', error.message))
  console.log('CareVault interview accounts and access are ready.')
}

export async function refreshExpiredDemoAccessForLogin(user) {
  if (!user || ![DEMO_PATIENT.email, DEMO_DOCTOR.email].includes(user.email)) return
  const patient = await User.findOne({ email: DEMO_PATIENT.email, role: 'patient' }).select('_id')
  const doctor = await User.findOne({ email: DEMO_DOCTOR.email, role: 'doctor' }).select('_id')
  if (!patient || !doctor) return
  const grant = await AccessGrant.findOne({ patientId: patient._id, doctorId: doctor._id }).sort({ grantedAt: -1 })
  if (!grant || grant.status === 'revoked' || grant.expiresAt > new Date()) return
  grant.status = 'active'
  grant.grantedAt = new Date()
  grant.expiresAt = new Date(Date.now() + DEMO_GRANT_HOURS * 60 * 60 * 1000)
  await grant.save()
}
