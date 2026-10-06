import { promisify } from 'node:util'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import User from '../models/User.js'
import { clearSessionCookie, createSession, setSessionCookie } from '../services/session.js'
import { isValidPassword, PASSWORD_ERROR } from '../utils/passwordValidation.js'
import { emailIsConfigured, sendPasswordResetCode } from '../services/email.js'
import {
  generateOtp,
  generateResetGrant,
  hashResetSecret,
  resetSecretMatches,
  RESET_GRANT_TTL_MS,
  RESET_OTP_MAX_ATTEMPTS,
  RESET_OTP_TTL_MS,
  RESET_RESEND_COOLDOWN_MS,
  isResetSecretUnexpired,
} from '../services/passwordReset.js'
import { refreshExpiredDemoAccessForLogin } from '../services/demoSeed.js'

const scrypt = promisify(scryptCallback)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_REQUEST_MESSAGE = 'If an account exists for that email, a verification code has been sent.'
const INVALID_RESET_MESSAGE = 'That verification code is invalid or expired. Request a new code and try again.'

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

async function passwordDigest(password, salt) {
  return (await scrypt(password, salt, 64)).toString('hex')
}

export async function register(req, res) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  const role = req.body.role === 'doctor' ? 'doctor' : 'patient'
  if (name.length < 2 || name.length > 120) return res.status(400).json({ error: 'Enter a name between 2 and 120 characters.' })
  if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (email.endsWith('@carevault.invalid')) return res.status(400).json({ error: 'That email address is reserved.' })
  if (!isValidPassword(password)) return res.status(400).json({ error: PASSWORD_ERROR })
  const existing = await User.exists({ email })
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' })
  const passwordSalt = randomBytes(16).toString('hex')
  const passwordHash = await passwordDigest(password, passwordSalt)
  try {
    const user = await User.create({ name, email, role, passwordHash, passwordSalt })
    setSessionCookie(res, createSession(user.id, user.sessionVersion))
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.' })
    throw error
  }
}

export async function login(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!isValidPassword(password)) return res.status(401).json({ error: 'Email or password is incorrect.' })
  const user = await User.findOne({ email }).select('+passwordHash +passwordSalt +sessionVersion')
  if (!user) return res.status(401).json({ error: 'Email or password is incorrect.' })
  const expected = Buffer.from(user.passwordHash, 'hex')
  const supplied = Buffer.from(await passwordDigest(password, user.passwordSalt), 'hex')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(401).json({ error: 'Email or password is incorrect.' })
  await refreshExpiredDemoAccessForLogin(user)
  setSessionCookie(res, createSession(user.id, user.sessionVersion))
  return res.json({ user: publicUser(user) })
}

function normalizedResetEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export async function requestPasswordReset(req, res) {
  const email = normalizedResetEmail(req.body?.email)
  if (!emailPattern.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (!emailIsConfigured()) {
    return res.status(503).json({ error: 'Password reset email is temporarily unavailable. Please try again later.' })
  }

  const user = await User.findOne({ email }).select('+resetOtpSentAt')
  if (!user) return res.json({ message: RESET_REQUEST_MESSAGE })

  const now = new Date()
  const cutoff = new Date(now.getTime() - RESET_RESEND_COOLDOWN_MS)
  const otp = generateOtp()
  const stored = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { resetOtpSentAt: { $exists: false } },
        { resetOtpSentAt: { $lte: cutoff } },
      ],
    },
    {
      $set: {
        resetOtpHash: hashResetSecret(otp),
        resetOtpExpiresAt: new Date(now.getTime() + RESET_OTP_TTL_MS),
        resetOtpSentAt: now,
        resetOtpAttempts: 0,
      },
      $unset: { resetGrantHash: 1, resetGrantExpiresAt: 1 },
    },
    { new: true },
  )
  if (!stored) return res.json({ message: RESET_REQUEST_MESSAGE })

  try {
    await sendPasswordResetCode(user.email, otp)
  } catch {
    if (process.env.NODE_ENV === 'production') console.error('Password reset email delivery failed.')
    await User.updateOne(
      { _id: user._id, resetOtpHash: hashResetSecret(otp) },
      { $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1, resetOtpSentAt: 1, resetOtpAttempts: 1 } },
    )
    return res.json({ message: RESET_REQUEST_MESSAGE })
  }
  return res.json({ message: RESET_REQUEST_MESSAGE })
}

