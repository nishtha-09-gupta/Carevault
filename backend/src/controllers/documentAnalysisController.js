import mongoose from 'mongoose'
import Document from '../models/Document.js'
import DocumentAnalysis from '../models/DocumentAnalysis.js'
import MedicalRecord from '../models/MedicalRecord.js'
import { findActivePatientGrant } from '../services/patientAccess.js'
import { kickDocumentAnalysis, requestDocumentAnalysis } from '../services/documentAnalysisQueue.js'
import { MedicalAnalysisResult } from '../services/medicalAnalysisSchema.js'

function apiAnalysis(analysis) {
  return {
    id: String(analysis._id), status: analysis.status, result: analysis.reviewedResult || analysis.result,
    confirmed: Boolean(analysis.confirmedAt), confirmedAt: analysis.confirmedAt,
    lastErrorCode: analysis.status === 'failed' ? analysis.lastErrorCode : null,
    attempts: analysis.attempts,
  }
}

async function owned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null
  return Document.findOne({ _id: req.params.id, ownerId: req.user.id }).select('+demoSeedKey')
}

export async function getOwnedDocumentAnalysis(req, res) {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can review document analysis.' })
  const document = await owned(req)
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  let analysis = await DocumentAnalysis.findOne({ documentId: document._id, ownerId: req.user.id })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ analysis: analysis ? apiAnalysis(analysis) : { id: null, status: document.analysisStatus, result: null, confirmed: false } })
}

export async function startDocumentAnalysis(req, res) {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can analyze their documents.' })
  const document = await owned(req)
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  const existing = await DocumentAnalysis.findOne({ documentId: document._id, ownerId: req.user.id })
  const reanalyze = req.body?.reanalyze === true
  if (existing?.confirmedAt) return res.status(409).json({ error: 'This report was already confirmed. It remains linked to your medical timeline.' })
  if (existing && ['pending', 'processing'].includes(existing.status)) {
    // A pending row may have been created by upload before the worker became available.
    // Re-kick is safe: the worker claims jobs atomically and will ignore a live lease.
    if (existing.status === 'pending') kickDocumentAnalysis(document._id, req.user.id)
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(202).json({ analysis: apiAnalysis(existing) })
  }
  if (existing?.status === 'completed' && !reanalyze) {
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ analysis: apiAnalysis(existing) })
  }
  try {
    const analysis = await requestDocumentAnalysis(document, { reanalyze: reanalyze || existing?.status === 'failed', existing })
    kickDocumentAnalysis(document._id, req.user.id)
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(202).json({ analysis: apiAnalysis(analysis) })
  } catch (error) {
    if (error?.code === 'UNSUPPORTED_DOCUMENT_TYPE') return res.status(400).json({ error: error.message })
    throw error
  }
}

export async function getSharedDocumentAnalysis(req, res) {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only doctors can view shared patient analysis.' })
  if (!mongoose.isValidObjectId(req.params.patientId) || !mongoose.isValidObjectId(req.params.documentId)) return res.status(404).json({ error: 'Analysis not found.' })
  const grant = await findActivePatientGrant(req.params.patientId, req.user.id)
  if (!grant) return res.status(403).json({ error: 'The patient has not granted you active access.' })
  const document = await Document.findOne({ _id: req.params.documentId, ownerId: req.params.patientId }).select('_id analysisStatus +demoSeedKey')
  if (!document) return res.status(404).json({ error: 'Analysis not found.' })
  const analysis = await DocumentAnalysis.findOne({ documentId: document._id, ownerId: req.params.patientId })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ analysis: analysis ? apiAnalysis(analysis) : { id: null, status: document.analysisStatus, result: null, confirmed: false } })
}

export async function reviewDocumentAnalysis(req, res) {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can review document analysis.' })
  const document = await owned(req)
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  if (!mongoose.isValidObjectId(req.params.analysisId)) return res.status(404).json({ error: 'Analysis not found.' })
  const analysis = await DocumentAnalysis.findOne({ _id: req.params.analysisId, documentId: document._id, ownerId: req.user.id, status: 'completed', confirmedAt: null })
  if (!analysis) return res.status(404).json({ error: 'Completed unconfirmed analysis not found.' })
  const result = MedicalAnalysisResult.safeParse(req.body?.result)
  if (!result.success) return res.status(400).json({ error: 'Review fields do not match the expected format.' })
  analysis.reviewedResult = result.data
  await analysis.save()
  return res.json({ analysis: apiAnalysis(analysis) })
}

