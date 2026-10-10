import mongoose from 'mongoose'

export const MEDICAL_RECORD_CATEGORIES = ['Lab result', 'Visit summary', 'Medication', 'Prescription', 'Imaging', 'Other']

const medicalRecordSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  demoSeedKey: { type: String, select: false },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  category: { type: String, required: true, enum: MEDICAL_RECORD_CATEGORIES },
  provider: { type: String, trim: true, maxlength: 180, default: '' },
  eventDate: { type: Date, default: null },
  notes: { type: String, trim: true, maxlength: 5000, default: '' },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
}, { timestamps: true })

medicalRecordSchema.index({ ownerId: 1, eventDate: -1, createdAt: -1 })
medicalRecordSchema.index({ documentId: 1 })
medicalRecordSchema.index({ ownerId: 1, demoSeedKey: 1 }, { unique: true, partialFilterExpression: { demoSeedKey: { $type: 'string' } } })

export default mongoose.model('MedicalRecord', medicalRecordSchema)
