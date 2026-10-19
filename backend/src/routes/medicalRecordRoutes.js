import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { createMedicalRecord, deleteMedicalRecord, getMyTimeline, listMedicalRecords, updateMedicalRecord } from '../controllers/medicalRecordController.js'

const router = Router()
router.use(authenticate)
router.get('/', listMedicalRecords)
router.post('/', createMedicalRecord)
router.put('/:id', updateMedicalRecord)
router.delete('/:id', deleteMedicalRecord)
router.get('/timeline', getMyTimeline)
export default router
