import mongoose from 'mongoose'

const testSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  nameEvidence: { type: String, default: null, maxlength: 500 },
  value: { type: String, default: null, maxlength: 120 },
  valueEvidence: { type: String, default: null, maxlength: 500 },
  unit: { type: String, default: null, maxlength: 60 },
  unitEvidence: { type: String, default: null, maxlength: 500 },
  referenceRange: { type: String, default: null, maxlength: 120 },
  referenceRangeEvidence: { type: String, default: null, maxlength: 500 },
  abnormalFlag: { type: String, enum: ['high', 'low', 'positive', 'negative', 'abnormal', 'normal', null], default: null },
  abnormalFlagEvidence: { type: String, default: null, maxlength: 500 },
}, { _id: false })

const findingSchema = new mongoose.Schema({ text: { type: String, required: true, maxlength: 1000 }, evidence: { type: String, default: null, maxlength: 500 } }, { _id: false })
const resultSchema = new mongoose.Schema({
  reportDate: { type: String, default: null },
  reportDateEvidence: { type: String, default: null, maxlength: 500 },
  findings: { type: [findingSchema], default: [] },
  tests: { type: [testSchema], default: [] },
}, { _id: false })

const documentAnalysisSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', required: true, index: true },
  result: { type: resultSchema, default: null },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: null, select: false },
  lastErrorCode: { type: String, default: null },
  reviewedResult: { type: resultSchema, default: null },
  confirmedAt: { type: Date, default: null },
  confirmedRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord', default: null },
}, { timestamps: true })

documentAnalysisSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 })
export default mongoose.model('DocumentAnalysis', documentAnalysisSchema)
