import { Router } from 'express'
import { currentUser, login, logout, register, requestPasswordReset, resetPassword, verifyPasswordResetOtp } from '../controllers/authController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authRateLimit } from '../middleware/authRateLimit.js'

const router = Router()
router.post('/register', authRateLimit, register)
router.post('/login', authRateLimit, login)
router.post('/forgot-password', authRateLimit, requestPasswordReset)
router.post('/verify-reset-otp', authRateLimit, verifyPasswordResetOtp)
router.post('/reset-password', authRateLimit, resetPassword)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, currentUser)
export default router
