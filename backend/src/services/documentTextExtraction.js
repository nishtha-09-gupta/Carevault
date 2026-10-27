import { createCanvas } from '@napi-rs/canvas'
import { createWorker } from 'tesseract.js'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

function pageLimit(value, fallback, maximum) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : fallback
}

const MAX_PDF_PAGES = pageLimit(process.env.DOCUMENT_MAX_PDF_PAGES, 20, 100)
const MAX_SCANNED_PDF_PAGES = pageLimit(process.env.DOCUMENT_OCR_MAX_PAGES, Math.min(8, MAX_PDF_PAGES), MAX_PDF_PAGES)
const MAX_TEXT_CHARS = 50000

function tidy(text) {
  const cleaned = text.replace(/[\t\r]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length > MAX_TEXT_CHARS) throw Object.assign(new Error('Document text exceeds the supported analysis size.'), { code: 'DOCUMENT_TEXT_TOO_LONG', retryable: false })
  return cleaned
}

async function ocrImage(worker, image) {
  const result = await worker.recognize(image)
  return result.data.text || ''
}

function rasterImageToPng(image) {
  const { width, height, data, kind } = image || {}
  if (!Number.isInteger(width) || !Number.isInteger(height) || !data || width * height > 16000000) {
    throw Object.assign(new Error('A scanned page image is too large or could not be decoded safely.'), { code: 'SCANNED_PDF_IMAGE_TOO_LARGE', retryable: false })
  }
  const sourceChannels = kind === pdfjs.ImageKind.RGBA_32BPP ? 4 : kind === pdfjs.ImageKind.RGB_24BPP ? 3 : 0
  if (!sourceChannels || data.length < width * height * sourceChannels) {
    throw Object.assign(new Error('This scanned PDF uses an image format that cannot be OCR processed safely.'), { code: 'SCANNED_PDF_IMAGE_UNSUPPORTED', retryable: false })
  }
  const scale = Math.min(1, 2200 / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const rgba = new Uint8ClampedArray(targetWidth * targetHeight * 4)
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale))
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale))
      const sourceIndex = (sourceY * width + sourceX) * sourceChannels
      const targetIndex = (y * targetWidth + x) * 4
      rgba[targetIndex] = data[sourceIndex]
      rgba[targetIndex + 1] = data[sourceIndex + 1]
      rgba[targetIndex + 2] = data[sourceIndex + 2]
      rgba[targetIndex + 3] = sourceChannels === 4 ? data[sourceIndex + 3] : 255
    }
  }
  const canvas = createCanvas(targetWidth, targetHeight)
  const context = canvas.getContext('2d')
  const pixels = context.createImageData(targetWidth, targetHeight)
  pixels.data.set(rgba)
  context.putImageData(pixels, 0, 0)
  return canvas.encode('png')
}

async function rasterImagesForPage(page) {
  const operators = await page.getOperatorList()
  const ids = new Set()
  const inlineImages = []
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const op = operators.fnArray[index]
    if (op === pdfjs.OPS.paintImageXObject || op === pdfjs.OPS.paintImageXObjectRepeat) ids.add(operators.argsArray[index][0])
    else if (op === pdfjs.OPS.paintInlineImageXObject) inlineImages.push(operators.argsArray[index][0])
  }
  const images = inlineImages.filter((image) => image?.width && image?.height)
  for (const id of ids) {
    const image = await new Promise((resolve) => page.objs.get(id, resolve))
    if (image?.width && image?.height) images.push(image)
  }
  return images
}

export async function extractDocumentText(buffer, mimeType, { onMetrics = () => {} } = {}) {
  let worker
  const getWorker = async () => { worker ||= await createWorker('eng', 1, { logger: () => {} }); return worker }
  try {
    if (mimeType !== 'application/pdf') {
      const text = tidy(await ocrImage(await getWorker(), buffer))
      onMetrics({ mode: 'ocr-image', pages: 1, ocrPages: 1 })
      return text
    }

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true })
    const pdf = await loadingTask.promise
    if (pdf.numPages > MAX_PDF_PAGES) throw Object.assign(new Error('PDF exceeds the supported analysis page count.'), { code: 'DOCUMENT_TOO_MANY_PAGES', retryable: false })
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
    const digital = []
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      digital.push(content.items.map((item) => item.str || '').join(' '))
    }
    const digitalText = tidy(digital.join('\n'))
    const meaningfulCharacters = digitalText.replace(/[^\p{L}\p{N}]/gu, '').length
    if (meaningfulCharacters >= 50) {
      onMetrics({ mode: 'digital-pdf', pages: pageCount, ocrPages: 0 })
      return digitalText
    }

    if (pageCount > MAX_SCANNED_PDF_PAGES) {
      throw Object.assign(new Error(`This scanned PDF has ${pageCount} pages. Split it into files of ${MAX_SCANNED_PDF_PAGES} pages or fewer, then retry.`), { code: 'SCANNED_PDF_TOO_MANY_PAGES', retryable: false })
    }

    const scanned = []
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const images = await rasterImagesForPage(page)
      if (images.length === 0) throw Object.assign(new Error(`Scanned page ${pageNumber} contains no OCR-readable embedded image. Save it as an image or a flattened PDF and retry.`), { code: 'SCANNED_PDF_IMAGE_NOT_FOUND', retryable: false })
      for (const image of images) scanned.push(await ocrImage(await getWorker(), await rasterImageToPng(image)))
    }
    onMetrics({ mode: 'scanned-pdf-ocr', pages: pageCount, ocrPages: pageCount })
    return tidy(scanned.join('\n'))
  } finally {
    if (worker) await worker.terminate()
  }
}
