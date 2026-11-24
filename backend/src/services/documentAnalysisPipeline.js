import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { medicalAnalysisJsonSchema, MedicalAnalysisResult } from './medicalAnalysisSchema.js'
import { analyzeMedicalText, MEDICAL_EXTRACTION_SYSTEM_PROMPT, resolveConfiguredGroqLimits, validateModelConfiguration } from './groqMedicalAnalysis.js'
import { hierarchicalMergeDocumentChunkResults, createMedicalDocumentChunks, splitOversizedChunk } from './medicalDocumentChunking.js'
import { createTokenBudget } from './groqTokenBudget.js'

const CHUNK_MAX_ATTEMPTS = 3
const MAX_INLINE_RETRY_AFTER_MS = 5_000
const TRANSIENT_CODES = new Set(['GROQ_TIMEOUT', 'GROQ_RATE_LIMITED', 'GROQ_TEMPORARY_FAILURE', 'GROQ_CONNECTION_ERROR', 'GROQ_API_ERROR'])

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const safeIssueFields = new Set(['documentType', 'documentTypeEvidence', 'documentTitle', 'documentTitleEvidence', 'category', 'categoryEvidence', 'provider', 'providerEvidence', 'patientInformation', 'reportDate', 'reportDateEvidence', 'findings', 'tests', 'medications', 'sections', 'details', 'text', 'evidence', 'name', 'nameEvidence', 'value', 'valueEvidence', 'unit', 'unitEvidence', 'referenceRange', 'referenceRangeEvidence', 'abnormalFlag', 'abnormalFlagEvidence', 'pageNumber', 'label', 'type', 'title', 'titleEvidence', 'dosage', 'dosageEvidence', 'route', 'routeEvidence', 'frequency', 'frequencyEvidence', 'duration', 'durationEvidence', 'instructions', 'instructionsEvidence'])

function schemaFailure(error) {
  const paths = Array.isArray(error?.issues) ? error.issues.slice(0, 20).map((issue) => issue.path.map((part) => typeof part === 'number' ? part : safeIssueFields.has(part) ? part : '[other]')) : []
  throw Object.assign(new Error('Aggregated document results exceed CareVault’s validated analysis schema.'), { code: 'GROQ_SCHEMA_INVALID', retryable: false, validationIssuePaths: paths })
}

function plain(value) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value
}

function progressFor(states) {
  const chunks = [...states.values()]
  const leaves = chunks.filter((chunk) => chunk.status !== 'split')
  return {
    completed: leaves.filter((chunk) => chunk.status === 'completed').length,
    total: leaves.length,
    failed: leaves.filter((chunk) => chunk.status === 'failed').length,
  }
}

