import { Router } from 'express'
import { getSharedPatientDocument, getSharedPatientDocumentFile, listSharedPatientDocuments } from '../controllers/documentController.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
router.use(authenticate)
router.get('/:patientId/documents', listSharedPatientDocuments)
router.get('/:patientId/documents/:documentId/file', getSharedPatientDocumentFile)
router.get('/:patientId/documents/:documentId', getSharedPatientDocument)

export default router
