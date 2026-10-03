import mongoose from 'mongoose'

const FALLBACK_DEMO_PATIENT_ID = '000000000000000000000001'

// Replace this middleware with the real authentication middleware when it exists.
// Do not use the fixed development identity in a deployed application.
export function demoPatient(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Document routes need real authentication before production use.',
    })
  }

  const id = process.env.DEMO_PATIENT_ID || FALLBACK_DEMO_PATIENT_ID
  if (!mongoose.isValidObjectId(id)) {
    return res.status(500).json({ error: 'DEMO_PATIENT_ID must be a valid MongoDB ObjectId.' })
  }

  req.user = { id, role: 'patient', authMode: 'demo' }
  next()
}
