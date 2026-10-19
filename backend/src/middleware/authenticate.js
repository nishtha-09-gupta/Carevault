import { verifySession } from '../services/session.js'
import { isDemoAccountEmail } from '../services/demoSeed.js'
import User from '../models/User.js'

export async function authenticate(req, res, next) {
  // Authenticated patient data must not be restored from a browser or proxy
  // cache after logout or an account switch.
  res.setHeader('Cache-Control', 'private, no-store')
  let payload
  try {
    const token = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('carevault_session='))?.slice('carevault_session='.length)
    if (!token) return res.status(401).json({ error: 'Please log in to continue.' })
    payload = verifySession(decodeURIComponent(token))
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message })
    return res.status(401).json({ error: 'Your session is invalid. Please log in again.' })
  }
  try {
    const user = await User.findById(payload.sub).select('_id name email role demoRole demoPartnerId +sessionVersion')
    if (!user) return res.status(401).json({ error: 'Your session is no longer valid. Please log in again.' })
    if (isDemoAccountEmail(user.email)) {
      return res.status(401).json({ error: 'This demo account is not available in production.' })
    }
    if (user.demoRole && !['patient', 'doctor'].includes(user.demoRole)) return res.status(401).json({ error: 'Your session is no longer valid.' })
    if (user.demoRole === 'doctor' && !user.demoPartnerId) return res.status(401).json({ error: 'Your session is no longer valid.' })
    if ((payload.ver || 0) !== user.sessionVersion) return res.status(401).json({ error: 'Your session has ended. Please log in again.' })
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role, isDemo: Boolean(user.demoRole), demoRole: user.demoRole || null, demoPartnerId: user.demoPartnerId ? String(user.demoPartnerId) : null, sessionVersion: user.sessionVersion }
    return next()
  } catch (error) {
    return next(error)
  }
}
