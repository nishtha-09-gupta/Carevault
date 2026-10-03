import { Router } from 'express'
import multer from 'multer'
import { deleteDocument, getDocument, listDocuments, uploadNewDocument } from '../controllers/documentController.js'
import { authenticate } from '../middleware/authenticate.js'
import { MAX_FILE_SIZE, isAllowedFile } from '../utils/documentValidation.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    if (!isAllowedFile(file)) {
      const error = new Error('Unsupported file type. Choose a PDF, JPG, JPEG, or PNG file.')
      error.statusCode = 400
      return callback(error)
    }
    return callback(null, true)
  },
})

router.use(authenticate)
router.post('/', upload.single('document'), uploadNewDocument)
router.get('/', listDocuments)
router.get('/:id', getDocument)
router.delete('/:id', deleteDocument)

export default router
