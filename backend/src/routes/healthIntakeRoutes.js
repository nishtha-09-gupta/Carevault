import { Router } from 'express'
import { getMyHealthIntake, saveMyHealthIntake, updateMyHealthIntake } from '../controllers/healthIntakeController.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
router.use(authenticate)
router.get('/', getMyHealthIntake)
router.post('/', saveMyHealthIntake)
router.put('/:id', updateMyHealthIntake)

export default router
