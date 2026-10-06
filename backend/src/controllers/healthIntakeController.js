import mongoose from 'mongoose'
import User from '../models/User.js'
import HealthIntake from '../models/HealthIntake.js'
import { findActivePatientGrant } from '../services/patientAccess.js'

const impacts = new Set(['', 'Mild', 'Moderate', 'Significant'])

function intakePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter your health intake details.' }
  const mainConcern = typeof body.mainConcern === 'string' ? body.mainConcern.trim() : ''
  if (!mainConcern) return { error: 'Describe your main concern before saving.' }
  if (mainConcern.length > 2000) return { error: 'Main concern must be 2,000 characters or fewer.' }

  const startedAtValue = body.startedAt ?? ''
  let startedAt = null
  if (startedAtValue !== '') {
    if (typeof startedAtValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startedAtValue)) return { error: 'Enter a valid start date.' }
    startedAt = new Date(`${startedAtValue}T00:00:00.000Z`)
    if (Number.isNaN(startedAt.getTime()) || startedAt.toISOString().slice(0, 10) !== startedAtValue) return { error: 'Enter a valid start date.' }
  }

  const impact = typeof body.impact === 'string' ? body.impact : ''
  if (!impacts.has(impact)) return { error: 'Choose a valid impact level.' }
  const limits = { allergies: 2000, medications: 2000, additionalNotes: 5000 }
  const fields = { mainConcern, startedAt, impact }
  for (const [field, maximum] of Object.entries(limits)) {
    const value = body[field] ?? ''
    if (typeof value !== 'string') return { error: `${field} must be text.` }
    if (value.length > maximum) return { error: `${field} must be ${maximum} characters or fewer.` }
    fields[field] = value.trim()
  }

  const status = body.status === undefined ? 'submitted' : body.status
  if (!['draft', 'submitted'].includes(status)) return { error: 'Choose a valid intake status.' }
  fields.status = status
  return { fields }
}

function toApiIntake(intake) {
  if (!intake) return null
  return {
    id: String(intake._id),
    mainConcern: intake.mainConcern,
    startedAt: intake.startedAt ? intake.startedAt.toISOString().slice(0, 10) : '',
    impact: intake.impact,
    allergies: intake.allergies,
    medications: intake.medications,
    additionalNotes: intake.additionalNotes,
    status: intake.status,
    createdAt: intake.createdAt,
    updatedAt: intake.updatedAt,
  }
}

function requirePatient(req, res) {
  if (req.user.role === 'patient') return true
  res.status(403).json({ error: 'Only patients can manage their health intake.' })
  return false
}

function privateResponse(res) {
  res.setHeader('Cache-Control', 'private, no-store')
}

export async function getMyHealthIntake(req, res) {
  if (!requirePatient(req, res)) return
  const intake = await HealthIntake.findOne({ patientId: req.user.id }).lean()
  privateResponse(res)
  return res.json({ intake: toApiIntake(intake) })
}

export async function saveMyHealthIntake(req, res) {
  if (!requirePatient(req, res)) return
  const parsed = intakePayload(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  let intake
  try {
    intake = await HealthIntake.findOneAndUpdate(
      { patientId: req.user.id },
      { $set: parsed.fields, $setOnInsert: { patientId: req.user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    if (error.code !== 11000) throw error
    intake = await HealthIntake.findOneAndUpdate({ patientId: req.user.id }, { $set: parsed.fields }, { new: true, runValidators: true })
  }
  privateResponse(res)
  return res.status(200).json({ intake: toApiIntake(intake) })
}

export async function updateMyHealthIntake(req, res) {
  if (!requirePatient(req, res)) return
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Health intake not found.' })
  const parsed = intakePayload(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  const intake = await HealthIntake.findOneAndUpdate(
    { _id: req.params.id, patientId: req.user.id },
    { $set: parsed.fields },
    { new: true, runValidators: true },
  )
  if (!intake) return res.status(404).json({ error: 'Health intake not found.' })
  privateResponse(res)
  return res.json({ intake: toApiIntake(intake) })
}

export async function getSharedPatientHealthIntake(req, res) {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only doctors can view shared patient intake.' })
  if (!mongoose.isValidObjectId(req.params.patientId)) return res.status(404).json({ error: 'Patient not found.' })
  const patient = await User.findOne({ _id: req.params.patientId, role: 'patient' }).select('_id')
  if (!patient) return res.status(404).json({ error: 'Patient not found.' })
  const grant = await findActivePatientGrant(patient._id, req.user.id)
  if (!grant) return res.status(403).json({ error: 'The patient has not granted you active access to their health intake.' })
  const intake = await HealthIntake.findOne({ patientId: patient._id, status: 'submitted' }).lean()
  privateResponse(res)
  return res.json({ intake: toApiIntake(intake) })
}
