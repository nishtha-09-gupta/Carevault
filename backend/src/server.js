import 'dotenv/config'
import app from './app.js'
import { configureCloudinary } from './config/cloudinary.js'
import { connectDatabase } from './config/database.js'
import AccessGrant from './models/AccessGrant.js'
import { assertSessionSecret } from './services/session.js'
import { seedDemoAccounts } from './services/demoSeed.js'

const port = Number(process.env.PORT) || 4000

try {
  assertSessionSecret()
  configureCloudinary()
  await connectDatabase()
  await seedDemoAccounts()
  await AccessGrant.updateMany({ status: 'active', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } })
  const expiryTimer = setInterval(() => {
    AccessGrant.updateMany({ status: 'active', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } })
      .catch(() => console.error('Could not update expired sharing grants.'))
  }, 60 * 1000)
  expiryTimer.unref()
  app.listen(port, () => console.log('CareVault API listening on port ' + port + '.'))
} catch (error) {
  console.error('CareVault API could not start:', error.message)
  process.exit(1)
}
