import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createWorker } from 'tesseract.js'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function pageLimit(value, fallback, maximum) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : fallback
}

const MAX_PDF_PAGES = pageLimit(process.env.DOCUMENT_MAX_PDF_PAGES, 100, 100)
const MAX_SCANNED_PDF_PAGES = pageLimit(process.env.DOCUMENT_OCR_MAX_PAGES, Math.min(8, MAX_PDF_PAGES), MAX_PDF_PAGES)
const MAX_TEXT_CHARS = pageLimit(process.env.DOCUMENT_MAX_TEXT_CHARS, 500000, 2000000)

function tidy(text) {
  const cleaned = text.replace(/[\t\r]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length > MAX_TEXT_CHARS) throw Object.assign(new Error('Document text exceeds the supported analysis size.'), { code: 'DOCUMENT_TEXT_TOO_LONG', retryable: false })
  return cleaned
}

async function ocrImage(worker, image) {
  const result = await worker.recognize(image)
  return result.data.text || ''
}

function meaningfulCharacterCount(text) {
  return text.replace(/[^\p{L}\p{N}]/gu, '').length
}

function pageTextFromItems(items) {
  const rows = new Map()
  const unpositioned = []
  for (const item of items) {
    const value = item.str || ''
    if (!value) continue
    const transform = item.transform
    if (!Array.isArray(transform) || !Number.isFinite(transform[4]) || !Number.isFinite(transform[5])) {
      unpositioned.push(value)
      continue
    }
    const y = Math.round(transform[5] * 2) / 2
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push({ x: transform[4], value })
  }
  const positioned = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map((cell) => cell.value).join(' '))
  return [...positioned, unpositioned.join(' ')].filter(Boolean).join('\n')
}

async function normalizeUploadedImage(buffer) {
  const image = await loadImage(buffer)
  if (!image.width || !image.height || image.width * image.height > 64_000_000) throw Object.assign(new Error('This image is too large to process safely.'), { code: 'DOCUMENT_EXTRACTION_FAILED', retryable: false })
  const scale = Math.min(1, 2200 / Math.max(image.width, image.height))
  if (scale === 1) return buffer
  const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)))
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.encode('png')
}

function rasterImageToPng(image) {
  const { width, height, data, kind } = image || {}
  if (!Number.isInteger(width) || !Number.isInteger(height) || !data || width * height > 16_000_000) throw Object.assign(new Error('A scanned page image is too large or could not be decoded safely.'), { code: 'SCANNED_PDF_IMAGE_TOO_LARGE', retryable: false })
  const channels = kind === pdfjs.ImageKind.RGBA_32BPP ? 4 : kind === pdfjs.ImageKind.RGB_24BPP ? 3 : 0
  if (!channels || data.length < width * height * channels) throw Object.assign(new Error('This scanned PDF uses an image format that cannot be OCR processed safely.'), { code: 'SCANNED_PDF_IMAGE_UNSUPPORTED', retryable: false })
  const scale = Math.min(1, 2200 / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = createCanvas(targetWidth, targetHeight)
  const context = canvas.getContext('2d')
  const pixels = context.createImageData(targetWidth, targetHeight)
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const source = (Math.min(height - 1, Math.floor(y / scale)) * width + Math.min(width - 1, Math.floor(x / scale))) * channels
      const target = (y * targetWidth + x) * 4
      pixels.data[target] = data[source]; pixels.data[target + 1] = data[source + 1]; pixels.data[target + 2] = data[source + 2]; pixels.data[target + 3] = channels === 4 ? data[source + 3] : 255
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas.encode('png')
}

async function renderPdfPageToPng(buffer, pageNumber) {
  const directory = await mkdtemp(join(tmpdir(), 'carevault-pdf-render-'))
  const inputPath = join(directory, 'source.pdf')
  const outputPrefix = join(directory, 'page')
  const outputPath = `${outputPrefix}.png`
  try {
    await writeFile(inputPath, buffer, { mode: 0o600 })
    try {
      await execFileAsync(process.env.PDFTOPPM_PATH || 'pdftoppm', [
        '-q', '-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-png', '-scale-to', '2200',
        inputPath, outputPrefix,
      ], { timeout: 30000, maxBuffer: 1024 * 1024 })
    } catch (error) {
      const code = error?.code === 'ENOENT' ? 'PDF_PAGE_RENDERER_UNAVAILABLE' : error?.killed ? 'PDF_PAGE_RENDER_TIMEOUT' : 'PDF_PAGE_RENDER_FAILED'
      throw Object.assign(new Error('This scanned PDF page could not be rendered for OCR.'), { code, retryable: code === 'PDF_PAGE_RENDER_TIMEOUT' })
    }
    const png = await readFile(outputPath)
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    if (png.length > 16 * 1024 * 1024 || !png.subarray(0, 8).equals(signature)) {
      throw Object.assign(new Error('The rendered PDF page exceeds the supported image size.'), { code: 'SCANNED_PDF_IMAGE_TOO_LARGE', retryable: false })
    }
    return png
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export function resolvePdfImageObject(page, id, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Object.assign(new Error('An embedded PDF image was not available for OCR.'), { code: 'SCANNED_PDF_IMAGE_TIMEOUT', retryable: true })), timeoutMs)
    page.objs.get(id, (image) => {
      clearTimeout(timeout)
      resolve(image)
    })
  })
}

