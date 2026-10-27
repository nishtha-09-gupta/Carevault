import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import Document from '../models/Document.js'
import DocumentAnalysis from '../models/DocumentAnalysis.js'
import { createTemporaryFileUrl } from './documentStorage.js'
import { extractDocumentText } from './documentTextExtraction.js'
import { analyzeMedicalText } from './groqMedicalAnalysis.js'

const LEASE_MS = 5 * 60 * 1000
const HEARTBEAT_MS = 60 * 1000
const MAX_ATTEMPTS = 5
const RETRY_DELAYS_MS = [10000, 30000, 120000, 600000]
let running = false
let timer = null
let reconcileAt = 0
const extractionCache = new Map()
const EXTRACTION_CACHE_TTL_MS = 15 * 60 * 1000
const EXTRACTION_CACHE_MAX_ENTRIES = 10

function cacheFingerprint(document) {
  return `${document.filePublicId || ''}:${document.fileSize || ''}:${new Date(document.uploadedAt || 0).getTime()}`
}

function getCachedText(document) {
  const id = String(document._id)
  const entry = extractionCache.get(id)
  if (!entry) return null
  if (entry.expiresAt <= Date.now() || entry.fingerprint !== cacheFingerprint(document)) {
    extractionCache.delete(id)
    return null
  }
  extractionCache.delete(id)
  extractionCache.set(id, entry)
  return entry.text
}

function cacheText(document, text) {
  const id = String(document._id)
  extractionCache.delete(id)
  extractionCache.set(id, { fingerprint: cacheFingerprint(document), text, expiresAt: Date.now() + EXTRACTION_CACHE_TTL_MS })
  while (extractionCache.size > EXTRACTION_CACHE_MAX_ENTRIES) extractionCache.delete(extractionCache.keys().next().value)
}

export async function enqueueDocumentAnalysis(document) {
  if (document.fileType === 'application/pdf' || document.fileType === 'image/jpeg' || document.fileType === 'image/png') {
    await DocumentAnalysis.updateOne({ documentId: document._id }, {
      $setOnInsert: { documentId: document._id, ownerId: document.ownerId, status: 'pending', nextAttemptAt: new Date() },
    }, { upsert: true })
    await Document.updateOne({ _id: document._id, ownerId: document.ownerId }, { $set: { analysisStatus: 'pending' } })
  }
}

export async function requestDocumentAnalysis(document, { reanalyze = false, existing: knownAnalysis } = {}) {
  const supported = ['application/pdf', 'image/jpeg', 'image/png'].includes(document.fileType)
  if (!supported) throw Object.assign(new Error('Choose a PDF, JPG, or PNG report to analyze.'), { code: 'UNSUPPORTED_DOCUMENT_TYPE', retryable: false })
  const existing = knownAnalysis === undefined ? await DocumentAnalysis.findOne({ documentId: document._id, ownerId: document.ownerId }) : knownAnalysis
  if (!existing) {
    try {
      await DocumentAnalysis.updateOne({ documentId: document._id }, {
        $setOnInsert: { documentId: document._id, ownerId: document.ownerId, status: 'pending', nextAttemptAt: new Date() },
      }, { upsert: true })
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
  } else if (reanalyze && !existing.confirmedAt) {
    await DocumentAnalysis.updateOne({ _id: existing._id, ownerId: document.ownerId, confirmedAt: null }, {
      $set: { status: 'pending', result: null, reviewedResult: null, attempts: 0, lastErrorCode: null, nextAttemptAt: new Date(), leaseUntil: null, leaseToken: null },
    })
  }
  await Document.updateOne({ _id: document._id, ownerId: document.ownerId }, { $set: { analysisStatus: 'pending' } })
  return DocumentAnalysis.findOne({ documentId: document._id, ownerId: document.ownerId })
}

function failureCode(error) {
  if (error?.code && /^[A-Z0-9_]{2,64}$/.test(error.code)) return error.code
  const status = Number(error?.status || error?.statusCode)
  if (status === 429) return 'GROQ_RATE_LIMITED'
  if (status === 408 || status === 504 || error?.name === 'AbortError') return 'GROQ_TIMEOUT'
  if (status === 404) return 'GROQ_MODEL_UNAVAILABLE'
  if (status >= 500) return 'GROQ_TEMPORARY_FAILURE'
  if (error instanceof TypeError) return 'EXTRACTION_TEMPORARY_FAILURE'
  return 'ANALYSIS_FAILED'
}

function retryable(error) {
  const status = Number(error?.status || error?.statusCode)
  return error?.retryable === true || status === 408 || status === 429 || status >= 500 || error instanceof TypeError || ['APIConnectionError', 'APIConnectionTimeoutError'].includes(error?.name)
}

export function retryDisposition(error, attempts) {
  const retry = retryable(error) && attempts < MAX_ATTEMPTS
  return { status: retry ? 'pending' : 'failed', retryAt: retry ? new Date(Date.now() + RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)]) : null }
}

