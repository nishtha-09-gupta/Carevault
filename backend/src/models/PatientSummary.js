import mongoose from 'mongoose'

const statementSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 1200 },
  sourceIds: { type: [String], required: true },
  evidence: { type: String, required: true, maxlength: 1000 },
}, { _id: false })

const patientSummarySchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['generating', 'completed', 'failed'], required: true, default: 'generating' },
  sourceFingerprint: { type: String, default: null },
  schemaVersion: { type: Number, default: undefined },
  generationToken: { type: String, default: null, select: false },
  leaseUntil: { type: Date, default: null },
  generatedByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  generatedAt: { type: Date, default: null },
  overview: { type: statementSchema, default: null },
  keyPoints: { type: [statementSchema], default: [] },
  medications: { type: [statementSchema], default: [] },
  allergies: { type: [statementSchema], default: [] },
  insufficientInformation: { type: Boolean, default: false },
  sourceReferences: { type: [mongoose.Schema.Types.Mixed], default: [] },
  lastErrorCode: { type: String, default: null },
}, { timestamps: true })

export default mongoose.model('PatientSummary', patientSummarySchema)
