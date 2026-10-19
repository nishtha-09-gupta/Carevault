import { Router } from 'express'
import { getDoctorPatientAccess, listDoctorPatients } from '../controllers/accessController.js'
import { getDoctorPatientDocument, getDoctorPatientDocumentFile, listDoctorPatientDocuments } from '../controllers/documentController.js'
import { getSharedPatientHealthIntake } from '../controllers/healthIntakeController.js'
import { authenticate } from '../middleware/authenticate.js'
import { demoDoctorPatient } from '../middleware/demoAccess.js'

const router = Router()
router.use(authenticate)
router.get('/patients', listDoctorPatients)
router.get('/patients/:patientId', demoDoctorPatient, getDoctorPatientAccess)
router.get('/patients/:patientId/documents', demoDoctorPatient, listDoctorPatientDocuments)
router.get('/patients/:patientId/documents/:documentId/file', demoDoctorPatient, getDoctorPatientDocumentFile)
router.get('/patients/:patientId/documents/:documentId', demoDoctorPatient, getDoctorPatientDocument)
router.get('/patients/:patientId/intake', demoDoctorPatient, getSharedPatientHealthIntake)

export default router
