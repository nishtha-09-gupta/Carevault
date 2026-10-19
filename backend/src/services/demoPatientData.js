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
  'annual_wellness_visit_sample_2026-08-29.pdf': 'e1b1d78f438e7d7edb7d63e36cbb3cc17a98a90fdd8968162531556e8dc6f6ce',
  'cbc_blood_test_2026-10-04.pdf': '69988dcea581cfa75829356d40c230f074d32694d0ab6bac108ef7d17adbc4b8',
  'chest_xray_report_2026-09-28.pdf': 'bc9e4dbe338d63c81ea30ac293999f562cd6f0cd58602f7324629b4352799657',
  'discharge_summary_2026-09-20.pdf': '2c59293f907165941be7555fd7b85dfee33741e02dbd86f5d88e025cba6b7019',
  'general_consultation_prescription_2026-09-30.pdf': '22afab8a0e5993754a3ce435c4257fb11eba79d1e39177beb707a488ff2a78ea',
  'historical_health_document_sample_2025-12-04.pdf': 'e6546603e3d5e49bd54ad77f394eee1fda929c6e01cfc3ad2a26d2bcf2ba84a5',
  'lipid_profile_2026-10-02.pdf': 'a79f593853f812154343f2a644d80a3f4bd0e7544818b07b0ee4ac48b4aa3480',
  'medication_summary_sample_2026-05-03.pdf': '72f6f4f5660bee81b08a6470e754ccc073ccd251c2917aa3406384445a8609e8',
  'metabolic_panel_sample_2026-06-12.pdf': 'dc39c25354f627101097187a819052ec9fb369dd3b307aa01a65e7dd8a456975',
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
