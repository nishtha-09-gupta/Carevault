import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
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

// SHA-256 allowlist for the reviewed, fictional PDF fixtures. A mismatch aborts
// before the first storage upload so replaced files cannot enter demo storage.
const FIXTURE_SHA256 = {
  'annual_wellness_visit_sample_2026-08-29.pdf': 'd7204bbe830c439409ed353a6f89e09a6a4e8d35ef5acb22906b454e2c22a1c6',
  'cbc_blood_test_2026-10-04.pdf': '69988dcea581cfa75829356d40c230f074d32694d0ab6bac108ef7d17adbc4b8',
  'chest_xray_report_2026-09-28.pdf': '79549a795d2caa63a1e5d2ea69f62579144ab2eab11643d33aa5c7e656612fd4',
  'discharge_summary_2026-09-20.pdf': 'de75d32bdab113b447f8d0861a8ae210be75620d58d4e82d6e49948d3783e73e',
  'general_consultation_prescription_2026-09-30.pdf': 'cccc0e66cdbf008dcf3f9cbe15c413921b9bed0feb071b5ad2a1556e103ea806',
  'historical_health_document_sample_2025-12-04.pdf': 'c6fb5e061cbe44dffec5f72dbb63e9abc6e7f9f8f7511b6ea86ee991ed37f9c2',
  'lipid_profile_2026-10-02.pdf': 'ebcf2845e2be32cf784131594f572e61aa6fc10d8f6422565ee9e1848735b452',
  'medication_summary_sample_2026-05-03.pdf': 'dbcb309d8adeb3c165fb9090f3f6dcd9899e2842ae46d3632e8e64bae069e4ae',
  'metabolic_panel_sample_2026-06-12.pdf': '7117fd1465266c1b382a874ce81c198ae92b918dfa290e29464c2f46da640812',
}

export async function loadVerifiedDemoFixtures() {
  const filenames = [...new Set(DEMO_RECORDS.map(({ fileName }) => fileName))].sort()
  const approved = Object.keys(FIXTURE_SHA256).sort()
  if (JSON.stringify(filenames) !== JSON.stringify(approved)) throw new Error('Demo PDF fixture inventory does not match the reviewed allowlist.')
  const buffers = new Map()
  for (const fileName of filenames) {
    const path = fileURLToPath(new URL(`../../demo-documents/${fileName}`, import.meta.url))
    const buffer = await readFile(path)
    const digest = createHash('sha256').update(buffer).digest('hex')
    if (digest !== FIXTURE_SHA256[fileName]) throw new Error(`Demo PDF fixture verification failed: ${fileName}`)
    buffers.set(fileName, buffer)
  }
  return buffers
}

/** Idempotently add real PDFs to the existing demo patient's normal document library. */
export async function ensureDemoPatientDocuments(user, verifiedFixtures = null) {
  if (!user || user.role !== 'patient') return

  verifiedFixtures ||= await loadVerifiedDemoFixtures()

  for (const record of DEMO_RECORDS) {
    const existing = await Document.findOne({
      ownerId: user._id,
      $or: [{ demoSeedKey: record.key }, { originalFileName: record.fileName }],
    }).select('_id')
    if (existing) continue

    const buffer = verifiedFixtures.get(record.fileName)
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
        analysisStatus: 'not_requested',
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
