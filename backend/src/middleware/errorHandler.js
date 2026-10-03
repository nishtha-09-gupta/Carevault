import multer from 'multer'

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'The file is too large. Maximum size is 10 MB.'
        : error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Upload one file using the “document” field.'
          : error.message
    return res.status(400).json({ error: message })
  }

  if (error.http_code === 403 && error.name === 'UnexpectedResponse') {
    console.error('Cloudinary denied the document upload (HTTP 403).')
    return res.status(503).json({ error: 'Cloudinary denied this upload. Check that the account and API key are allowed to upload files.' })
  }

  console.error(error)
  const status = error.statusCode || 500
  return res.status(status).json({
    error: status === 500 ? 'The server could not complete this request.' : error.message,
  })
}
