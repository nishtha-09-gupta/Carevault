import 'dotenv/config'
import app from './app.js'
import { configureCloudinary } from './config/cloudinary.js'
import { connectDatabase } from './config/database.js'
import { assertSessionSecret } from './services/session.js'

const port = Number(process.env.PORT) || 4000

try {
  assertSessionSecret()
  configureCloudinary()
  await connectDatabase()
  app.listen(port, () => console.log('CareVault API listening on port ' + port + '.'))
} catch (error) {
  console.error('CareVault API could not start:', error.message)
  process.exit(1)
}
