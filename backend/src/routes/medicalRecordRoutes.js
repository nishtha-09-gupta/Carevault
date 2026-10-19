import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { createMedicalRecord, deleteMedicalRecord, getMyTimeline, listMedicalRecords, updateMedicalRecord } from '../controllers/medicalRecordController.js'
import { requireWritableAccount } from '../middleware/demoAccess.js'

const router = Router()
router.use(authenticate)
router.get('/', listMedicalRecords)
router.post('/', requireWritableAccount, createMedicalRecord)
router.put('/:id', requireWritableAccount, updateMedicalRecord)
router.delete('/:id', requireWritableAccount, deleteMedicalRecord)
router.get('/timeline', getMyTimeline)
export default router
