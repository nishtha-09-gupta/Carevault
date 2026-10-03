import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import path from 'node:path'
import { cloudinary } from '../config/cloudinary.js'

export function ensureStorageConfigured() {
  const config = cloudinary.config()
  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    const error = new Error('File storage is not configured. Add the Cloudinary values to backend/.env.')
    error.statusCode = 503
    throw error
  }
}

export function uploadDocument(buffer, originalName) {
  ensureStorageConfigured()
  const extension = path.extname(originalName).toLowerCase()
  const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
  const publicId = 'carevault/documents/' + randomUUID() + '-' + (baseName || 'document') + extension

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      (response) => {
        if (response?.error) return reject(response.error)
        if (!response?.secure_url || !response?.public_id) {
          return reject(new Error('Cloudinary returned an incomplete upload result.'))
        }
        return resolve(response)
      },
      {
        resource_type: 'raw',
        type: 'authenticated',
        public_id: publicId,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        disable_promises: true,
      },
    )
    Readable.from(buffer).pipe(upload)
  })
}

export async function deleteStoredDocument(publicId) {
  ensureStorageConfigured()
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
  })
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error('The file could not be deleted from storage.')
  }
}

export function createTemporaryFileUrl(document) {
  ensureStorageConfigured()
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60
  const extension = document.originalFileName.split('.').pop().toLowerCase()
  return cloudinary.utils.private_download_url(document.filePublicId, extension, {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: expiresAt,
    attachment: false,
  })
}