function recordNotes(result) {
  const lines = []
  if (result.reportDate) lines.push(`Report date: ${result.reportDate}`)
  for (const finding of result.findings) lines.push(`Finding: ${finding.text}`)
  for (const test of result.tests) {
    const value = [test.value, test.unit].filter(Boolean).join(' ')
    const details = [value || null, test.referenceRange ? `Reference range: ${test.referenceRange}` : null, test.abnormalFlag ? `Flag: ${test.abnormalFlag}` : null].filter(Boolean).join('; ')
    lines.push(`${test.name}${details ? `: ${details}` : ''}`)
  }
  return lines.join('\n').slice(0, 5000)
}

export async function confirmDocumentAnalysis(req, res) {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can confirm document analysis.' })
  const document = await owned(req)
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  if (!mongoose.isValidObjectId(req.params.analysisId)) return res.status(404).json({ error: 'Analysis not found.' })
  const analysis = await DocumentAnalysis.findOne({ _id: req.params.analysisId, documentId: document._id, ownerId: req.user.id, status: 'completed' })
  if (!analysis) return res.status(404).json({ error: 'Completed analysis not found.' })
  if (analysis.confirmedAt) {
    const priorRecord = await MedicalRecord.findOne({ analysisId: analysis._id, ownerId: req.user.id })
    if (!priorRecord) return res.status(409).json({ error: 'This analysis was already confirmed.' })
    return res.json({ analysis: apiAnalysis(analysis), recordId: String(priorRecord._id) })
  }
  const result = MedicalAnalysisResult.safeParse(req.body?.result || analysis.reviewedResult || analysis.result)
  if (!result.success) return res.status(400).json({ error: 'Confirm fields do not match the expected format.' })
  if (!result.data.reportDate && result.data.findings.length === 0 && result.data.tests.length === 0) {
    return res.status(400).json({ error: 'There is no extracted information to add. You can create a medical record manually.' })
  }
  let record
  try {
    record = await MedicalRecord.findOneAndUpdate({ analysisId: analysis._id }, { $setOnInsert: {
      ownerId: req.user.id, analysisId: analysis._id, title: document.title,
      category: result.data.tests.length ? 'Lab result' : 'Other',
      eventDate: result.data.reportDate ? new Date(`${result.data.reportDate}T00:00:00.000Z`) : document.eventDate,
      notes: recordNotes(result.data), documentId: document._id,
    } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  } catch (error) {
    if (error.code !== 11000) throw error
    record = await MedicalRecord.findOne({ analysisId: analysis._id })
    if (!record) throw error
  }
  analysis.reviewedResult = result.data
  analysis.confirmedRecordId = record._id
  analysis.confirmedAt ||= new Date()
  await analysis.save()
  await Document.updateOne({ _id: document._id, ownerId: req.user.id }, { $set: { analysisStatus: 'completed' } })
  return res.json({ analysis: apiAnalysis(analysis), recordId: String(record._id) })
}

export async function retryDocumentAnalysis(req, res) {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can retry document analysis.' })
  const document = await owned(req)
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  const analysis = await DocumentAnalysis.findOne({ documentId: document._id, ownerId: req.user.id })
  if (!analysis || analysis.status !== 'failed' || analysis.confirmedAt) return res.status(409).json({ error: 'Only failed, unconfirmed analysis can be retried.' })
  analysis.status = 'pending'; analysis.attempts = 0; analysis.lastErrorCode = null; analysis.nextAttemptAt = new Date(); analysis.leaseUntil = null; analysis.leaseToken = undefined
  await analysis.save()
  await Document.updateOne({ _id: document._id, ownerId: req.user.id }, { $set: { analysisStatus: 'pending' } })
  kickDocumentAnalysis(document._id, req.user.id)
  return res.json({ analysis: apiAnalysis(analysis) })
}
