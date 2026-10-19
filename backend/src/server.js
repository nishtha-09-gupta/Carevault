import 'dotenv/config'
import app, { assertCorsConfiguration } from './app.js'
import { configureCloudinary } from './config/cloudinary.js'
import { connectDatabase } from './config/database.js'
import AccessGrant from './models/AccessGrant.js'
import { assertSessionSecret } from './services/session.js'
import { seedDemoAccounts } from './services/demoSeed.js'

const port = Number(process.env.PORT) || 4000

function assertProductionServices() {
  if (process.env.NODE_ENV !== 'production') return
  const required = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_FROM',
  ]
  const missing = required.filter((key) => !process.env[key])
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`)
}

try {
  assertCorsConfiguration()
  assertSessionSecret()
  assertProductionServices()
  configureCloudinary()
  await connectDatabase()
  if (process.env.NODE_ENV !== 'production') await seedDemoAccounts()
  await AccessGrant.updateMany({ status: 'active', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } })
  const expiryTimer = setInterval(() => {
    AccessGrant.updateMany({ status: 'active', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } })
      .catch(() => console.error('Could not update expired sharing grants.'))
  }, 60 * 1000)
  expiryTimer.unref()
  app.listen(port, '0.0.0.0', () => console.log('CareVault API listening on port ' + port + '.'))
} catch (error) {
  console.error('CareVault API could not start:', error.message)
  process.exit(1)
}
