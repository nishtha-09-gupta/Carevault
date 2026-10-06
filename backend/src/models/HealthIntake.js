import mongoose from 'mongoose'

const healthIntakeSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mainConcern: { type: String, required: true, trim: true, maxlength: 2000 },
  startedAt: { type: Date, default: null },
  impact: { type: String, enum: ['', 'Mild', 'Moderate', 'Significant'], default: '' },
  allergies: { type: String, trim: true, maxlength: 2000, default: '' },
  medications: { type: String, trim: true, maxlength: 2000, default: '' },
  additionalNotes: { type: String, trim: true, maxlength: 5000, default: '' },
  status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
}, { timestamps: true })

healthIntakeSchema.index({ patientId: 1 }, { unique: true })

export default mongoose.model('HealthIntake', healthIntakeSchema)
