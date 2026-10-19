import { Router } from 'express'
import { getSharedPatientDocument, getSharedPatientDocumentFile, listSharedPatientDocuments } from '../controllers/documentController.js'
import { authenticate } from '../middleware/authenticate.js'
import { demoDoctorPatient } from '../middleware/demoAccess.js'

const router = Router()
router.use(authenticate)
router.get('/:patientId/documents', demoDoctorPatient, listSharedPatientDocuments)
router.get('/:patientId/documents/:documentId/file', demoDoctorPatient, getSharedPatientDocumentFile)
router.get('/:patientId/documents/:documentId', demoDoctorPatient, getSharedPatientDocument)

export default router
