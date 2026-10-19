import { Router } from 'express'
import { grantAccess, listAccess, revokeAccess, searchDoctors } from '../controllers/accessController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authRateLimit } from '../middleware/authRateLimit.js'
import { requireWritableAccount } from '../middleware/demoAccess.js'

const router = Router()
router.use(authenticate)
router.get('/doctors', searchDoctors)
router.get('/', listAccess)
router.post('/', authRateLimit, requireWritableAccount, grantAccess)
router.delete('/:id', authRateLimit, requireWritableAccount, revokeAccess)

export default router
