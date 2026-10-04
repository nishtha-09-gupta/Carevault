import mongoose from 'mongoose'

const accessGrantSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'revoked', 'expired'], required: true, default: 'active' },
  grantedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

accessGrantSchema.index(
  { patientId: 1, doctorId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
)
accessGrantSchema.index({ patientId: 1, grantedAt: -1 })
accessGrantSchema.index({ doctorId: 1, status: 1, expiresAt: 1 })
accessGrantSchema.index({ status: 1, expiresAt: 1 })

export default mongoose.model('AccessGrant', accessGrantSchema)
