import assert from 'node:assert/strict'
import { test } from 'node:test'
import Document from '../src/models/Document.js'
import DocumentAnalysis from '../src/models/DocumentAnalysis.js'
import MedicalRecord from '../src/models/MedicalRecord.js'
import AccessGrant from '../src/models/AccessGrant.js'
import { MedicalAnalysisResult, medicalAnalysisJsonSchema, validateGroundedAnalysis } from '../src/services/medicalAnalysisSchema.js'
import { analyzeMedicalText, classifyGroqRequestError, retryAfterMilliseconds, validateModelConfiguration } from '../src/services/groqMedicalAnalysis.js'
import { clearModelTokenLimitsCache } from '../src/services/groqTokenBudget.js'
import { analysisRetryPolicy, categorizePipelineFailure, claimableAnalysisQuery, enqueueDocumentAnalysis, retryDisposition, workerFailureState } from '../src/services/documentAnalysisQueue.js'
import { getOwnedDocumentAnalysis, getSharedDocumentAnalysis, reviewDocumentAnalysis, confirmDocumentAnalysis, startDocumentAnalysis } from '../src/controllers/documentAnalysisController.js'
import { extractDocumentText, resolvePdfImageObject } from '../src/services/documentTextExtraction.js'

const source = 'CBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal\nReport date: 2026-10-12'
const result = {
  reportDate: '2026-10-12', reportDateEvidence: 'Report date: 2026-10-12',
  findings: [{ text: 'CBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal', evidence: 'CBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal' }],
  tests: [{ name: 'Hemoglobin', nameEvidence: 'Hemoglobin', value: '13.2', valueEvidence: 'Hemoglobin 13.2', unit: 'g/dL', unitEvidence: '13.2 g/dL', referenceRange: '12.0-16.0', referenceRangeEvidence: '(12.0-16.0)', abnormalFlag: 'normal', abnormalFlagEvidence: 'Normal' }],
}

function vectorOnlyPdfWithShortText() {
  const content = 'BT /F1 12 Tf 40 750 Td (CBC) Tj ET\n40 700 120 20 re S'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xref = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'ascii')
}

test('digital PDF extraction reads synthetic fixture text without OCR', async () => {
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(new URL('../demo-documents/cbc_blood_test_2026-10-04.pdf', import.meta.url))
  let extractionMode
  const text = await extractDocumentText(bytes, 'application/pdf', { onMetrics: (metrics) => { extractionMode = metrics.mode } })
  assert.ok(text.length > 100)
  assert.equal(extractionMode, 'digital-pdf')
})

test('mixed digital and scanned PDF extracts digital text and OCRs only the scanned page', async () => {
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(new URL('./fixtures/scanned-medical-report.pdf', import.meta.url))
  let metrics
  const text = await extractDocumentText(bytes, 'application/pdf', {
    onMetrics: (value) => { metrics = value },
    createOcrWorker: async () => ({ recognize: async () => ({ data: { text: 'SYNTHETIC OCR: Appearance: clear' } }), terminate: async () => {} }),
  })
  assert.equal(metrics.mode, 'mixed-pdf')
  assert.equal(metrics.ocrPages, 1)
  assert.match(text, /Hemoglobin 13\.4 g\/dL/)
  assert.match(text, /Appearance: clear/i)
  assert.match(text, /\[\[PAGE 2\]\]/)
})

test('vector-drawn PDF page without an embedded image is rendered for OCR', async () => {
  let recognizedPng = false
  let metrics
  const text = await extractDocumentText(vectorOnlyPdfWithShortText(), 'application/pdf', {
    onMetrics: (value) => { metrics = value },
    renderScannedPdfPage: async () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createOcrWorker: async () => ({
      recognize: async (image) => {
        recognizedPng = Buffer.from(image).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        return { data: { text: 'SYNTHETIC OCR: CBC report page' } }
      },
      terminate: async () => {},
    }),
  })
  assert.equal(recognizedPng, true)
  assert.equal(metrics.mode, 'scanned-pdf-ocr')
  assert.equal(metrics.ocrRenderedPages, 1)
  assert.match(text, /\[\[PAGE 1\]\]/)
  assert.match(text, /SYNTHETIC OCR: CBC report page/)
})

