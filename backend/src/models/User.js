import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: String, required: true, enum: ['patient', 'doctor'], default: 'patient' },
  passwordHash: { type: String, required: true, select: false },
  passwordSalt: { type: String, required: true, select: false },
  sessionVersion: { type: Number, default: 0, select: false },
  resetOtpHash: { type: String, select: false },
  resetOtpExpiresAt: { type: Date, select: false },
  resetOtpSentAt: { type: Date, select: false },
  resetOtpAttempts: { type: Number, select: false },
  resetGrantHash: { type: String, select: false },
  resetGrantExpiresAt: { type: Date, select: false },
}, { timestamps: true })

export default mongoose.model('User', userSchema)
