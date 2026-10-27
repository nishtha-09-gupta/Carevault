import { Router } from 'express'
import { getDoctorPatientAccess, listDoctorPatients } from '../controllers/accessController.js'
import { getDoctorPatientDocument, getDoctorPatientDocumentFile, listDoctorPatientDocuments } from '../controllers/documentController.js'
import { getSharedPatientHealthIntake } from '../controllers/healthIntakeController.js'
import { authenticate } from '../middleware/authenticate.js'
import { getSharedDocumentAnalysis, retrySharedDocumentAnalysis, startSharedDocumentAnalysis } from '../controllers/documentAnalysisController.js'
import { getPatientSummary, generatePatientSummary } from '../controllers/doctorSummaryController.js'

const router = Router()
router.use(authenticate)
router.get('/patients', listDoctorPatients)
router.get('/patients/:patientId', getDoctorPatientAccess)
router.get('/patients/:patientId/documents', listDoctorPatientDocuments)
router.get('/patients/:patientId/documents/:documentId/file', getDoctorPatientDocumentFile)
router.get('/patients/:patientId/documents/:documentId/analysis', getSharedDocumentAnalysis)
router.post('/patients/:patientId/documents/:documentId/analysis', startSharedDocumentAnalysis)
router.post('/patients/:patientId/documents/:documentId/analysis/retry', retrySharedDocumentAnalysis)
router.get('/patients/:patientId/summary', getPatientSummary)
router.post('/patients/:patientId/summary', generatePatientSummary)
router.get('/patients/:patientId/documents/:documentId', getDoctorPatientDocument)
router.get('/patients/:patientId/intake', getSharedPatientHealthIntake)

export default router