test('an unresolved PDF image callback times out so the extractor can render the page instead', async () => {
  await assert.rejects(
    resolvePdfImageObject({ objs: { get: () => {} } }, 'missing-image', 5),
    (error) => error.code === 'SCANNED_PDF_IMAGE_TIMEOUT' && error.retryable === true,
  )
  const image = { width: 1, height: 1 }
  assert.equal(await resolvePdfImageObject({ objs: { get: (_id, callback) => callback(image) } }, 'ready-image', 100), image)
})

test('synthetic PNG medical page uses OCR and keeps a source page marker', async () => {
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(new URL('./fixtures/scanned-medical-report-page.png', import.meta.url))
  let metrics
  const text = await extractDocumentText(bytes, 'image/png', {
    onMetrics: (value) => { metrics = value },
    createOcrWorker: async () => ({ recognize: async () => ({ data: { text: 'SYNTHETIC OCR: Appearance: clear' } }), terminate: async () => {} }),
  })
  assert.equal(metrics.mode, 'ocr-image')
  assert.match(text, /\[\[PAGE 1\]\]/)
  assert.match(text, /Appearance: clear/)
})

test('document analysis data is strictly schema validated and unsupported claims become null', () => {
  const grounded = validateGroundedAnalysis(result, source)
  assert.equal(grounded.tests[0].value, '13.2')
  const ungrounded = validateGroundedAnalysis({ ...result, tests: [{ ...result.tests[0], value: '99', valueEvidence: 'Hemoglobin 13.2' }] }, source)
  assert.equal(ungrounded.tests[0].value, null)
  const inventedFlag = validateGroundedAnalysis({ ...result, tests: [{ ...result.tests[0], abnormalFlag: 'high', abnormalFlagEvidence: 'Normal' }] }, source)
  assert.equal(inventedFlag.tests[0].abnormalFlag, null)
  assert.throws(() => validateGroundedAnalysis({ ...result, extra: 'not allowed' }, source))
  const unsupportedDate = validateGroundedAnalysis({ ...result, reportDate: '2026-02-31' }, source)
  assert.equal(unsupportedDate.reportDate, null)
  const optional = validateGroundedAnalysis({ reportDate: null, tests: [{ name: 'Novel marker', nameEvidence: 'Novel marker' }] }, 'Novel marker')
  assert.equal(optional.tests[0].value, null)
  assert.deepEqual(optional.findings, [])
  const wrongPage = validateGroundedAnalysis({ ...result, tests: [{ ...result.tests[0], pageNumber: 2 }] }, '[[PAGE 1]]\n' + source)
  assert.equal(wrongPage.tests[0].pageNumber, null)
  const classified = validateGroundedAnalysis({ ...result, documentType: 'Complete blood count', documentTypeEvidence: 'CBC' }, '[[PAGE 1]]\nCBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal')
  assert.equal(classified.documentType, 'Complete blood count')
  const unsupportedClassification = validateGroundedAnalysis({ ...result, documentType: 'MRI', documentTypeEvidence: 'CT scan' }, '[[PAGE 1]]\nCBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal')
  assert.equal(unsupportedClassification.documentType, null)
  assert.equal(unsupportedClassification.documentTypeEvidence, null)
})

