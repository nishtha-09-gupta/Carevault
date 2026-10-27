import assert from 'node:assert/strict'
import { test } from 'node:test'
import Document from '../src/models/Document.js'
import DocumentAnalysis from '../src/models/DocumentAnalysis.js'
import MedicalRecord from '../src/models/MedicalRecord.js'
import AccessGrant from '../src/models/AccessGrant.js'
import { medicalAnalysisJsonSchema, validateGroundedAnalysis } from '../src/services/medicalAnalysisSchema.js'
import { analyzeMedicalText, validateModelConfiguration } from '../src/services/groqMedicalAnalysis.js'
import { analysisRetryPolicy, claimableAnalysisQuery, enqueueDocumentAnalysis, retryDisposition, workerFailureState } from '../src/services/documentAnalysisQueue.js'
import { getOwnedDocumentAnalysis, getSharedDocumentAnalysis, reviewDocumentAnalysis, confirmDocumentAnalysis, startDocumentAnalysis } from '../src/controllers/documentAnalysisController.js'
import { extractDocumentText } from '../src/services/documentTextExtraction.js'

const source = 'CBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal\nReport date: 2026-10-12'
const result = {
  reportDate: '2026-10-12', reportDateEvidence: 'Report date: 2026-10-12',
  findings: [{ text: 'CBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal', evidence: 'CBC: Hemoglobin 13.2 g/dL (12.0-16.0) Normal' }],
  tests: [{ name: 'Hemoglobin', nameEvidence: 'Hemoglobin', value: '13.2', valueEvidence: 'Hemoglobin 13.2', unit: 'g/dL', unitEvidence: '13.2 g/dL', referenceRange: '12.0-16.0', referenceRangeEvidence: '(12.0-16.0)', abnormalFlag: 'normal', abnormalFlagEvidence: 'Normal' }],
}

test('digital PDF extraction reads synthetic fixture text without OCR', async () => {
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(new URL('../demo-documents/cbc_blood_test_2026-10-04.pdf', import.meta.url))
  let extractionMode
  const text = await extractDocumentText(bytes, 'application/pdf', { onMetrics: (metrics) => { extractionMode = metrics.mode } })
  assert.ok(text.length > 100)
  assert.equal(extractionMode, 'digital-pdf')
})

test('document analysis data is strictly schema validated and unsupported claims become null', () => {
  const grounded = validateGroundedAnalysis(result, source)
  assert.equal(grounded.tests[0].value, '13.2')
  const ungrounded = validateGroundedAnalysis({ ...result, tests: [{ ...result.tests[0], value: '99', valueEvidence: 'Hemoglobin 13.2' }] }, source)
  assert.equal(ungrounded.tests[0].value, null)
  const inventedFlag = validateGroundedAnalysis({ ...result, tests: [{ ...result.tests[0], abnormalFlag: 'high', abnormalFlagEvidence: 'Normal' }] }, source)
  assert.equal(inventedFlag.tests[0].abnormalFlag, null)
  assert.throws(() => validateGroundedAnalysis({ ...result, extra: 'not allowed' }, source))
  assert.throws(() => validateGroundedAnalysis({ ...result, reportDate: '2026-02-31' }, source))
})