export function workerFailureState(error, attempts) {
  const retryPlan = retryDisposition(error, attempts)
  return {
    status: retryPlan.status,
    lastErrorCode: failureCode(error),
    ...(retryPlan.status === 'pending' ? { nextAttemptAt: retryPlan.retryAt } : {}),
  }
}

export function claimableAnalysisQuery(now = new Date(), scope = {}) {
  return {
    ...scope,
    nextAttemptAt: { $lte: now },
    $or: [{ status: 'pending' }, { status: 'processing', leaseUntil: { $lte: now } }],
  }
}

async function processClaim(job) {
  const document = await Document.findOne({ _id: job.documentId, ownerId: job.ownerId })
  if (!document) {
    extractionCache.delete(String(job.documentId))
    await DocumentAnalysis.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { status: 'failed', lastErrorCode: 'DOCUMENT_UNAVAILABLE', leaseUntil: null, leaseToken: null } })
    return
  }
  const heartbeat = setInterval(() => {
    DocumentAnalysis.updateOne({ _id: job._id, leaseToken: job.leaseToken, status: 'processing' }, { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } }).catch(() => {})
  }, HEARTBEAT_MS)
  heartbeat.unref()
  const startedAt = performance.now()
  const timing = { downloadMs: 0, extractionMs: 0, extractionMode: 'cached-text', ocrPages: 0, groqRequestMs: 0, schemaValidationMs: 0, promptTokens: null, completionTokens: null, resultPersistenceMs: 0, cachedText: false }
  try {
    let text = getCachedText(document)
    if (text) timing.cachedText = true
    else {
      const downloadStartedAt = performance.now()
      let bytes
      try {
        const response = await fetch(createTemporaryFileUrl(document), { signal: AbortSignal.timeout(60000) })
        if (!response.ok) throw Object.assign(new Error('Stored file temporarily unavailable.'), { code: 'STORAGE_TEMPORARY_FAILURE', retryable: response.status >= 500 })
        bytes = Buffer.from(await response.arrayBuffer())
      } finally {
        timing.downloadMs = performance.now() - downloadStartedAt
      }
      const extractionStartedAt = performance.now()
      text = await extractDocumentText(bytes, document.fileType, { onMetrics: (metrics) => { timing.extractionMode = metrics.mode; timing.ocrPages = metrics.ocrPages } })
      timing.extractionMs = performance.now() - extractionStartedAt
      cacheText(document, text)
    }
    if (!text.trim()) throw Object.assign(new Error('No readable text found.'), { code: 'NO_READABLE_TEXT', retryable: false })
    const result = await analyzeMedicalText(text, { onMetrics: (metrics) => {
      timing.groqRequestMs = metrics.requestMs
      timing.schemaValidationMs = metrics.schemaValidationMs
      timing.promptTokens = metrics.promptTokens
      timing.completionTokens = metrics.completionTokens
    } })
    const persistenceStartedAt = performance.now()
    const saved = await DocumentAnalysis.updateOne({ _id: job._id, leaseToken: job.leaseToken, status: 'processing' }, {
      $set: { status: 'completed', result, attempts: job.attempts, leaseUntil: null, leaseToken: null, lastErrorCode: null },
    })
    if (saved.modifiedCount === 1) await Document.updateOne({ _id: document._id, ownerId: job.ownerId }, { $set: { analysisStatus: 'completed' } })
    timing.resultPersistenceMs = performance.now() - persistenceStartedAt
    extractionCache.delete(String(document._id))
  } finally {
    clearInterval(heartbeat)
    // Durations and counts only; never include report text, URLs, or user identifiers.
    console.info('[document-analysis-timing]', JSON.stringify({ ...timing, totalMs: performance.now() - startedAt }))
  }
}

