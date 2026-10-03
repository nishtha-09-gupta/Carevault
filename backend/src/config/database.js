import mongoose from 'mongoose'

export async function connectDatabase() {
  const { MONGODB_URI } = process.env
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Add it to backend/.env.')
  }

  const databaseName = process.env.MONGODB_DATABASE || 'carevault'
  await mongoose.connect(MONGODB_URI, { dbName: databaseName })
  console.log(`Connected to MongoDB database "${databaseName}".`)
}
