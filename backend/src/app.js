import express from 'express'
import documentRoutes from './routes/documentRoutes.js'
import authRoutes from './routes/authRoutes.js'
import accessRoutes from './routes/accessRoutes.js'
import patientRoutes from './routes/patientRoutes.js'
import doctorRoutes from './routes/doctorRoutes.js'
import healthIntakeRoutes from './routes/healthIntakeRoutes.js'
import medicalRecordRoutes from './routes/medicalRecordRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

function configuredOrigins() {
  const configured = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || ''
  const origins = configured.split(',').map((origin) => origin.trim()).filter(Boolean)
  return origins.length ? origins : process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']
}

const allowedOrigins = configuredOrigins()
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

export function assertCorsConfiguration() {
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('Set CORS_ORIGINS or FRONTEND_ORIGIN to the deployed frontend origin.')
  }
}

export function createCorsMiddleware(origins = allowedOrigins) {
  return (req, res, next) => {
    const origin = req.get('Origin')
    const requiresOrigin = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    res.vary('Origin')
    if (process.env.NODE_ENV === 'production' && requiresOrigin && !origin) {
      return res.status(403).json({ error: 'A valid frontend origin is required for this request.' })
    }
    if (origin && !origins.includes(origin)) {
      return res.status(403).json({ error: 'This origin is not allowed to access the CareVault API.' })
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    return next()
  }
}

app.use(createCorsMiddleware())

app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/access', accessRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/doctor', doctorRoutes)
app.use('/api/health-intake', healthIntakeRoutes)
app.use('/api/medical-records', medicalRecordRoutes)
app.use('/api/documents', documentRoutes)
app.use((req, res) => res.status(404).json({ error: 'API route not found.' }))
app.use(errorHandler)

export default app
