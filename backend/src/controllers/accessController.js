import mongoose from 'mongoose'
import AccessGrant from '../models/AccessGrant.js'
import User from '../models/User.js'
import { MAX_ACCESS_DURATION_HOURS, isValidAccessDurationHours } from '../utils/accessControl.js'

function roleError(req, expected) {
  if (req.user.isDemo) return 'Sharing is unavailable in the read-only demo account.'
  if (req.user.role !== expected) return expected === 'patient' ? 'Only patients can manage access.' : 'Only doctors can view shared patients.'
  return null
}

function apiGrant(grant, otherUserKey, otherUser) {
  return {
    id: String(grant._id || grant.id),
    status: grant.status === 'active' && new Date(grant.expiresAt) <= new Date() ? 'expired' : grant.status,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
    [otherUserKey]: otherUser ? { id: String(otherUser._id || otherUser.id), name: otherUser.name, email: otherUser.email } : null,
  }
}

async function markExpired(filter, now) {
  await AccessGrant.updateMany({ ...filter, status: 'active', expiresAt: { $lte: now } }, { $set: { status: 'expired' } })
}

export async function searchDoctors(req, res) {
  const error = roleError(req, 'patient')
  if (error) return res.status(403).json({ error })
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (query.length < 2 || query.length > 100) return res.status(400).json({ error: 'Enter at least two characters to search for a doctor.' })

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const doctors = await User.find({
    role: 'doctor', isDemo: { $ne: true },
    $or: [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ],
  }).select('_id name email').sort({ name: 1 }).limit(20).lean()
  return res.json({ doctors: doctors.map((doctor) => ({ id: doctor._id, name: doctor.name, email: doctor.email })) })
}

export async function listAccess(req, res) {
  if (req.user.isDemo) return res.status(403).json({ error: 'Sharing is unavailable in the read-only demo account.' })
  const now = new Date()

  if (req.user.role === 'patient') {
    await markExpired({ patientId: req.user.id }, now)
    const grants = await AccessGrant.find({ patientId: req.user.id }).populate('doctorId', 'name email role').sort({ grantedAt: -1 }).lean()
    return res.json({ grants: grants.map((grant) => apiGrant(grant, 'doctor', grant.doctorId?.role === 'doctor' ? grant.doctorId : null)) })
  }

  if (req.user.role === 'doctor') {
    await markExpired({ doctorId: req.user.id }, now)
    const grants = await AccessGrant.find({ doctorId: req.user.id, status: 'active', expiresAt: { $gt: now } })
      .populate('patientId', 'name email role').sort({ expiresAt: 1 }).lean()
    return res.json({ grants: grants.map((grant) => apiGrant(grant, 'patient', grant.patientId?.role === 'patient' ? grant.patientId : null)) })
  }

  return res.status(403).json({ error: 'This account cannot use sharing.' })
}

export async function grantAccess(req, res) {
  const error = roleError(req, 'patient')
  if (error) return res.status(403).json({ error })
  const { doctorId, durationHours } = req.body || {}
  if (!mongoose.isValidObjectId(doctorId)) return res.status(400).json({ error: 'Choose a valid doctor account.' })
  if (String(doctorId) === String(req.user.id)) return res.status(400).json({ error: 'You cannot share access with your own account.' })
  if (!isValidAccessDurationHours(durationHours)) {
    return res.status(400).json({ error: `Choose an access duration from 1 to ${MAX_ACCESS_DURATION_HOURS} hours.` })
  }

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isDemo: { $ne: true } }).select('_id name email')
  if (!doctor) return res.status(404).json({ error: 'Doctor account not found.' })

  const now = new Date()
  await markExpired({ patientId: req.user.id, doctorId: doctor._id }, now)
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000)
  try {
    const grant = await AccessGrant.create({ patientId: req.user.id, doctorId: doctor._id, status: 'active', grantedAt: now, expiresAt })
    return res.status(201).json({ grant: apiGrant(grant, 'doctor', doctor) })
  } catch (creationError) {
    if (creationError.code === 11000) return res.status(409).json({ error: 'This doctor already has active access to your documents.' })
    throw creationError
  }
}

export async function revokeAccess(req, res) {
  const error = roleError(req, 'patient')
  if (error) return res.status(403).json({ error })
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Access record not found.' })

  const grant = await AccessGrant.findOne({ _id: req.params.id, patientId: req.user.id })
  if (!grant) return res.status(404).json({ error: 'Access record not found.' })
  const now = new Date()
  if (grant.status === 'active' && grant.expiresAt <= now) {
    grant.status = 'expired'
    await grant.save()
  }
  if (grant.status !== 'active') return res.status(409).json({ error: 'This access is no longer active.' })

  grant.status = 'revoked'
  grant.revokedAt = now
  grant.revokedBy = req.user.id
  await grant.save()
  return res.json({ grant: apiGrant(grant, 'doctor', await User.findById(grant.doctorId).select('_id name email')) })
}
