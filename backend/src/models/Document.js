import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Stable seed key prevents duplicate copies of the interview account's stored records.
    demoSeedKey: { type: String, select: false },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    originalFileName: { type: String, required: true, maxlength: 255 },
    // Cloudinary's authenticated delivery URL. Use a temporary signed URL for reading.
    fileUrl: { type: String, required: true },
    filePublicId: { type: String, required: true, unique: true },
    fileType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
    fileSize: { type: Number, required: true, min: 1 },
    category: { type: String, enum: ['Lab result', 'Visit summary', 'Medication', 'Prescription', 'Imaging', 'Other'], default: null },
    eventDate: { type: Date, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

documentSchema.index({ ownerId: 1, uploadedAt: -1 })
documentSchema.index({ ownerId: 1, demoSeedKey: 1 }, { unique: true, partialFilterExpression: { demoSeedKey: { $type: 'string' } } })

export default mongoose.model('Document', documentSchema)
