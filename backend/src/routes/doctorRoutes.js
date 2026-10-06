import { Router } from 'express'
import { getDoctorPatientAccess, listDoctorPatients } from '../controllers/accessController.js'
import { getDoctorPatientDocument, getDoctorPatientDocumentFile, listDoctorPatientDocuments } from '../controllers/documentController.js'
import { getSharedPatientHealthIntake } from '../controllers/healthIntakeController.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
router.use(authenticate)
router.get('/patients', listDoctorPatients)
router.get('/patients/:patientId', getDoctorPatientAccess)
router.get('/patients/:patientId/documents', listDoctorPatientDocuments)
router.get('/patients/:patientId/documents/:documentId/file', getDoctorPatientDocumentFile)
router.get('/patients/:patientId/documents/:documentId', getDoctorPatientDocument)
router.get('/patients/:patientId/intake', getSharedPatientHealthIntake)

export default router