test('Groq integration uses one configured strict-schema completion and handles malformed response', async () => {
  const env = { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-20b' }
  let request
  let modelListCalls = 0
  const client = {
    models: { list: async () => { modelListCalls += 1; throw new Error('models.list should not be called per report') } },
    chat: { completions: { create: async (body) => { request = body; return { choices: [{ message: { content: JSON.stringify(result) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } } } } },
  }
  let metrics
  const parsed = await analyzeMedicalText(source, { client, env, onMetrics: (value) => { metrics = value } })
  assert.equal(parsed.tests[0].value, '13.2')
  assert.equal(request.response_format.type, 'json_schema')
  assert.equal(request.response_format.json_schema.strict, true)
  assert.deepEqual(request.response_format.json_schema.schema, medicalAnalysisJsonSchema)
  assert.equal(modelListCalls, 0)
  assert.equal(request.messages[1].content, source)
  assert.equal(metrics.promptTokens, 10)
  assert.equal(metrics.completionTokens, 20)
  await assert.rejects(analyzeMedicalText(source, { env, client: { models: { list: async () => ({ data: [{ id: env.GROQ_MODEL }] }) }, chat: { completions: { create: async () => ({ choices: [{ message: { content: '{bad json' } }] }) } } } }), { code: 'GROQ_MALFORMED_RESPONSE' })
  assert.throws(() => validateModelConfiguration({ GROQ_API_KEY: 'x', GROQ_MODEL: 'unverified-model' }), { code: 'GROQ_MODEL_UNSUPPORTED' })
  assert.throws(() => validateModelConfiguration({ GROQ_MODEL: 'openai/gpt-oss-20b' }), { code: 'GROQ_NOT_CONFIGURED' })
})

test('Mongo queue is unique per document and only bounded transient failures retry', () => {
  assert.ok(DocumentAnalysis.schema.indexes().some(([fields, options]) => fields.documentId === 1 && options.unique))
  assert.ok(Document.schema.path('analysisStatus').enumValues.includes('pending'))
  assert.equal(retryDisposition({ status: 429 }, 1).status, 'pending')
  assert.equal(retryDisposition({ status: 503 }, 1).status, 'pending')
  assert.equal(retryDisposition({ name: 'APIConnectionTimeoutError' }, analysisRetryPolicy.maxAttempts).status, 'failed')
  assert.equal(retryDisposition({ status: 401 }, 1).status, 'failed')
  assert.equal(retryDisposition({ status: 404 }, 1).status, 'failed')
  assert.equal(retryDisposition({ code: 'GROQ_MALFORMED_RESPONSE' }, 1).status, 'failed')
  const transientFailure = workerFailureState({ status: 503 }, 1)
  assert.equal(transientFailure.status, 'pending')
  assert.equal(transientFailure.lastErrorCode, 'GROQ_TEMPORARY_FAILURE')
  assert.ok(transientFailure.nextAttemptAt instanceof Date)
  const permanentFailure = workerFailureState({ code: 'GROQ_MALFORMED_RESPONSE' }, 1)
  assert.equal(permanentFailure.status, 'failed')
  assert.equal(permanentFailure.lastErrorCode, 'GROQ_MALFORMED_RESPONSE')
  assert.equal('nextAttemptAt' in permanentFailure, false)
  assert.equal(analysisRetryPolicy.maxAttempts, 5)
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
  Document.findOne = (query) => ({ select: async () => { assert.equal(String(query.ownerId), ownerId); return { _id: 'document-id', title: 'CBC', eventDate: null } } })
  DocumentAnalysis.findOne = async (query) => { assert.equal(String(query.ownerId), ownerId); return analysis }
  Document.updateOne = async () => ({ modifiedCount: 1 })
  MedicalRecord.findOneAndUpdate = async (query, update, options) => { recordQuery = query; recordUpdate = update; assert.equal(options.upsert, true); upsertCalls += 1; return { _id: 'record-id' } }
  MedicalRecord.findOne = async (query) => { assert.equal(String(query.analysisId), 'analysis-id'); return { _id: 'record-id' } }
  try {
    const res = responseStub()
    await confirmDocumentAnalysis({ user: { id: ownerId, role: 'patient' }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', analysisId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, body: { result } }, res)
    const duplicate = responseStub()
    await confirmDocumentAnalysis({ user: { id: ownerId, role: 'patient' }, params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', analysisId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, body: { result } }, duplicate)
    assert.equal(String(recordQuery.analysisId), 'analysis-id')
    assert.equal(String(recordUpdate.$setOnInsert.documentId), 'document-id')
    assert.equal(String(recordUpdate.$setOnInsert.ownerId), ownerId)
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
