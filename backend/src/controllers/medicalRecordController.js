import mongoose from 'mongoose'
import Document from '../models/Document.js'
import MedicalRecord from '../models/MedicalRecord.js'
import { createTimelineEvents, parseMedicalRecord, parseMedicalDate } from '../utils/healthRecords.js'

function patientOnly(req, res) {
  if (req.user.role === 'patient') return true
  res.status(403).json({ error: 'Only patients can manage medical records.' })
  return false
}

function apiRecord(record) {
  const r = record.toObject ? record.toObject() : record
  const linked = r.documentId && typeof r.documentId === 'object' ? r.documentId : null
  return { id: String(r._id), title: r.title, category: r.category, provider: r.provider, eventDate: r.eventDate, notes: r.notes, documentId: linked ? String(linked._id) : null, document: linked ? { id: String(linked._id), title: linked.title, uploadedAt: linked.uploadedAt, fileType: linked.fileType } : null, isDemoSample: Boolean(r.demoSeedKey), createdAt: r.createdAt, updatedAt: r.updatedAt }
}

async function ownedRecords(ownerId) {
  return MedicalRecord.find({ ownerId }).select('+demoSeedKey').populate({ path: 'documentId', match: { ownerId }, select: 'title uploadedAt fileType +demoSeedKey' }).sort({ eventDate: -1, createdAt: -1 })
}

export async function listMedicalRecords(req, res) {
  if (!patientOnly(req, res)) return
  const [records, docs] = await Promise.all([
    ownedRecords(req.user.id),
    Document.find({ ownerId: req.user.id }).select('+demoSeedKey').sort({ uploadedAt: -1 }),
  ])
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ records: records.map(apiRecord), documents: docs.map((d) => ({ id: String(d._id), title: d.title, uploadedAt: d.uploadedAt, fileType: d.fileType, category: d.category, eventDate: d.eventDate, isDemoSample: Boolean(d.demoSeedKey) })), isDemoAccount: req.user.email === 'demo@gmail.com' })
}

export async function createMedicalRecord(req, res) {
  if (!patientOnly(req, res)) return
  const parsed = parseMedicalRecord(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  let documentId = null
  if (req.body.documentId) {
    if (!mongoose.isValidObjectId(req.body.documentId)) return res.status(400).json({ error: 'Choose a valid linked document.' })
    const document = await Document.findOne({ _id: req.body.documentId, ownerId: req.user.id }).select('_id')
    if (!document) return res.status(404).json({ error: 'Linked document not found.' })
    documentId = document._id
  }
  const record = await MedicalRecord.create({ ...parsed.fields, ownerId: req.user.id, documentId })
  const populated = await MedicalRecord.findById(record._id).populate({ path: 'documentId', select: 'title uploadedAt fileType' })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(201).json({ record: apiRecord(populated) })
}

export async function updateMedicalRecord(req, res) {
  if (!patientOnly(req, res)) return
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Medical record not found.' })
  const parsed = parseMedicalRecord(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  let documentId = null
  if (req.body.documentId) {
    if (!mongoose.isValidObjectId(req.body.documentId)) return res.status(400).json({ error: 'Choose a valid linked document.' })
    const document = await Document.findOne({ _id: req.body.documentId, ownerId: req.user.id }).select('_id')
    if (!document) return res.status(404).json({ error: 'Linked document not found.' })
    documentId = document._id
  }
  const record = await MedicalRecord.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, { $set: { ...parsed.fields, documentId } }, { new: true, runValidators: true }).populate({ path: 'documentId', select: 'title uploadedAt fileType' })
  if (!record) return res.status(404).json({ error: 'Medical record not found.' })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ record: apiRecord(record) })
}

export async function deleteMedicalRecord(req, res) {
  if (!patientOnly(req, res)) return
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Medical record not found.' })
  const deleted = await MedicalRecord.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id })
  if (!deleted) return res.status(404).json({ error: 'Medical record not found.' })
  return res.json({ message: 'Medical record deleted.' })
}

export async function getMyTimeline(req, res) {
  if (!patientOnly(req, res)) return
  const [records, documents] = await Promise.all([
    ownedRecords(req.user.id),
    Document.find({ ownerId: req.user.id }).select('+demoSeedKey').sort({ uploadedAt: -1 }),
  ])
  const apiRecords = records.map(apiRecord)
  const events = createTimelineEvents(apiRecords, documents.map((d) => ({ id: String(d._id), title: d.title, category: d.category, eventDate: d.eventDate, uploadedAt: d.uploadedAt })))
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ events, isDemoAccount: req.user.email === 'demo@gmail.com' })
}

export { parseMedicalDate }
