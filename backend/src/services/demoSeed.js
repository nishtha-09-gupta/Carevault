import { promisify } from 'node:util'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import User from '../models/User.js'
import AccessGrant from '../models/AccessGrant.js'
import { ensureDemoPatientDocuments, loadVerifiedDemoFixtures } from './demoPatientData.js'

const scrypt = promisify(scryptCallback)
export const DEMO_IDENTITIES = {
  patient: { email: 'demo.patient@carevault.invalid', name: 'Shikha Sharma', role: 'patient' },
  doctor: { email: 'demo.doctor@carevault.invalid', name: 'Dr. Anika Sharma', role: 'doctor' },
}
const DENIED_LEGACY_EMAILS = new Set(['demo@gmail.com', 'doctor.demo@gmail.com', 'demo@carevault.invalid'])
const DEMO_GRANT_HOURS = 24 * 30

export function isDemoAccountEmail(email) {
  return DENIED_LEGACY_EMAILS.has(String(email || '').toLowerCase())
}

function randomPassword() {
  return randomBytes(48).toString('base64url')
}

async function passwordFields(password) {
  const passwordSalt = randomBytes(16).toString('hex')
  const passwordHash = (await scrypt(password, passwordSalt, 64)).toString('hex')
  return { passwordSalt, passwordHash }
}

async function createDemoAccount(account, partnerId = null) {
  const existing = await User.findOne({ email: account.email }).select('+demoRole +demoPartnerId')
  if (existing) {
    if (existing.demoRole !== account.role || existing.role !== account.role) {
      throw new Error(`Demo account identity collision at ${account.email}; no account was changed.`)
    }
    if (account.role === 'doctor' && existing.demoPartnerId && partnerId && String(existing.demoPartnerId) !== String(partnerId)) {
      throw new Error(`Demo doctor pairing conflict at ${account.email}; no account was changed.`)
    }
    return existing
  }
  const credentials = await passwordFields(randomPassword())
  try {
    return await User.create({ ...account, ...credentials, demoRole: account.role, demoPartnerId: partnerId })
  } catch (error) {
    if (error.code === 11000) throw new Error(`Demo account identity collision at ${account.email}; no account was changed.`)
    throw error
  }
}

async function setDemoPartner(doctor, patient) {
  const result = await User.updateOne(
    { _id: doctor._id, role: 'doctor', demoRole: 'doctor', $or: [{ demoPartnerId: null }, { demoPartnerId: patient._id }] },
    { $set: { demoPartnerId: patient._id } },
  )
  if (result.matchedCount !== 1) throw new Error('Could not safely pair the demo doctor with the demo patient.')
}

async function ensureDemoAccess(patient, doctor) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DEMO_GRANT_HOURS * 60 * 60 * 1000)
  const grant = await AccessGrant.findOne({ patientId: patient._id, doctorId: doctor._id })
  if (!grant) {
    try {
      await AccessGrant.create({ patientId: patient._id, doctorId: doctor._id, status: 'active', grantedAt: now, expiresAt })
    } catch (error) {
      if (error.code !== 11000) throw error
    }
    return
  }
  // Respect patient revocation and expiry; normal patient actions can grant access again.
}

export async function seedDemoAccounts() {
  const verifiedFixtures = await loadVerifiedDemoFixtures()
  // Preflight both reserved identities before creating or changing either account.
  for (const account of Object.values(DEMO_IDENTITIES)) {
    const existing = await User.findOne({ email: account.email }).select('+demoRole +demoPartnerId')
    if (existing && (existing.demoRole !== account.role || existing.role !== account.role)) {
      throw new Error(`Demo account identity collision at ${account.email}; no account was changed.`)
    }
  }
  const patient = await createDemoAccount(DEMO_IDENTITIES.patient)
  const doctor = await createDemoAccount(DEMO_IDENTITIES.doctor)
  await setDemoPartner(doctor, patient)
  await ensureDemoAccess(patient, doctor)
  await ensureDemoPatientDocuments(patient, verifiedFixtures)
  console.log('CareVault synthetic demo accounts and records are ready.')
}

export function demoAccessEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_ACCOUNTS === 'true'
}