export async function analyzeMedicalDocumentText(sourceText, {
  client,
  env = process.env,
  existingChunks = [],
  onProgress = async () => {},
  onMetrics = () => {},
  sleepFn = sleep,
  concurrency: requestedConcurrency,
  randomFn = Math.random,
  existingSourceTextHash = null,
} = {}) {
  validateModelConfiguration(env)
  const modelLimits = await resolveConfiguredGroqLimits({ client: client || undefined, env })
  const tokenBudget = createTokenBudget({ systemPrompt: MEDICAL_EXTRACTION_SYSTEM_PROMPT, schema: medicalAnalysisJsonSchema, modelLimits, env })
  const overlapTokens = Math.max(0, Number.parseInt(env.GROQ_ANALYSIS_CHUNK_OVERLAP_TOKENS || '120', 10) || 0)
  const baseChunks = createMedicalDocumentChunks(sourceText, { maxTokens: tokenBudget.chunkTokens, overlapTokens })
  if (!baseChunks.length) throw Object.assign(new Error('No readable document text was available to analyze.'), { code: 'DOCUMENT_EXTRACTION_FAILED', retryable: false })
  const sourceTextHash = createHash('sha256').update(sourceText).digest('hex')
  const previous = new Map((existingSourceTextHash === sourceTextHash ? existingChunks : []).map((entry) => [entry.chunkId, plain(entry)]))
  const states = new Map()
  const queue = []
  const maxDepth = 6

  function addTree(chunk) {
    const saved = previous.get(chunk.chunkId)
    const state = {
      chunkId: chunk.chunkId,
      index: states.size,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      estimatedInputTokens: chunk.estimatedInputTokens,
      depth: chunk.depth || 0,
      parentChunkId: chunk.parentChunkId || null,
      status: saved?.status || 'pending',
      attempts: saved?.attempts || 0,
      lastErrorCode: saved?.lastErrorCode || null,
      retryAt: saved?.retryAt || null,
      result: saved?.status === 'completed' ? saved.result : null,
    }
    states.set(state.chunkId, state)
    if (state.status === 'split') {
      const children = splitOversizedChunk(chunk, { overlapTokens })
      if (children.length) children.forEach((child) => addTree({ ...child, parentChunkId: chunk.chunkId }))
      else { state.status = 'pending'; queue.push(chunk) }
    } else if (state.status !== 'completed') queue.push(chunk)
  }
  baseChunks.forEach(addTree)

  const persist = async () => onProgress({
    sourceTextHash,
    chunks: [...states.values()].map((state) => ({ ...state, result: state.result })),
    progress: progressFor(states),
  })
  await persist()

  const chunkMetrics = []
  const concurrency = Math.max(1, Math.min(3, Number(requestedConcurrency || env.GROQ_ANALYSIS_CONCURRENCY || 1) || 1))
  async function runChunk(chunk) {
    let state = states.get(chunk.chunkId)
    if (!state) {
      state = { chunkId: chunk.chunkId, index: states.size, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd, estimatedInputTokens: chunk.estimatedInputTokens, depth: chunk.depth || 0, parentChunkId: chunk.parentChunkId || null, status: 'pending', attempts: 0, lastErrorCode: null, result: null }
      states.set(state.chunkId, state)
    }
    if (state.status === 'completed') return
    if (state.status === 'failed' && state.retryAt && new Date(state.retryAt).getTime() > Date.now()) return
    state.status = 'processing'
    state.lastErrorCode = null
    state.retryAt = null
    await persist()
    let lastError
    for (let attempt = 1; attempt <= CHUNK_MAX_ATTEMPTS; attempt += 1) {
      state.attempts += 1
      const startedAt = performance.now()
      let requestMetrics = {}
      const emitChunkMetrics = (chunkStatus) => {
        const metric = { index: state.index, pageStart: state.pageStart, pageEnd: state.pageEnd, estimatedInputTokens: state.estimatedInputTokens, ...requestMetrics, chunkMs: performance.now() - startedAt, chunkStatus }
        chunkMetrics.push(metric)
        onMetrics(metric)
      }
      try {
        const result = await analyzeMedicalText(chunk.text, { client, env, modelLimits, tokenBudget, onMetrics: (metrics) => {
          requestMetrics = metrics
        } })
        emitChunkMetrics('completed')
        state.status = 'completed'
        state.result = result
        state.lastErrorCode = null
        await persist()
        return
      } catch (error) {
        emitChunkMetrics('failed')
        lastError = error
        const canSplit = ['GROQ_INPUT_TOO_LARGE', 'GROQ_RESPONSE_TRUNCATED'].includes(error?.code) && chunk.depth < maxDepth
        const children = canSplit ? splitOversizedChunk(chunk, { overlapTokens }) : []
        if (children.length) {
          state.status = 'split'
          state.lastErrorCode = error.code
          const indexedChildren = children.map((child) => ({ ...child, parentChunkId: chunk.chunkId }))
          indexedChildren.forEach((child) => {
            states.set(child.chunkId, { chunkId: child.chunkId, index: states.size, pageStart: child.pageStart, pageEnd: child.pageEnd, estimatedInputTokens: child.estimatedInputTokens, depth: child.depth, parentChunkId: chunk.chunkId, status: 'pending', attempts: 0, lastErrorCode: null, result: null })
          })
          await persist()
          queue.unshift(...indexedChildren)
          return
        }
        const providerDelay = Math.max(0, Number(error?.retryAfterMs) || 0)
        if (TRANSIENT_CODES.has(error?.code) && error?.code !== 'GROQ_RATE_LIMITED' && attempt < CHUNK_MAX_ATTEMPTS && providerDelay <= MAX_INLINE_RETRY_AFTER_MS) {
          const exponential = Math.min(15_000, 500 * (2 ** (attempt - 1)))
          const jittered = Math.floor(exponential * (0.75 + Math.max(0, Math.min(1, randomFn())) * 0.5))
          await sleepFn(Math.max(jittered, providerDelay))
          continue
        }
        state.status = 'failed'
        state.lastErrorCode = error?.code || 'ANALYSIS_FAILED'
        state.retryAfterMs = error?.retryAfterMs || null
        state.retryAt = state.retryAfterMs ? new Date(Date.now() + state.retryAfterMs) : null
        state.result = null
        onMetrics({ chunkMs: performance.now() - startedAt, chunkStatus: 'failed', estimatedInputTokens: chunk.estimatedInputTokens })
        await persist()
        return
      }
    }
    state.status = 'failed'
    state.lastErrorCode = lastError?.code || 'ANALYSIS_FAILED'
    await persist()
  }

  async function worker() {
    while (queue.length) {
      const chunk = queue.shift()
      await runChunk(chunk)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  const progress = progressFor(states)
  const failed = [...states.values()].filter((state) => state.status === 'failed')
  onMetrics({
    pageCount: new Set(baseChunks.map((chunk) => chunk.pageStart)).size,
    chunkCount: progress.total,
    successfulChunks: progress.completed,
    failedChunks: progress.failed,
    estimatedInputTokens: [...states.values()].filter((state) => state.status !== 'split').map((state) => state.estimatedInputTokens),
  })
  if (failed.length) {
    const retryable = failed.some((chunk) => TRANSIENT_CODES.has(chunk.lastErrorCode))
    const retryAfterMs = Math.max(0, ...failed.map((chunk) => chunk.retryAt ? new Date(chunk.retryAt).getTime() - Date.now() : Number(chunk.retryAfterMs) || 0)) || null
    throw Object.assign(new Error('One or more document sections could not be analyzed.'), { code: 'GROQ_CHUNK_FAILED', retryable, retryAfterMs, failedChunkCount: failed.length, chunks: [...states.values()], progress, sourceTextHash })
  }
  const aggregated = hierarchicalMergeDocumentChunkResults([...states.values()].filter((state) => state.status === 'completed').map((state) => state.result))
  // Strict aggregate validation prevents MongoDB persistence from silently
  // dropping fields. No aggregate prompt is sent, so aggregation cannot exceed
  // the model context window or invent facts.
  let result
  try { result = MedicalAnalysisResult.parse(aggregated) } catch (error) { schemaFailure(error) }
  return { result, sourceTextHash, chunks: [...states.values()], progress, chunkMetrics }
}
