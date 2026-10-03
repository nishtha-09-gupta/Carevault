import path from 'node:path'
import { fileTypeFromBuffer } from 'file-type'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
const allowed = new Map([
  ['.pdf', 'application/pdf'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
])

export function isAllowedFile(file) {
  const extension = path.extname(file.originalname).toLowerCase()
  const typeMatches = !file.mimetype || file.mimetype === 'application/octet-stream' || allowed.get(extension) === file.mimetype
  return allowed.has(extension) && typeMatches
}

export async function validateFileContents(file) {
  const extension = path.extname(file.originalname).toLowerCase()
  const expectedMime = allowed.get(extension)
  const detected = await fileTypeFromBuffer(file.buffer)

  if (!detected || detected.mime !== expectedMime) {
    const error = new Error('The file contents do not match a supported PDF, JPG, JPEG, or PNG file.')
    error.statusCode = 400
    throw error
  }

  return detected.mime
}

export function getTitle(fileName) {
  return path.basename(fileName, path.extname(fileName)).slice(0, 180) || 'Health document'
}
