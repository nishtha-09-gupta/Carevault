import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import Document from '../models/Document.js'
import MedicalRecord from '../models/MedicalRecord.js'
import { deleteStoredDocument, uploadDocument } from './documentStorage.js'

const DEMO_RECORDS = [
  { key: 'cbc-blood-test', title: 'CBC Blood Test', fileName: 'cbc_blood_test_2026-10-04.pdf', uploadedAt: '2026-10-04T09:00:00.000Z' },
  { key: 'lipid-profile', title: 'Lipid Profile', fileName: 'lipid_profile_2026-10-02.pdf', uploadedAt: '2026-10-02T09:00:00.000Z' },
  { key: 'consultation-prescription', title: 'General Consultation Prescription', fileName: 'general_consultation_prescription_2026-09-30.pdf', uploadedAt: '2026-09-30T09:00:00.000Z' },
  { key: 'chest-xray-report', title: 'Chest X-Ray Report', fileName: 'chest_xray_report_2026-09-28.pdf', uploadedAt: '2026-09-28T09:00:00.000Z' },
  { key: 'discharge-summary', title: 'Discharge Summary', fileName: 'discharge_summary_2026-09-20.pdf', uploadedAt: '2026-09-20T09:00:00.000Z' },
  { key: 'annual-wellness-visit-sample', title: 'Annual Wellness Visit - Demo Sample', fileName: 'annual_wellness_visit_sample_2026-08-29.pdf', uploadedAt: '2026-08-30T09:00:00.000Z', category: 'Visit summary', eventDate: '2026-08-29' },
  { key: 'metabolic-panel-sample', title: 'Metabolic Panel - Demo Sample', fileName: 'metabolic_panel_sample_2026-06-12.pdf', uploadedAt: '2026-06-13T09:00:00.000Z', category: 'Lab result', eventDate: '2026-06-12' },
  { key: 'medication-summary-sample', title: 'Medication Summary - Demo Sample', fileName: 'medication_summary_sample_2026-05-03.pdf', uploadedAt: '2026-05-04T09:00:00.000Z', category: 'Medication', eventDate: '2026-05-03' },
  { key: 'historical-document-sample', title: 'Historical Health Document - Demo Sample', fileName: 'historical_health_document_sample_2025-12-04.pdf', uploadedAt: '2025-12-05T09:00:00.000Z', category: 'Other', eventDate: '2025-12-04' },
]

const DEMO_MEDICAL_RECORDS = [
  { key: 'complete-blood-count', title: 'Complete Blood Count', category: 'Lab result', provider: 'Northside Diagnostics', eventDate: '2026-09-18', documentKey: 'cbc-blood-test' },
  { key: 'annual-wellness-visit', title: 'Annual wellness visit', category: 'Visit summary', provider: 'Dr. Anika Sharma', eventDate: '2026-08-29' },
  { key: 'metabolic-panel', title: 'Metabolic panel', category: 'Lab result', provider: 'Northside Diagnostics', eventDate: '2026-06-12', documentKey: 'lipid-profile' },
  { key: 'medication-summary', title: 'Medication summary', category: 'Medication', provider: 'Patient added', eventDate: '2026-05-03' },
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
        category: record.category || null,
        eventDate: record.eventDate ? new Date(`${record.eventDate}T00:00:00.000Z`) : null,
      })
    } catch (error) {
      if (storedFile.public_id) await deleteStoredDocument(storedFile.public_id).catch(() => {})
      // Concurrent demo sign-ins may race on the partial unique demo seed index.
      if (error.code === 11000) continue
      throw error
    }
  }

  for (const sample of DEMO_MEDICAL_RECORDS) {
    const document = sample.documentKey
      ? await Document.findOne({ ownerId: user._id, demoSeedKey: sample.documentKey }).select('_id')
      : null
    await MedicalRecord.updateOne(
      { ownerId: user._id, demoSeedKey: sample.key },
      { $setOnInsert: {
        ownerId: user._id,
        demoSeedKey: sample.key,
        title: sample.title,
        category: sample.category,
        provider: sample.provider,
        eventDate: new Date(`${sample.eventDate}T00:00:00.000Z`),
        notes: '',
        documentId: document?._id || null,
      } },
      { upsert: true },
    )
  }
}
