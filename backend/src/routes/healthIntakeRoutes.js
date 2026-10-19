import { Router } from 'express'
import { getMyHealthIntake, saveMyHealthIntake, updateMyHealthIntake } from '../controllers/healthIntakeController.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireWritableAccount } from '../middleware/demoAccess.js'

const router = Router()
router.use(authenticate)
router.get('/', getMyHealthIntake)
router.post('/', requireWritableAccount, saveMyHealthIntake)
router.put('/:id', requireWritableAccount, updateMyHealthIntake)

export default router