async function rasterImagesForPage(page) {
  const operators = await page.getOperatorList()
  const ids = new Set()
  const images = []
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index]
    if (operation === pdfjs.OPS.paintImageXObject || operation === pdfjs.OPS.paintImageXObjectRepeat) ids.add(operators.argsArray[index][0])
    else if (operation === pdfjs.OPS.paintInlineImageXObject) images.push(operators.argsArray[index][0])
  }
  for (const id of ids) {
    const image = await resolvePdfImageObject(page, id)
    if (image) images.push(image)
  }
  return images.filter((image) => image?.width && image?.height)
}

export async function extractDocumentText(buffer, mimeType, { onMetrics = () => {}, createOcrWorker = createWorker, renderScannedPdfPage = renderPdfPageToPng } = {}) {
  let worker
  const getWorker = async () => { worker ||= await createOcrWorker('eng', 1, { logger: () => {} }); return worker }
  try {
    if (mimeType !== 'application/pdf') {
      const normalizedImage = await normalizeUploadedImage(buffer)
      const text = tidy(await ocrImage(await getWorker(), normalizedImage))
      onMetrics({ mode: 'ocr-image', pages: 1, ocrPages: 1 })
      if (!text) throw Object.assign(new Error('No readable text was found in the image.'), { code: 'DOCUMENT_EXTRACTION_FAILED', retryable: false })
      return `[[PAGE 1]]\n${text}`
    }

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true })
    const pdf = await loadingTask.promise
    if (pdf.numPages > MAX_PDF_PAGES) throw Object.assign(new Error('PDF exceeds the supported analysis page count.'), { code: 'DOCUMENT_TOO_MANY_PAGES', retryable: false })
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
    const pages = []
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push({ pageNumber, page, text: pageTextFromItems(content.items) })
    }
    const needsOcr = pages.filter(({ text }) => meaningfulCharacterCount(text) < 40)
    if (needsOcr.length > MAX_SCANNED_PDF_PAGES) {
      throw Object.assign(new Error(`This PDF has ${needsOcr.length} pages that need OCR. Split it into files with no more than ${MAX_SCANNED_PDF_PAGES} scanned pages, then retry.`), { code: 'SCANNED_PDF_TOO_MANY_PAGES', retryable: false })
    }
    const output = []
    let ocrRenderedPages = 0
    for (const { pageNumber, page, text } of pages) {
      let pageText = text
      if (meaningfulCharacterCount(text) < 40) {
        try {
          let images = []
          try {
            images = await rasterImagesForPage(page)
          } catch (error) {
            if (error?.code !== 'SCANNED_PDF_IMAGE_TIMEOUT') throw error
          }
          const pageOcr = []
          try {
            for (const image of images) pageOcr.push(await ocrImage(await getWorker(), await rasterImageToPng(image)))
          } catch (error) {
            if (!['SCANNED_PDF_IMAGE_UNSUPPORTED', 'SCANNED_PDF_IMAGE_TOO_LARGE'].includes(error?.code)) throw error
          }
          pageText = pageOcr.filter(Boolean).join('\n').trim()
          // Some PDFs paint scanned or outlined pages as vector drawing commands,
          // or use embedded fonts whose text map is unusable. Render the complete
          // page so OCR can read its visible contents.
          if (!pageText) {
            pageText = await ocrImage(await getWorker(), await renderScannedPdfPage(buffer, pageNumber))
            ocrRenderedPages += 1
          }
        } catch (error) {
          if (error?.code) throw error
          throw Object.assign(new Error(`Scanned page ${pageNumber} could not be read.`, { cause: error }), { code: 'DOCUMENT_EXTRACTION_FAILED', retryable: false })
        }
      }
      output.push(`[[PAGE ${pageNumber}]]\n${pageText}`)
    }
    const ocrPages = needsOcr.length
    const mode = ocrPages === 0 ? 'digital-pdf' : ocrPages === pageCount ? 'scanned-pdf-ocr' : 'mixed-pdf'
    onMetrics({ mode, pages: pageCount, ocrPages, ocrRenderedPages })
    const extracted = tidy(output.join('\n'))
    if (!extracted.replace(/\[\[PAGE \d+\]\]/g, '').trim()) {
      throw Object.assign(new Error('No readable text was found in the document.'), { code: 'DOCUMENT_EXTRACTION_FAILED', retryable: false })
    }
    return extracted
  } finally {
    if (worker) await worker.terminate()
  }
}
