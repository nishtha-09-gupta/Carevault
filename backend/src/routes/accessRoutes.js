import { Router } from 'express'
import { grantAccess, listAccess, revokeAccess, searchDoctors } from '../controllers/accessController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authRateLimit } from '../middleware/authRateLimit.js'

const router = Router()
router.use(authenticate)
router.get('/doctors', searchDoctors)
router.get('/', listAccess)
router.post('/', authRateLimit, grantAccess)
router.delete('/:id', authRateLimit, revokeAccess)

export default router
