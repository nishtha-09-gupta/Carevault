import express from 'express'
import documentRoutes from './routes/documentRoutes.js'
import authRoutes from './routes/authRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use((req, res) => res.status(404).json({ error: 'API route not found.' }))
app.use(errorHandler)

export default app
