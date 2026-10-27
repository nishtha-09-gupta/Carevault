import { createHash, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import Document from '../models/Document.js'
import DocumentAnalysis from '../models/DocumentAnalysis.js'
import HealthIntake from '../models/HealthIntake.js'
import MedicalRecord from '../models/MedicalRecord.js'
import PatientSummary from '../models/PatientSummary.js'
import User from '../models/User.js'
import { findActivePatientGrant } from '../services/patientAccess.js'
import { generateMedicalSummary } from '../services/groqMedicalAnalysis.js'
import { MedicalAnalysisResult } from '../services/medicalAnalysisSchema.js'

function textValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function dateValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && value.trim()) {
    const input = value.trim()
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00.000Z` : input)
    if (Number.isFinite(date.getTime())) {
      const normalized = date.toISOString().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || normalized === input) return normalized
    }
  }
  return null
}

function recordText(record) {
  return [record.title, record.category, record.provider, dateValue(record.eventDate), record.notes].map(textValue).filter(Boolean).join('\n')
}

function normalizedAnalysisResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = {
    reportDate: dateValue(value.reportDate),
    reportDateEvidence: textValue(value.reportDateEvidence) || null,
    findings: (Array.isArray(value.findings) ? value.findings : []).flatMap((finding) => {
      if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return []
      const text = textValue(finding.text)
      return text ? [{ text, evidence: textValue(finding.evidence) || null }] : []
    }),
    tests: (Array.isArray(value.tests) ? value.tests : []).flatMap((test) => {
      if (!test || typeof test !== 'object' || Array.isArray(test) || !textValue(test.name)) return []
      const flag = ['high', 'low', 'positive', 'negative', 'abnormal', 'normal'].includes(test.abnormalFlag) ? test.abnormalFlag : null
      return [{
        name: textValue(test.name), nameEvidence: textValue(test.nameEvidence) || null,
        value: textValue(test.value) || null, valueEvidence: textValue(test.valueEvidence) || null,
        unit: textValue(test.unit) || null, unitEvidence: textValue(test.unitEvidence) || null,
        referenceRange: textValue(test.referenceRange) || null, referenceRangeEvidence: textValue(test.referenceRangeEvidence) || null,
        abnormalFlag: flag, abnormalFlagEvidence: textValue(test.abnormalFlagEvidence) || null,
      }]
    }),
  }
  const parsed = MedicalAnalysisResult.safeParse(result)
  return parsed.success ? parsed.data : null
}

function analysisText(analysis) {
  const result = normalizedAnalysisResult(analysis.reviewedResult) || normalizedAnalysisResult(analysis.result)
  if (!result) return ''
  return [result.reportDate && `Report date: ${result.reportDate}`,
    ...result.findings.map((finding) => finding.evidence || finding.text),
    ...result.tests.flatMap((test) => [test.nameEvidence || test.name, test.valueEvidence, test.unitEvidence, test.referenceRangeEvidence, test.abnormalFlagEvidence].filter(Boolean))]
    .map(textValue).filter(Boolean).join('\n')
}

function comparableChanges(analyses, documents) {
  const documentMap = new Map(documents.map((document) => [String(document._id), document]))
  const groups = new Map()
  for (const analysis of analyses) {
    const result = normalizedAnalysisResult(analysis.reviewedResult) || normalizedAnalysisResult(analysis.result)
    if (!result) continue
    const document = documentMap.get(String(analysis.documentId))
    const date = result.reportDate || (document?.eventDate ? new Date(document.eventDate).toISOString().slice(0, 10) : null)
    if (!date) continue
    for (const test of result.tests) {
      if (!test.value || !test.unit || !test.name) continue
      const numeric = /^\s*[+-]?(?:\d+\.?\d*|\.\d+)\s*$/.test(test.value) ? Number(test.value) : NaN
      if (!Number.isFinite(numeric)) continue
      const key = `${test.name.trim().toLowerCase()}|${test.unit.trim().toLowerCase()}`
      const values = groups.get(key) || []
      values.push({ name: test.name, value: test.value, unit: test.unit, date, documentId: document ? String(document._id) : null, confirmed: Boolean(analysis.confirmedAt) })
      groups.set(key, values)
    }
  }
  return [...groups.values()].flatMap((values) => {
    const distinctDates = [...new Map(values.sort((a, b) => a.date.localeCompare(b.date)).map((value) => [value.date, value])).values()]
    if (distinctDates.length < 2) return []
    return [{ testName: distinctDates[0].name, previous: distinctDates[0], latest: distinctDates.at(-1) }]
  })
}

async function loadSources(patientId) {
  const [patient, documents, analyses, records, intake] = await Promise.all([
    User.findOne({ _id: patientId, role: 'patient' }).select('_id name email').lean(),
    Document.find({ ownerId: patientId }).select('_id title originalFileName category eventDate uploadedAt analysisStatus').sort({ uploadedAt: -1 }).lean(),
    DocumentAnalysis.find({ ownerId: patientId, status: 'completed' }).sort({ updatedAt: -1 }).lean(),
    MedicalRecord.find({ ownerId: patientId }).sort({ eventDate: -1, updatedAt: -1 }).lean(),
    HealthIntake.findOne({ patientId, status: 'submitted' }).lean(),
  ])
  if (!patient) return null
  const byDocument = new Map(documents.map((document) => [String(document._id), document]))
  const sources = []
  for (const record of records) {
    const linkedDocumentId = record.documentId ? String(record.documentId) : null
    const ownedDocumentId = linkedDocumentId && byDocument.has(linkedDocumentId) ? linkedDocumentId : null
    sources.push({ id: `record:${record._id}`, text: recordText(record), verification: record.analysisId ? 'patient-confirmed' : 'patient-record', documentId: ownedDocumentId, date: record.eventDate || record.updatedAt })
  }
  for (const analysis of analyses) {
    const doc = byDocument.get(String(analysis.documentId))
    if (!doc) continue
    const text = analysisText(analysis)
    if (text) sources.push({ id: `analysis:${analysis._id}`, text, verification: analysis.confirmedAt ? 'patient-confirmed' : 'unconfirmed-ai-extraction', documentId: String(doc._id), date: analysis.result?.reportDate || doc.eventDate || doc.uploadedAt })
  }
  if (intake) {
    const mainConcern = textValue(intake.mainConcern)
    const intakeDate = dateValue(intake.startedAt)
    const impact = textValue(intake.impact)
    const medications = textValue(intake.medications)
    const allergies = textValue(intake.allergies)
    const additionalNotes = textValue(intake.additionalNotes)
    sources.push({ id: `intake:${intake._id}`, text: [mainConcern && `Patient-reported concern: ${mainConcern}`, intakeDate && `Started: ${intakeDate}`, impact && `Impact: ${impact}`, medications && `Patient-reported medications: ${medications}`, allergies && `Patient-reported allergies: ${allergies}`, additionalNotes].filter(Boolean).join('\n'), verification: 'patient-reported', documentId: null, date: intake.updatedAt })
  }
  const fingerprintPayload = JSON.stringify({
    documents: documents.map(({ _id, uploadedAt, analysisStatus, title, eventDate }) => [_id, uploadedAt, analysisStatus, title, eventDate]),
    analyses: analyses.map(({ _id, updatedAt, confirmedAt, result, reviewedResult }) => [_id, updatedAt, confirmedAt, result, reviewedResult]),
    records: records.map(({ _id, updatedAt, title, category, provider, notes, eventDate }) => [_id, updatedAt, title, category, provider, notes, eventDate]),
    intake: intake ? [intake._id, intake.updatedAt, intake.mainConcern, intake.startedAt, intake.impact, intake.medications, intake.allergies, intake.additionalNotes] : null,
  })
  const fingerprint = createHash('sha256').update(fingerprintPayload).digest('hex')
  const analyzedDocumentIds = new Set(analyses.filter((analysis) => byDocument.has(String(analysis.documentId))).map((analysis) => String(analysis.documentId)))
  const documentsAwaitingAnalysis = documents.filter((document) => !analyzedDocumentIds.has(String(document._id))).length
  const usedDocuments = new Set(sources.map((source) => source.documentId).filter(Boolean))
  const refs = documents.filter((doc) => usedDocuments.has(String(doc._id))).map((doc) => ({ id: String(doc._id), title: doc.title, fileName: doc.originalFileName, date: doc.eventDate || doc.uploadedAt, status: doc.analysisStatus }))
  return { patient, documents, analyses, records, intake, sources: sources.filter((source) => typeof source.text === 'string' && source.text.trim()), documentsAwaitingAnalysis, fingerprint, refs, changesOverTime: comparableChanges(analyses, documents) }
}

function safeSummary(row, sources, isFresh, changesOverTime = []) {
  const evidenceMap = new Map(sources.map((source) => [source.id, source]))
  const statements = (items = []) => items.map((item) => ({
    text: item.text,
    evidence: item.evidence,
    sources: item.sourceIds.map((id) => evidenceMap.get(id)).filter(Boolean).map(({ id, verification, documentId, date }) => ({ id, verification, documentId, date })),
  }))
  return {
    id: String(row._id), status: row.status, freshness: row.status === 'completed' ? (isFresh ? 'current' : 'needs_refresh') : null,
    generatedAt: row.generatedAt, updatedAt: row.updatedAt, insufficientInformation: row.insufficientInformation,
    overview: row.overview ? statements([row.overview])[0] : null,
    keyPoints: statements(row.keyPoints), medications: statements(row.medications), allergies: statements(row.allergies),
    sourceReferences: row.sourceReferences || [], changesOverTime, lastErrorCode: row.status === 'failed' ? row.lastErrorCode : null,
  }
}

async function authorizeDoctor(req, res) {
  if (req.user.role !== 'doctor') { res.status(403).json({ error: 'Only doctors can access patient summaries.' }); return false }
  if (!mongoose.isValidObjectId(req.params.patientId)) { res.status(404).json({ error: 'Summary not found.' }); return false }
  if (!await findActivePatientGrant(req.params.patientId, req.user.id)) { res.status(403).json({ error: 'The patient has not granted you active access.' }); return false }
  return true
}

function summaryFailureMessage(code) {
  const messages = {
    GROQ_NOT_CONFIGURED: 'AI summary generation is not configured on the server. Ask the CareVault administrator to set the backend Groq credentials.',
    GROQ_MODEL_UNSUPPORTED: 'The configured Groq model cannot generate this summary. Ask the CareVault administrator to check GROQ_MODEL.',
    GROQ_AUTH_FAILED: 'The backend could not authenticate with Groq. Ask the CareVault administrator to verify its Groq credentials.',
    GROQ_MODEL_UNAVAILABLE: 'The configured Groq model is unavailable to the backend. Ask the CareVault administrator to verify the model setting and account access.',
    GROQ_RATE_LIMITED: 'Groq is temporarily rate limiting summary requests. Wait briefly, then retry.',
    GROQ_TIMEOUT: 'Groq did not respond before the request timed out. Please retry in a moment.',
    GROQ_CONNECTION_ERROR: 'The backend could not connect to Groq. Please retry; if this continues, ask the CareVault administrator to check backend network access.',
    GROQ_TEMPORARY_FAILURE: 'Groq is temporarily unavailable. Please retry in a moment.',
    GROQ_REQUEST_REJECTED: 'Groq rejected the structured summary request. Ask the CareVault administrator to check the model and structured-output configuration.',
    GROQ_INPUT_TOO_LARGE: 'The available report information exceeds Groq’s request limit. Review or analyze reports individually, then try refreshing the summary.',
    GROQ_SCHEMA_INVALID: 'Groq returned a summary in an unsupported format. Please retry later.',
    GROQ_SOURCE_INVALID: 'The generated summary could not be matched safely to its source records. No summary was saved; please retry later.',
    GROQ_SOURCE_ID_INVALID: 'Groq referenced a source that is not available to this summary. No unsupported information was saved.',
    GROQ_SOURCE_EVIDENCE_INVALID: 'Groq could not ground a summary statement in its source records. No unsupported information was saved; please retry later.',
    GROQ_MALFORMED_RESPONSE: 'Groq returned an incomplete summary response. Please retry later.',
    GROQ_EMPTY_RESPONSE: 'Groq returned an empty or incomplete summary. Please retry later.',
  }
  return messages[code] || 'The summary could not be generated. Please retry; if this continues, ask the CareVault administrator to check the backend logs and AI configuration.'
}

export async function getPatientSummary(req, res) {
  if (!await authorizeDoctor(req, res)) return
  return readPatientSummary(req.params.patientId, req, res)
}

async function readPatientSummary(patientId, req, res) {
  const snapshot = await loadSources(patientId)
  if (!snapshot) return res.status(404).json({ error: 'Patient not found.' })
  const row = await PatientSummary.findOne({ patientId })
  res.setHeader('Cache-Control', 'private, no-store')
  if (!row) return res.json({ summary: null, patient: snapshot.patient, freshness: 'not_generated', changesOverTime: snapshot.changesOverTime })
  if (row.status === 'generating' && row.leaseUntil <= new Date()) {
    row.status = 'failed'; row.lastErrorCode = 'SUMMARY_INTERRUPTED'; row.generationToken = null; row.leaseUntil = null
    await row.save()
  }
  if (req.user.role === 'doctor' && !await findActivePatientGrant(patientId, req.user.id)) return res.status(403).json({ error: 'The patient has not granted you active access.' })
  const isFresh = row.sourceFingerprint === snapshot.fingerprint && row.schemaVersion === 2
  return res.json({ summary: safeSummary(row, snapshot.sources, isFresh, snapshot.changesOverTime), patient: snapshot.patient, freshness: isFresh ? 'current' : 'needs_refresh', changesOverTime: snapshot.changesOverTime })
}

export async function generatePatientSummary(req, res, { generate = generateMedicalSummary } = {}) {
  if (!await authorizeDoctor(req, res)) return
  return generateForPatient(req.params.patientId, req, res, generate)
}

async function generateForPatient(patientId, req, res, generate) {
  let snapshot
  try { snapshot = await loadSources(patientId) }
  catch (error) {
    console.error('Patient summary source selection failed:', { stage: 'source_selection', code: 'SUMMARY_SOURCE_LOAD_FAILED', errorName: error?.name || 'Error' })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(503).json({ code: 'SUMMARY_SOURCE_LOAD_FAILED', error: 'CareVault could not read the available health records. Your records were not changed. Please retry; if it continues, ask the CareVault administrator to check the backend logs.' })
  }
  if (!snapshot) return res.status(404).json({ error: 'Patient not found.' })
  if (!snapshot.sources.length) {
    res.setHeader('Cache-Control', 'private, no-store')
    if (snapshot.documentsAwaitingAnalysis > 0) return res.status(422).json({ code: 'SUMMARY_REPORTS_NEED_ANALYSIS', error: 'You have uploaded reports, but none has a completed AI analysis yet. Analyze a report from AI Analysis, then return here to generate your summary.' })
    return res.status(422).json({ code: 'SUMMARY_INSUFFICIENT_INFORMATION', error: 'There is not enough documented medical information in CareVault to create a summary yet. Add a medical record, submit your health intake, or analyze a report first.' })
  }
  const current = await PatientSummary.findOne({ patientId })
  if (current?.status === 'completed' && current.schemaVersion === 2 && current.sourceFingerprint === snapshot.fingerprint && req.body?.refresh !== true) {
    if (req.user.role === 'doctor' && !await findActivePatientGrant(patientId, req.user.id)) return res.status(403).json({ error: 'The patient has not granted you active access.' })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ summary: safeSummary(current, snapshot.sources, true, snapshot.changesOverTime), patient: snapshot.patient, freshness: 'current' })
  }
  if (!current) {
    try { await PatientSummary.create({ patientId, status: 'failed', lastErrorCode: 'SUMMARY_NOT_GENERATED' }) }
    catch (error) { if (error?.code !== 11000) throw error }
  }
  const token = randomUUID()
  const now = new Date()
  const row = await PatientSummary.findOneAndUpdate({ patientId, $or: [{ status: { $ne: 'generating' } }, { leaseUntil: { $lte: now } }] }, {
    $set: { status: 'generating', generationToken: token, leaseUntil: new Date(now.getTime() + 90000), sourceFingerprint: snapshot.fingerprint, generatedByDoctorId: req.user.role === 'doctor' ? req.user.id : null, lastErrorCode: null },
  }, { new: true })
  if (!row) {
    const active = await PatientSummary.findOne({ patientId })
    if (req.user.role === 'doctor' && !await findActivePatientGrant(patientId, req.user.id)) return res.status(403).json({ error: 'The patient has not granted you active access.' })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(202).json({ summary: safeSummary(active, snapshot.sources, false, snapshot.changesOverTime), patient: snapshot.patient, freshness: 'needs_refresh', changesOverTime: snapshot.changesOverTime })
  }
  let stage = 'generation'
  try {
    if (req.user.role === 'doctor' && !await findActivePatientGrant(patientId, req.user.id)) return res.status(403).json({ error: 'The patient has not granted you active access.' })
    const generated = await generate(snapshot.sources)
    const references = snapshot.refs
    stage = 'persistence'
    const saved = await PatientSummary.findOneAndUpdate({ _id: row._id, generationToken: token }, {
      $set: { status: 'completed', schemaVersion: 2, generatedAt: new Date(), overview: generated.overview, keyPoints: generated.keyPoints, medications: generated.medications, allergies: generated.allergies, insufficientInformation: generated.insufficientInformation, sourceReferences: references, generationToken: null, leaseUntil: null, lastErrorCode: null },
    }, { new: true })
    if (!saved) throw Object.assign(new Error('Summary generation lease was lost before results could be saved.'), { code: 'SUMMARY_PERSISTENCE_CONFLICT' })
    if (req.user.role === 'doctor' && !await findActivePatientGrant(patientId, req.user.id)) return res.status(403).json({ error: 'The patient has not granted you active access.' })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ summary: safeSummary(saved, snapshot.sources, true, snapshot.changesOverTime), patient: snapshot.patient, freshness: 'current', changesOverTime: snapshot.changesOverTime })
  } catch (error) {
    const code = /^[A-Z0-9_]{2,64}$/.test(error?.code || '') ? error.code : stage === 'persistence' ? 'SUMMARY_PERSISTENCE_FAILED' : 'SUMMARY_GENERATION_FAILED'
    await PatientSummary.updateOne({ _id: row._id, generationToken: token }, { $set: { status: 'failed', lastErrorCode: code, generationToken: null, leaseUntil: null } })
    console.error('Patient summary generation failed:', { stage, code, errorName: error?.name || 'Error', sourceCount: snapshot.sources.length, documentCount: snapshot.documents.length, completedAnalysisCount: snapshot.analyses.length, medicalRecordCount: snapshot.records.length, hasSubmittedIntake: Boolean(snapshot.intake) })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(503).json({ error: summaryFailureMessage(code), code })
  }
}
