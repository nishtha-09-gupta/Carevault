import mongoose from 'mongoose'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import Document from '../models/Document.js'
import MedicalRecord from '../models/MedicalRecord.js'
import { findActivePatientGrant } from '../services/patientAccess.js'
import { createTemporaryFileUrl, deleteStoredDocument, uploadDocument } from '../services/documentStorage.js'
import { getTitle, validateFileContents } from '../utils/documentValidation.js'
import { MEDICAL_RECORD_CATEGORIES } from '../models/MedicalRecord.js'
import { parseMedicalDate } from '../utils/healthRecords.js'

function toApiDocument(document) {
  const value = document.toObject()
  return {
    id: String(value._id),
    title: value.title,
    originalFileName: value.originalFileName,
    fileType: value.fileType,
    fileSize: value.fileSize,
    uploadedAt: value.uploadedAt,
    isDemoSample: Boolean(value.demoSeedKey),
    category: value.category || null,
    eventDate: value.eventDate || null,
  }
}

export async function listDocuments(req, res) {
  const documents = await Document.find({ ownerId: req.user.id }).select('+demoSeedKey').sort({ uploadedAt: -1 })
  res.json({ documents: documents.map(toApiDocument) })
}

export async function getDocument(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  const document = await Document.findOne({ _id: req.params.id, ownerId: req.user.id }).select('+demoSeedKey')
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ document: toApiDocument(document) })
}

async function streamDocumentFile(document, res, next) {
  try {
    const source = await fetch(createTemporaryFileUrl(document))
    if (!source.ok || !source.body) return res.status(502).json({ error: 'The document is temporarily unavailable.' })
    res.setHeader('Content-Type', document.fileType)
    res.setHeader('Content-Length', String(document.fileSize))
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalFileName)}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    await pipeline(Readable.fromWeb(source.body), res)
  } catch (error) {
    if (!res.headersSent) return next(error)
  }
}

export async function getOwnedDocumentFile(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Document not found.' })
  const document = await Document.findOne({ _id: req.params.id, ownerId: req.user.id })
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  return streamDocumentFile(document, res, next)
}

function reqIsInvalidId(id) {
  return !mongoose.isValidObjectId(id)
}

export async function listSharedPatientDocuments(req, res) {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only signed-in doctors can view shared patient documents.' })
  if (reqIsInvalidId(req.params.patientId)) return res.status(404).json({ error: 'Patient not found.' })
  const grant = await findActivePatientGrant(req.params.patientId, req.user.id)
  if (!grant) return res.status(403).json({ error: 'The patient has not granted you active access to these documents.' })

  const documents = await Document.find({ ownerId: req.params.patientId }).select('+demoSeedKey').sort({ uploadedAt: -1 })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ documents: documents.map(toApiDocument) })
}

export const listDoctorPatientDocuments = listSharedPatientDocuments
export const getDoctorPatientDocument = getSharedPatientDocument
export const getDoctorPatientDocumentFile = getSharedPatientDocumentFile

export async function getSharedPatientDocument(req, res) {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only signed-in doctors can view shared patient documents.' })
  if (reqIsInvalidId(req.params.patientId) || reqIsInvalidId(req.params.documentId)) return res.status(404).json({ error: 'Document not found.' })
  const grant = await findActivePatientGrant(req.params.patientId, req.user.id)
  if (!grant) return res.status(403).json({ error: 'The patient has not granted you active access to these documents.' })

  const document = await Document.findOne({ _id: req.params.documentId, ownerId: req.params.patientId }).select('+demoSeedKey')
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  res.setHeader('Cache-Control', 'private, no-store')
  return res.json({ document: toApiDocument(document) })
}

export async function getSharedPatientDocumentFile(req, res, next) {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Only signed-in doctors can view shared patient documents.' })
  if (reqIsInvalidId(req.params.patientId) || reqIsInvalidId(req.params.documentId)) return res.status(404).json({ error: 'Document not found.' })
  const grant = await findActivePatientGrant(req.params.patientId, req.user.id)
  if (!grant) return res.status(403).json({ error: 'The patient has not granted you active access to these documents.' })

  const document = await Document.findOne({ _id: req.params.documentId, ownerId: req.params.patientId })
  if (!document) return res.status(404).json({ error: 'Document not found.' })

  return streamDocumentFile(document, res, next)
}

export async function uploadNewDocument(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' })

  const category = req.body.category || null
  if (category && !MEDICAL_RECORD_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a valid document category.' })
  const eventDate = parseMedicalDate(req.body.eventDate)
  if (eventDate === undefined) return res.status(400).json({ error: 'Enter a valid medical event date.' })

  const fileType = await validateFileContents(req.file)
  const storedFile = await uploadDocument(req.file.buffer, req.file.originalname)

  try {
    const document = await Document.create({
      ownerId: req.user.id,
      title: getTitle(req.file.originalname),
      originalFileName: req.file.originalname,
      fileUrl: storedFile.secure_url,
      filePublicId: storedFile.public_id,
      fileType,
      fileSize: req.file.size,
      category: req.body.category || null,
      eventDate,
    })
    return res.status(201).json({ document: toApiDocument(document) })
  } catch (error) {
    if (storedFile.public_id) {
      await deleteStoredDocument(storedFile.public_id).catch((cleanupError) => {
        console.error('Could not clean up an uploaded file after a database error:', cleanupError)
      })
    }
    throw error
  }
}

export async function deleteDocument(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  const document = await Document.findOne({ _id: req.params.id, ownerId: req.user.id })
  if (!document) return res.status(404).json({ error: 'Document not found.' })

  await deleteStoredDocument(document.filePublicId)
  await MedicalRecord.updateMany({ ownerId: req.user.id, documentId: document._id }, { $set: { documentId: null } })
  await document.deleteOne()
  return res.json({ message: 'Document deleted.' })
}
