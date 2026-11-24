import mongoose from 'mongoose'

const testSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 500 },
  nameEvidence: { type: String, default: null, maxlength: 4000 },
  value: { type: String, default: null, maxlength: 1000 },
  valueEvidence: { type: String, default: null, maxlength: 4000 },
  unit: { type: String, default: null, maxlength: 300 },
  unitEvidence: { type: String, default: null, maxlength: 4000 },
  referenceRange: { type: String, default: null, maxlength: 1000 },
  referenceRangeEvidence: { type: String, default: null, maxlength: 4000 },
  abnormalFlag: { type: String, default: null, maxlength: 300 },
  abnormalFlagEvidence: { type: String, default: null, maxlength: 4000 },
  reportDate: { type: String, default: null, maxlength: 200 },
  reportDateEvidence: { type: String, default: null, maxlength: 4000 },
  pageNumber: { type: Number, default: null, min: 1, max: 100 },
}, { _id: false })

const findingSchema = new mongoose.Schema({ text: { type: String, required: true, maxlength: 4000 }, evidence: { type: String, default: null, maxlength: 4000 }, pageNumber: { type: Number, default: null, min: 1, max: 100 } }, { _id: false })
const patientInformationSchema = new mongoose.Schema({ label: { type: String, required: true, maxlength: 500 }, value: { type: String, required: true, maxlength: 2000 }, evidence: { type: String, default: null, maxlength: 4000 }, pageNumber: { type: Number, default: null, min: 1, max: 100 } }, { _id: false })
const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 500 }, nameEvidence: { type: String, default: null, maxlength: 4000 },
  dosage: { type: String, default: null, maxlength: 1000 }, dosageEvidence: { type: String, default: null, maxlength: 4000 },
  route: { type: String, default: null, maxlength: 500 }, routeEvidence: { type: String, default: null, maxlength: 4000 },
  frequency: { type: String, default: null, maxlength: 1000 }, frequencyEvidence: { type: String, default: null, maxlength: 4000 },
  duration: { type: String, default: null, maxlength: 1000 }, durationEvidence: { type: String, default: null, maxlength: 4000 },
  instructions: { type: String, default: null, maxlength: 2000 }, instructionsEvidence: { type: String, default: null, maxlength: 4000 },
  pageNumber: { type: Number, default: null, min: 1, max: 100 },
}, { _id: false })
const sectionSchema = new mongoose.Schema({
  type: { type: String, required: true, maxlength: 100 }, title: { type: String, default: null, maxlength: 500 },
  titleEvidence: { type: String, default: null, maxlength: 4000 }, text: { type: String, required: true, maxlength: 4000 },
  evidence: { type: String, default: null, maxlength: 4000 }, pageNumber: { type: Number, default: null, min: 1, max: 100 },
}, { _id: false })
const detailSchema = new mongoose.Schema({ label: { type: String, required: true, maxlength: 500 }, value: { type: String, required: true, maxlength: 4000 }, evidence: { type: String, default: null, maxlength: 4000 }, pageNumber: { type: Number, default: null, min: 1, max: 100 } }, { _id: false })
const resultSchema = new mongoose.Schema({
  documentType: { type: String, default: null, maxlength: 120 }, documentTypeEvidence: { type: String, default: null, maxlength: 4000 },
  documentTitle: { type: String, default: null, maxlength: 500 }, documentTitleEvidence: { type: String, default: null, maxlength: 4000 },
  category: { type: String, default: null, maxlength: 200 }, categoryEvidence: { type: String, default: null, maxlength: 4000 },
  provider: { type: String, default: null, maxlength: 500 }, providerEvidence: { type: String, default: null, maxlength: 4000 },
  patientInformation: { type: [patientInformationSchema], default: [] },
  reportDate: { type: String, default: null, maxlength: 200 },
  reportDateEvidence: { type: String, default: null, maxlength: 4000 },
  findings: { type: [findingSchema], default: [] },
  tests: { type: [testSchema], default: [] },
  medications: { type: [medicationSchema], default: [] },
  sections: { type: [sectionSchema], default: [] },
  details: { type: [detailSchema], default: [] },
}, { _id: false })

const chunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true, maxlength: 64 },
  index: { type: Number, required: true, min: 0 },
  pageStart: { type: Number, required: true, min: 1, max: 100 },
  pageEnd: { type: Number, required: true, min: 1, max: 100 },
  estimatedInputTokens: { type: Number, required: true, min: 1 },
  depth: { type: Number, default: 0, min: 0, max: 8 },
  parentChunkId: { type: String, default: null, maxlength: 64 },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'split'], default: 'pending', required: true },
  attempts: { type: Number, default: 0, min: 0 },
  lastErrorCode: { type: String, default: null, maxlength: 64 },
  retryAt: { type: Date, default: null },
  result: { type: resultSchema, default: null },
}, { _id: false })

const documentAnalysisSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', required: true, index: true },
  result: { type: resultSchema, default: null },
  chunks: { type: [chunkSchema], default: [] },
  chunkProgress: {
    completed: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 },
  },
  sourceTextHash: { type: String, default: null, maxlength: 64 },
  lastAnalyzedAt: { type: Date, default: null },
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