async function runOne(scope = {}) {
  const now = new Date()
  const job = await DocumentAnalysis.findOneAndUpdate(claimableAnalysisQuery(now, scope), {
    $set: { status: 'processing', leaseUntil: new Date(now.getTime() + LEASE_MS), leaseToken: randomUUID() },
    $inc: { attempts: 1 },
  }, { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } }).select('+leaseToken')
  if (!job) return false
  await Document.updateOne({ _id: job.documentId, ownerId: job.ownerId }, { $set: { analysisStatus: 'processing' } })
  try {
    await processClaim(job)
  } catch (error) {
    const failure = workerFailureState(error, job.attempts)
    const status = failure.status
    if (status === 'failed') extractionCache.delete(String(job.documentId))
    const saved = await DocumentAnalysis.updateOne({ _id: job._id, leaseToken: job.leaseToken }, {
      $set: { ...failure, leaseUntil: null, leaseToken: null },
    })
    if (saved.modifiedCount === 1) await Document.updateOne({ _id: job.documentId, ownerId: job.ownerId }, { $set: { analysisStatus: status } })
    // Only emit a fixed code. Error messages can contain request or report data.
    console.error('Document analysis job failed:', failure.lastErrorCode)
  }
  return true
}

export function kickDocumentAnalysis(documentId, ownerId) {
  setImmediate(() => {
    runOne({ documentId, ownerId }).catch(() => {
      // The persisted queue and worker recovery will retry if an immediate kick fails.
      console.error('Document analysis could not be started immediately.')
    })
  })
}

async function recoverPendingUploads() {
  const pending = await Document.aggregate([
    { $match: { analysisStatus: 'pending' } },
    { $lookup: { from: DocumentAnalysis.collection.name, localField: '_id', foreignField: 'documentId', as: 'jobs' } },
    { $match: { $expr: { $eq: [{ $size: '$jobs' }, 0] } } },
    { $project: { _id: 1, ownerId: 1 } },
    { $limit: 100 },
  ])
  for (const document of pending) {
    await DocumentAnalysis.updateOne({ documentId: document._id }, {
      $setOnInsert: { documentId: document._id, ownerId: document.ownerId, status: 'pending', nextAttemptAt: new Date() },
    }, { upsert: true })
  }
}

async function tick() {
  if (!running) return
  try {
    if (Date.now() >= reconcileAt) {
      await recoverPendingUploads()
      reconcileAt = Date.now() + 30000
    }
    const processed = await runOne()
    timer = setTimeout(tick, processed ? 25 : 5000)
  } catch {
    console.error('Document analysis worker could not poll MongoDB.')
    timer = setTimeout(tick, 10000)
  }
}

export function startDocumentAnalysisWorker() {
  if (running) return
  running = true
  timer = setTimeout(tick, 0)
}

export function stopDocumentAnalysisWorker() {
  running = false
  if (timer) clearTimeout(timer)
}

export const analysisRetryPolicy = { maxAttempts: MAX_ATTEMPTS, delaysMs: RETRY_DELAYS_MS }
