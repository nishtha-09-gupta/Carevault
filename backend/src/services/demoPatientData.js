import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import Document from '../models/Document.js'
import { deleteStoredDocument, uploadDocument } from './documentStorage.js'

const DEMO_RECORDS = [
  { key: 'cbc-blood-test', title: 'CBC Blood Test', fileName: 'cbc_blood_test_2026-10-04.pdf', uploadedAt: '2026-10-04T09:00:00.000Z' },
  { key: 'lipid-profile', title: 'Lipid Profile', fileName: 'lipid_profile_2026-10-02.pdf', uploadedAt: '2026-10-02T09:00:00.000Z' },
  { key: 'consultation-prescription', title: 'General Consultation Prescription', fileName: 'general_consultation_prescription_2026-09-30.pdf', uploadedAt: '2026-09-30T09:00:00.000Z' },
  { key: 'chest-xray-report', title: 'Chest X-Ray Report', fileName: 'chest_xray_report_2026-09-28.pdf', uploadedAt: '2026-09-28T09:00:00.000Z' },
  { key: 'discharge-summary', title: 'Discharge Summary', fileName: 'discharge_summary_2026-09-20.pdf', uploadedAt: '2026-09-20T09:00:00.000Z' },
]

/** Idempotently add real PDFs to the existing demo patient's normal document library. */
export async function ensureDemoPatientDocuments(user) {
  if (!user || user.role !== 'patient') return

  for (const record of DEMO_RECORDS) {
    const existing = await Document.findOne({
      ownerId: user._id,
      $or: [{ demoSeedKey: record.key }, { originalFileName: record.fileName }],
    }).select('_id')
    if (existing) continue

    const path = fileURLToPath(new URL(`../../demo-documents/${record.fileName}`, import.meta.url))
    const buffer = await readFile(path)
    const storedFile = await uploadDocument(buffer, record.fileName)
    try {
      await Document.create({
        ownerId: user._id,
        demoSeedKey: record.key,
        title: record.title,
        originalFileName: record.fileName,
        fileUrl: storedFile.secure_url,
        filePublicId: storedFile.public_id,
        fileType: 'application/pdf',
        fileSize: buffer.length,
        uploadedAt: new Date(record.uploadedAt),
      })
    } catch (error) {
      if (storedFile.public_id) await deleteStoredDocument(storedFile.public_id).catch(() => {})
      // Concurrent demo sign-ins may race on the partial unique demo seed index.
      if (error.code === 11000) continue
      throw error
    }
  }
}
