import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Writable } from 'node:stream'
import { cloudinary } from '../src/config/cloudinary.js'
import { uploadDocument } from '../src/services/documentStorage.js'

test('uploads the full Buffer to Cloudinary using its options-first callback API', async () => {
  cloudinary.config({ cloud_name: 'test-cloud', api_key: 'test-key', api_secret: 'test-secret' })
  const originalUploadStream = cloudinary.uploader.upload_stream
  const fileContents = Buffer.from('%PDF-1.7 binary file contents')
  let receivedOptions
  const receivedChunks = []

  cloudinary.uploader.upload_stream = (options, callback) => {
    receivedOptions = options
    return new Writable({
      write(chunk, encoding, done) {
        receivedChunks.push(Buffer.from(chunk))
        done()
      },
      final(done) {
        callback(null, { secure_url: 'https://cloudinary.test/file', public_id: options.public_id })
        done()
      },
    })
  }

  try {
    const result = await uploadDocument(fileContents, 'annual-record.pdf')
    assert.equal(Buffer.concat(receivedChunks).equals(fileContents), true)
    assert.equal(receivedOptions.resource_type, 'raw')
    assert.equal(receivedOptions.type, 'authenticated')
    assert.match(receivedOptions.public_id, /^carevault\/documents\/.+-annual-record\.pdf$/)
    assert.equal(result.secure_url, 'https://cloudinary.test/file')
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream
  }
})

test('rejects Cloudinary upload errors without leaking them as successful results', async () => {
  cloudinary.config({ cloud_name: 'test-cloud', api_key: 'test-key', api_secret: 'test-secret' })
  const originalUploadStream = cloudinary.uploader.upload_stream
  cloudinary.uploader.upload_stream = (options, callback) => {
    const stream = new Writable({ write(chunk, encoding, done) { done() } })
    stream.once('finish', () => callback(new Error('Cloudinary unavailable')))
    return stream
  }

  try {
    await assert.rejects(uploadDocument(Buffer.from('file'), 'record.pdf'), /Cloudinary unavailable/)
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream
  }
})
