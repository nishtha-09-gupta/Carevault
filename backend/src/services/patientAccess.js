import mongoose from 'mongoose'
import AccessGrant from '../models/AccessGrant.js'
import { activeGrantQuery } from '../utils/accessControl.js'

export async function findActivePatientGrant(patientId, doctorId) {
  if (!mongoose.isValidObjectId(patientId) || !mongoose.isValidObjectId(doctorId)) return null
  return AccessGrant.findOne(activeGrantQuery(patientId, doctorId, new Date())).select('_id expiresAt')
}
