import mongoose from 'mongoose'
import Document from '../models/Document.js'
import { createTemporaryFileUrl, deleteStoredDocument, uploadDocument } from '../services/documentStorage.js'
import { getTitle, validateFileContents } from '../utils/documentValidation.js'

function toApiDocument(document, includeFileUrl = false) {
  const value = document.toObject()
  return {
    id: value._id,
    title: value.title,
    originalFileName: value.originalFileName,
    ...(includeFileUrl ? { fileUrl: createTemporaryFileUrl(value) } : {}),
    fileType: value.fileType,
    fileSize: value.fileSize,
    uploadedAt: value.uploadedAt,
  }
}

export async function listDocuments(req, res) {
  const documents = await Document.find({ ownerId: req.user.id }).sort({ uploadedAt: -1 })
  res.json({ documents: documents.map(toApiDocument) })
}

export async function getDocument(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  const document = await Document.findOne({ _id: req.params.id, ownerId: req.user.id })
  if (!document) return res.status(404).json({ error: 'Document not found.' })
  return res.json({ document: toApiDocument(document, true) })
}

export async function uploadNewDocument(req, res) {
  if (req.user.isDemo) return res.status(403).json({ error: 'Uploads are disabled in the read-only demo account.' })
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' })

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
  if (req.user.isDemo) return res.status(403).json({ error: 'Changes are disabled in the read-only demo account.' })
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Document not found.' })
  }

  const document = await Document.findOne({ _id: req.params.id, ownerId: req.user.id })
  if (!document) return res.status(404).json({ error: 'Document not found.' })

  await deleteStoredDocument(document.filePublicId)
  await document.deleteOne()
  return res.json({ message: 'Document deleted.' })
}