test('Groq integration verifies model limits and uses a token-budgeted strict-schema completion', async () => {
  const env = { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-20b' }
  clearModelTokenLimitsCache()
  let request
  let modelListCalls = 0
  const client = {
    models: { list: async () => { modelListCalls += 1; return { data: [{ id: env.GROQ_MODEL, context_window: 131072, max_completion_tokens: 65536 }] } } },
    chat: { completions: { create: async (body) => { request = body; return { choices: [{ message: { content: JSON.stringify(result) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } } } } },
  }
  let metrics
  const parsed = await analyzeMedicalText(source, { client, env, onMetrics: (value) => { metrics = value } })
  assert.equal(parsed.tests[0].value, '13.2')
  assert.equal(request.response_format.type, 'json_schema')
  assert.equal(request.response_format.json_schema.strict, true)
  assert.deepEqual(request.response_format.json_schema.schema, medicalAnalysisJsonSchema)
  assert.equal(modelListCalls, 1)
  assert.equal(request.messages[1].content, source)
  assert.equal(request.max_completion_tokens, 8192)
  assert.equal(metrics.promptTokens, 10)
  assert.equal(metrics.completionTokens, 20)
  assert.equal(metrics.requestBytes, Buffer.byteLength(JSON.stringify(request), 'utf8'))
  assert.equal(metrics.contextWindow, 131072)
  const malformedClient = { models: client.models, chat: { completions: { create: async () => ({ choices: [{ message: { content: '{bad json' } }] }) } } }
  await assert.rejects(analyzeMedicalText(source, { env, client: malformedClient }), { code: 'GROQ_INVALID_JSON' })
  assert.throws(() => validateModelConfiguration({ GROQ_API_KEY: 'x', GROQ_MODEL: 'unverified-model' }), { code: 'GROQ_MODEL_UNSUPPORTED' })
  assert.throws(() => validateModelConfiguration({ GROQ_MODEL: 'openai/gpt-oss-20b' }), { code: 'GROQ_NOT_CONFIGURED' })
})

test('Mongo queue is unique per document and only bounded transient failures retry', () => {
  assert.ok(DocumentAnalysis.schema.indexes().some(([fields, options]) => fields.documentId === 1 && options.unique))
  assert.ok(Document.schema.path('analysisStatus').enumValues.includes('pending'))
  assert.equal(retryDisposition({ status: 429 }, 1).status, 'pending')
  assert.equal(retryDisposition({ status: 503 }, 1).status, 'pending')
  const rateLimitRetry = retryDisposition({ code: 'GROQ_CHUNK_FAILED', retryable: true, retryAfterMs: 70000 }, 1)
  assert.ok(rateLimitRetry.retryAt.getTime() - Date.now() >= 69000)
  const jitterLow = retryDisposition({ status: 503 }, 1, { randomFn: () => 0 }).retryAt.getTime()
  const jitterHigh = retryDisposition({ status: 503 }, 1, { randomFn: () => 1 }).retryAt.getTime()
  assert.ok(jitterHigh - jitterLow >= 4900)
  assert.equal(retryDisposition({ name: 'APIConnectionTimeoutError' }, analysisRetryPolicy.maxAttempts).status, 'failed')
  assert.equal(retryDisposition({ status: 401 }, 1).status, 'failed')
  assert.equal(retryDisposition({ status: 404 }, 1).status, 'failed')
  assert.equal(retryDisposition({ code: 'GROQ_INVALID_JSON' }, 1).status, 'failed')
  const transientFailure = workerFailureState({ status: 503 }, 1)
  assert.equal(transientFailure.status, 'pending')
  assert.equal(transientFailure.lastErrorCode, 'GROQ_TEMPORARY_FAILURE')
  assert.ok(transientFailure.nextAttemptAt instanceof Date)
  const permanentFailure = workerFailureState({ code: 'GROQ_SCHEMA_INVALID' }, 1)
  assert.equal(permanentFailure.status, 'failed')
  assert.equal(permanentFailure.lastErrorCode, 'GROQ_SCHEMA_INVALID')
  assert.equal('nextAttemptAt' in permanentFailure, false)
  assert.equal(analysisRetryPolicy.maxAttempts, 5)
  const persistenceFailure = workerFailureState({ code: 'ANALYSIS_PERSISTENCE_FAILED', retryable: true }, 1)
  assert.equal(persistenceFailure.status, 'pending')
  assert.equal(persistenceFailure.lastErrorCode, 'ANALYSIS_PERSISTENCE_FAILED')
  assert.equal(classifyGroqRequestError({ status: 422 }), 'GROQ_REQUEST_REJECTED')
  assert.equal(classifyGroqRequestError({ status: 400, error: { message: 'max completion tokens reached before generating a valid document: the output was truncated to fit max_completion_tokens and is missing required content; json_validate_failed' } }), 'GROQ_RESPONSE_TRUNCATED')
  assert.equal(classifyGroqRequestError({ status: 502 }), 'GROQ_TEMPORARY_FAILURE')
  assert.equal(classifyGroqRequestError({ cause: new TypeError('fetch failed') }), 'GROQ_CONNECTION_ERROR')
  assert.equal(retryAfterMilliseconds({ status: 429, headers: { 'retry-after': '2' } }), 2000)
  assert.equal(retryAfterMilliseconds({ status: 429, headers: { 'x-ratelimit-reset-tokens': '1m20s' } }), 80000)
  assert.equal(categorizePipelineFailure(new Error('database validation'), 'persistence').code, 'ANALYSIS_PERSISTENCE_FAILED')
  assert.equal(categorizePipelineFailure(new Error('bad PDF'), 'extraction').code, 'DOCUMENT_EXTRACTION_FAILED')
  assert.equal(categorizePipelineFailure(new Error('unknown Groq failure'), 'groq').code, 'GROQ_API_ERROR')
})

test('Mongo result schema preserves every normalized field and hydrates legacy results with safe defaults', () => {
  const rich = validateGroundedAnalysis({
    documentType: 'prescription', documentTypeEvidence: 'Prescription',
    documentTitle: 'Synthetic prescription', documentTitleEvidence: 'Synthetic prescription',
    category: 'Prescription', categoryEvidence: 'Prescription', provider: 'Example Clinic', providerEvidence: 'Example Clinic',
    patientInformation: [{ label: 'Patient label', value: 'Synthetic Patient', evidence: 'Patient label: Synthetic Patient', pageNumber: 1 }],
    reportDate: '14 May 2026', reportDateEvidence: '14 May 2026', findings: [], tests: [],
    medications: [{ name: 'Example medicine', nameEvidence: 'Example medicine', dosage: '5 mg', dosageEvidence: '5 mg', route: 'oral', routeEvidence: 'oral', frequency: 'once daily', frequencyEvidence: 'once daily', duration: null, durationEvidence: null, instructions: 'with food', instructionsEvidence: 'with food', pageNumber: 1 }],
    sections: [{ type: 'instructions', title: 'Instructions', titleEvidence: 'Instructions', text: 'Return for review.', evidence: 'Return for review.', pageNumber: 1 }],
    details: [{ label: 'Document number', value: 'SYN-01', evidence: 'Document number: SYN-01', pageNumber: 1 }],
  }, '[[PAGE 1]]\nPrescription. Synthetic prescription. Patient label: Synthetic Patient. Example Clinic. 14 May 2026. Example medicine 5 mg oral once daily with food. Instructions: Return for review. Document number: SYN-01')
  const model = new DocumentAnalysis({
    documentId: new DocumentAnalysis.base.Types.ObjectId(), ownerId: new DocumentAnalysis.base.Types.ObjectId(), status: 'completed', result: rich,
    chunkProgress: { completed: 1, total: 1, failed: 0 }, sourceTextHash: 'a'.repeat(64),
    chunks: [{ chunkId: 'b'.repeat(64), index: 0, pageStart: 1, pageEnd: 1, estimatedInputTokens: 231, status: 'completed', attempts: 1, result: rich }],
  })
  assert.equal(model.validateSync(), undefined)
  const persistedShape = model.toObject().result
  assert.equal(persistedShape.patientInformation[0].value, 'Synthetic Patient')
  assert.equal(persistedShape.medications[0].dosage, '5 mg')
  assert.equal(persistedShape.sections[0].pageNumber, 1)
  assert.equal(persistedShape.details[0].value, 'SYN-01')
  assert.equal(model.toObject().chunkProgress.completed, 1)
  assert.equal(model.toObject().chunks[0].result.medications[0].name, 'Example medicine')

  const legacy = DocumentAnalysis.hydrate({
    _id: new DocumentAnalysis.base.Types.ObjectId(), documentId: new DocumentAnalysis.base.Types.ObjectId(),
    ownerId: new DocumentAnalysis.base.Types.ObjectId(), status: 'completed', result: { reportDate: '2026-10-12', findings: [], tests: [] },
  })
  const compatible = MedicalAnalysisResult.safeParse(legacy.result.toObject())
  assert.equal(compatible.success, true)
  assert.deepEqual(compatible.data.medications, [])
  assert.equal(compatible.data.reportDate, '2026-10-12')
})

test('worker claim query recovers due pending jobs and expired processing leases only', () => {
  const now = new Date('2026-10-27T00:00:00.000Z')
  const query = claimableAnalysisQuery(now, { documentId: 'document-id', ownerId: 'patient-id' })
  assert.equal(query.documentId, 'document-id')
  assert.equal(query.ownerId, 'patient-id')
  assert.equal(query.nextAttemptAt.$lte, now)
  assert.deepEqual(query.$or, [
    { status: 'pending' },
    { status: 'processing', leaseUntil: { $lte: now } },
  ])
})

test('enqueue upserts by document ID so duplicate requests do not create duplicate jobs', async () => {
  const oldAnalysisUpdate = DocumentAnalysis.updateOne
  const oldDocumentUpdate = Document.updateOne
  const filters = []
  DocumentAnalysis.updateOne = async (filter, update, options) => { filters.push({ filter, update, options }); return { upsertedCount: 1 } }
  Document.updateOne = async () => ({ modifiedCount: 1 })
  try {
    const document = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', ownerId: 'bbbbbbbbbbbbbbbbbbbbbbbb', fileType: 'application/pdf' }
    await enqueueDocumentAnalysis(document)
    await enqueueDocumentAnalysis(document)
    assert.equal(filters.length, 2)
    assert.ok(filters.every(({ filter, options }) => String(filter.documentId) === document._id && options.upsert === true))
  } finally {
    DocumentAnalysis.updateOne = oldAnalysisUpdate
    Document.updateOne = oldDocumentUpdate
  }
})

function responseStub() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, setHeader(name, value) { this.headers[name] = value } }
}

test('analysis endpoints scope patient reads to the signed-in owner and doctors to active grants', async () => {
  const oldDocFind = Document.findOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const oldGrantFind = AccessGrant.findOne
  let docQuery
  let analysisQuery
  Document.findOne = (query) => ({ select: async () => { docQuery = query; return { _id: 'document-id', analysisStatus: 'failed' } } })
  DocumentAnalysis.findOne = async (query) => { analysisQuery = query; return null }
  try {
    const ownRes = responseStub()
    await getOwnedDocumentAnalysis({ user: { id: 'patient-id', role: 'patient' }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' } }, ownRes)
    assert.equal(String(docQuery.ownerId), 'patient-id')
    assert.equal(String(analysisQuery.ownerId), 'patient-id')
    assert.equal(ownRes.body.analysis.status, 'failed')

    let documentRead = false
    AccessGrant.findOne = () => ({ select: async () => null })
    Document.findOne = () => { documentRead = true; return { select: async () => null } }
    const denied = responseStub()
    await getSharedDocumentAnalysis({ user: { id: 'cccccccccccccccccccccccc', role: 'doctor' }, params: { patientId: 'aaaaaaaaaaaaaaaaaaaaaaaa', documentId: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, denied)
    assert.equal(denied.statusCode, 403)
    assert.equal(documentRead, false)

    AccessGrant.findOne = () => ({ select: async () => ({ _id: 'grant-id' }) })
    Document.findOne = (query) => ({ select: async () => { docQuery = query; return { _id: 'document-id', analysisStatus: 'completed' } } })
    DocumentAnalysis.findOne = async (query) => { analysisQuery = query; return { _id: 'analysis-id', status: 'completed', result, attempts: 1 } }
    const shared = responseStub()
    await getSharedDocumentAnalysis({ user: { id: 'cccccccccccccccccccccccc', role: 'doctor' }, params: { patientId: 'aaaaaaaaaaaaaaaaaaaaaaaa', documentId: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, shared)
    assert.equal(String(docQuery.ownerId), 'aaaaaaaaaaaaaaaaaaaaaaaa')
    assert.equal(String(analysisQuery.ownerId), 'aaaaaaaaaaaaaaaaaaaaaaaa')
    assert.equal(shared.body.analysis.status, 'completed')
  } finally {
    Document.findOne = oldDocFind
    DocumentAnalysis.findOne = oldAnalysisFind
    AccessGrant.findOne = oldGrantFind
  }
})

test('normal and demo patients can start analysis for their owned documents without changing ownership', async () => {
  const oldDocumentFind = Document.findOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const oldAnalysisUpdate = DocumentAnalysis.updateOne
  const oldDocumentUpdate = Document.updateOne
  const oldSetImmediate = globalThis.setImmediate
  const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const document = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', ownerId, fileType: 'application/pdf', demoSeedKey: 'synthetic-cbc' }
  const analysis = { _id: 'cccccccccccccccccccccccc', documentId: document._id, ownerId, status: 'pending', attempts: 0 }
  let analysisLookups = 0
  const createdQueries = []
  let kicksScheduled = 0
  Document.findOne = (query) => ({ select: async () => { assert.equal(String(query.ownerId), ownerId); return document } })
  DocumentAnalysis.findOne = async (query) => {
    assert.equal(String(query.ownerId), ownerId)
    analysisLookups += 1
    return analysisLookups % 2 === 0 ? analysis : null
  }
  DocumentAnalysis.updateOne = async (query, update, options) => { createdQueries.push({ query, update, options }); return { upsertedCount: 1 } }
  Document.updateOne = async () => ({ modifiedCount: 1 })
  globalThis.setImmediate = () => { kicksScheduled += 1; return 0 }
  try {
    for (const isDemo of [false, true]) {
      const res = responseStub()
      await startDocumentAnalysis({ user: { id: ownerId, role: 'patient', isDemo }, params: { id: document._id }, body: {} }, res)
      assert.equal(res.statusCode, 202)
      assert.equal(res.body.analysis.status, 'pending')
    }
    assert.equal(createdQueries.length, 2)
    assert.ok(createdQueries.every(({ query, update, options }) => String(query.documentId) === document._id && String(update.$setOnInsert.ownerId) === ownerId && options.upsert === true))
    assert.equal(kicksScheduled, 2)
  } finally {
    Document.findOne = oldDocumentFind
    DocumentAnalysis.findOne = oldAnalysisFind
    DocumentAnalysis.updateOne = oldAnalysisUpdate
    Document.updateOne = oldDocumentUpdate
    globalThis.setImmediate = oldSetImmediate
  }
})

test('starting an existing pending job re-kicks the worker without creating another job', async () => {
  const oldDocumentFind = Document.findOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const oldAnalysisUpdate = DocumentAnalysis.updateOne
  const oldDocumentUpdate = Document.updateOne
  const oldSetImmediate = globalThis.setImmediate
  const document = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', ownerId: 'aaaaaaaaaaaaaaaaaaaaaaaa', fileType: 'application/pdf' }
  const analysis = { _id: 'cccccccccccccccccccccccc', status: 'pending', attempts: 1 }
  let kicks = 0
  let creates = 0
  Document.findOne = () => ({ select: async () => document })
  DocumentAnalysis.findOne = async () => analysis
  DocumentAnalysis.updateOne = async () => { creates += 1; return { upsertedCount: 0 } }
  Document.updateOne = async () => ({ modifiedCount: 1 })
  globalThis.setImmediate = () => { kicks += 1; return 0 }
  try {
    const res = responseStub()
    await startDocumentAnalysis({ user: { id: document.ownerId, role: 'patient' }, params: { id: document._id }, body: {} }, res)
    assert.equal(res.statusCode, 202)
    assert.equal(res.body.analysis.id, analysis._id)
    assert.equal(res.body.analysis.status, 'pending')
    assert.equal(kicks, 1)
    assert.equal(creates, 0)
  } finally {
    Document.findOne = oldDocumentFind
    DocumentAnalysis.findOne = oldAnalysisFind
    DocumentAnalysis.updateOne = oldAnalysisUpdate
    Document.updateOne = oldDocumentUpdate
    globalThis.setImmediate = oldSetImmediate
  }
})

test('a start-request persistence failure is surfaced instead of reported as pending', async () => {
  const oldDocumentFind = Document.findOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const oldAnalysisUpdate = DocumentAnalysis.updateOne
  const document = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', ownerId: 'aaaaaaaaaaaaaaaaaaaaaaaa', fileType: 'application/pdf' }
  Document.findOne = () => ({ select: async () => document })
  DocumentAnalysis.findOne = async () => null
  DocumentAnalysis.updateOne = async () => { throw new Error('database unavailable') }
  try {
    const res = responseStub()
    await assert.rejects(startDocumentAnalysis({ user: { id: document.ownerId, role: 'patient' }, params: { id: document._id }, body: {} }, res), /database unavailable/)
    assert.equal(res.body, undefined)
  } finally {
    Document.findOne = oldDocumentFind
    DocumentAnalysis.findOne = oldAnalysisFind
    DocumentAnalysis.updateOne = oldAnalysisUpdate
  }
})

test('status polling returns the persisted completed job with its analysis ID', async () => {
  const oldDocumentFind = Document.findOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const analysis = { _id: 'cccccccccccccccccccccccc', status: 'completed', result, attempts: 1, confirmedAt: null }
  Document.findOne = () => ({ select: async () => ({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', analysisStatus: 'completed' }) })
  DocumentAnalysis.findOne = async (query) => {
    assert.equal(String(query.documentId), 'bbbbbbbbbbbbbbbbbbbbbbbb')
    assert.equal(String(query.ownerId), ownerId)
    return analysis
  }
  try {
    const res = responseStub()
    await getOwnedDocumentAnalysis({ user: { id: ownerId, role: 'patient' }, params: { id: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.analysis.id, analysis._id)
    assert.equal(res.body.analysis.status, 'completed')
    assert.deepEqual(res.body.analysis.result, result)
  } finally {
    Document.findOne = oldDocumentFind
    DocumentAnalysis.findOne = oldAnalysisFind
  }
})

test('patient review saves edited fields without creating a medical history entry', async () => {
  const oldDocumentFind = Document.findOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const oldAnalysisSave = DocumentAnalysis.prototype.save
  const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const analysis = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', status: 'completed', reviewedResult: null, confirmedAt: null, async save() {} }
  Document.findOne = (query) => ({ select: async () => { assert.equal(String(query.ownerId), ownerId); return { _id: 'document-id' } } })
  DocumentAnalysis.findOne = async (query) => { assert.equal(String(query.ownerId), ownerId); return analysis }
  try {
    const edited = { ...result, tests: [{ ...result.tests[0], value: '13.5', valueEvidence: null }] }
    const res = responseStub()
    await reviewDocumentAnalysis({ user: { id: ownerId, role: 'patient' }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', analysisId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, body: { result: edited } }, res)
    assert.equal(analysis.reviewedResult.tests[0].value, '13.5')
    assert.equal(analysis.confirmedAt, null)
    assert.equal(res.body.analysis.confirmed, false)
  } finally {
    Document.findOne = oldDocumentFind
    DocumentAnalysis.findOne = oldAnalysisFind
    DocumentAnalysis.prototype.save = oldAnalysisSave
  }
})

test('confirmation creates one linked medical record only on explicit patient confirmation', async () => {
  const oldDocumentFind = Document.findOne
  const oldDocumentUpdate = Document.updateOne
  const oldAnalysisFind = DocumentAnalysis.findOne
  const oldRecordUpsert = MedicalRecord.findOneAndUpdate
  const oldRecordFind = MedicalRecord.findOne
  let recordQuery
  let recordUpdate
  let upsertCalls = 0
  const analysis = { _id: 'analysis-id', status: 'completed', result, reviewedResult: null, confirmedAt: null, async save() {} }
  const ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const prescription = {
    documentType: 'Prescription', documentTypeEvidence: 'Prescription', reportDate: null, reportDateEvidence: null,
    findings: [], tests: [], patientInformation: [], documentTitle: null, documentTitleEvidence: null, category: null,
    categoryEvidence: null, provider: null, providerEvidence: null, sections: [{ type: 'instructions', title: 'Instructions', titleEvidence: 'Instructions', text: 'Return for review.', evidence: 'Return for review.', pageNumber: 1 }],
    medications: [{ name: 'Synthetic medicine', nameEvidence: 'Synthetic medicine', dosage: '5 mg', dosageEvidence: '5 mg', route: null, routeEvidence: null, frequency: 'once daily', frequencyEvidence: 'once daily', duration: null, durationEvidence: null, instructions: null, instructionsEvidence: null, pageNumber: 1 }],
    details: [],
  }
  Document.findOne = (query) => ({ select: async () => { assert.equal(String(query.ownerId), ownerId); return { _id: 'document-id', title: 'CBC', eventDate: null } } })
  DocumentAnalysis.findOne = async (query) => { assert.equal(String(query.ownerId), ownerId); return analysis }
  Document.updateOne = async () => ({ modifiedCount: 1 })
  MedicalRecord.findOneAndUpdate = async (query, update, options) => { recordQuery = query; recordUpdate = update; assert.equal(options.upsert, true); upsertCalls += 1; return { _id: 'record-id' } }
  MedicalRecord.findOne = async (query) => { assert.equal(String(query.analysisId), 'analysis-id'); return { _id: 'record-id' } }
  try {
    const res = responseStub()
    await confirmDocumentAnalysis({ user: { id: ownerId, role: 'patient' }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', analysisId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, body: { result: prescription } }, res)
    const duplicate = responseStub()
    await confirmDocumentAnalysis({ user: { id: ownerId, role: 'patient' }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', analysisId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, body: { result: prescription } }, duplicate)
    assert.equal(String(recordQuery.analysisId), 'analysis-id')
    assert.equal(String(recordUpdate.$setOnInsert.documentId), 'document-id')
    assert.equal(String(recordUpdate.$setOnInsert.ownerId), ownerId)
    assert.equal(recordUpdate.$setOnInsert.category, 'Prescription')
    assert.match(recordUpdate.$setOnInsert.notes, /Synthetic medicine: 5 mg; once daily/)
    assert.match(recordUpdate.$setOnInsert.notes, /Instructions: Return for review\./)
    assert.equal(res.body.recordId, 'record-id')
    assert.equal(duplicate.body.recordId, 'record-id')
    assert.equal(upsertCalls, 1)
    assert.equal(analysis.confirmedAt instanceof Date, true)
    assert.equal(MedicalRecord.schema.path('analysisId').options.ref, 'DocumentAnalysis')
    assert.ok(MedicalRecord.schema.indexes().some(([fields, options]) => fields.analysisId === 1 && options.unique && options.partialFilterExpression?.analysisId?.$type === 'objectId'))
  } finally {
    Document.findOne = oldDocumentFind
    Document.updateOne = oldDocumentUpdate
    DocumentAnalysis.findOne = oldAnalysisFind
    MedicalRecord.findOneAndUpdate = oldRecordUpsert
    MedicalRecord.findOne = oldRecordFind
  }
})