export async function verifyPasswordResetOtp(req, res) {
  const email = normalizedResetEmail(req.body?.email)
  const otp = typeof req.body?.otp === 'string' ? req.body.otp : ''
  if (!emailPattern.test(email) || email.length > 254 || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  }

  const user = await User.findOne({ email }).select('+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts')
  if (!user || !user.resetOtpHash || !isResetSecretUnexpired(user.resetOtpExpiresAt)) {
    return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  }

  const matches = resetSecretMatches(otp, user.resetOtpHash)
  const attemptsAvailable = (user.resetOtpAttempts || 0) < RESET_OTP_MAX_ATTEMPTS
  if (!matches || !attemptsAvailable) {
    const update = { $inc: { resetOtpAttempts: 1 } }
    if ((user.resetOtpAttempts || 0) + 1 >= RESET_OTP_MAX_ATTEMPTS) {
      update.$unset = { resetOtpHash: 1, resetOtpExpiresAt: 1, resetOtpAttempts: 1 }
    }
    await User.updateOne(
      { _id: user._id, resetOtpHash: user.resetOtpHash, resetOtpExpiresAt: { $gt: new Date() } },
      update,
    )
    return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  }

  const grant = generateResetGrant()
  const verified = await User.findOneAndUpdate(
    {
      _id: user._id,
      resetOtpHash: user.resetOtpHash,
      resetOtpExpiresAt: { $gt: new Date() },
      $or: [{ resetOtpAttempts: { $lt: RESET_OTP_MAX_ATTEMPTS } }, { resetOtpAttempts: { $exists: false } }],
    },
    {
      $set: { resetGrantHash: hashResetSecret(grant), resetGrantExpiresAt: new Date(Date.now() + RESET_GRANT_TTL_MS) },
      $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1, resetOtpAttempts: 1 },
    },
    { new: true },
  )
  if (!verified) return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  return res.json({ resetToken: grant })
}

export async function resetPassword(req, res) {
  const email = normalizedResetEmail(req.body?.email)
  const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!isValidPassword(password)) return res.status(400).json({ error: PASSWORD_ERROR })
  if (!emailPattern.test(email) || email.length > 254 || !resetToken) {
    return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  }

  const user = await User.findOne({ email }).select('+resetGrantHash +resetGrantExpiresAt')
  if (!user || !user.resetGrantHash || !isResetSecretUnexpired(user.resetGrantExpiresAt)) {
    return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  }
  if (!resetSecretMatches(resetToken, user.resetGrantHash)) {
    return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  }

  const passwordSalt = randomBytes(16).toString('hex')
  const passwordHash = await passwordDigest(password, passwordSalt)
  const result = await User.updateOne(
    { _id: user._id, resetGrantHash: user.resetGrantHash, resetGrantExpiresAt: { $gt: new Date() } },
    {
      $set: { passwordHash, passwordSalt },
      $inc: { sessionVersion: 1 },
      $unset: {
        resetGrantHash: 1,
        resetGrantExpiresAt: 1,
        resetOtpHash: 1,
        resetOtpExpiresAt: 1,
        resetOtpAttempts: 1,
      },
    },
  )
  if (result.modifiedCount !== 1) return res.status(400).json({ error: INVALID_RESET_MESSAGE })
  return res.json({ message: 'Your password has been reset. You can now log in with your new password.' })
}

export async function logout(req, res) {
  await User.updateOne({ _id: req.user.id }, { $inc: { sessionVersion: 1 } })
  clearSessionCookie(res)
  return res.json({ message: 'You have been logged out.' })
}

export function currentUser(req, res) {
  return res.json({ user: req.user })
}
