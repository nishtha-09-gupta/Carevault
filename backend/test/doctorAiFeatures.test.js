import assert from 'node:assert/strict'
import { test } from 'node:test'
import AccessGrant from '../src/models/AccessGrant.js'
import Document from '../src/models/Document.js'
import DocumentAnalysis from '../src/models/DocumentAnalysis.js'
import HealthIntake from '../src/models/HealthIntake.js'
import MedicalRecord from '../src/models/MedicalRecord.js'
import User from '../src/models/User.js'
import { getSharedDocumentAnalysis, retrySharedDocumentAnalysis, startSharedDocumentAnalysis } from '../src/controllers/documentAnalysisController.js'
import PatientSummary from '../src/models/PatientSummary.js'
import { generatePatientSummary, getPatientSummary } from '../src/controllers/doctorSummaryController.js'
import { classifyGroqRequestError, generateMedicalSummary, medicalSummaryJsonSchema } from '../src/services/groqMedicalAnalysis.js'
import documentRoutes from '../src/routes/documentRoutes.js'

const patientId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const doctorId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const documentId = 'cccccccccccccccccccccccc'

test('patient document API does not expose the removed patient-side summary endpoint', () => {
  const getRoutes = documentRoutes.stack.filter((layer) => layer.route?.methods?.get).map((layer) => layer.route.path)
  assert.equal(getRoutes.includes('/summary'), false)
})

function response() {
  return { statusCode: 200, headers: {}, status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this }, setHeader(key, value) { this.headers[key] = value } }
}
function queryResult(value) { return { select() { return this }, sort() { return this }, lean() { return Promise.resolve(value) } } }

test('doctor shared analysis checks grant and patient document ownership, then reuses completed job', async () => {
  const oldGrant = AccessGrant.findOne, oldDoc = Document.findOne, oldAnalysis = DocumentAnalysis.findOne
  let ownerFilter, analysisFilter, grantQueries = 0
  const completed = { _id: 'dddddddddddddddddddddddd', status: 'completed', result: { tests: [], findings: [] }, attempts: 1, confirmedAt: null }
  AccessGrant.findOne = (query) => { grantQueries++; assert.equal(String(query.patientId), patientId); assert.equal(String(query.doctorId), doctorId); assert.equal(query.status, 'active'); assert.ok(query.expiresAt.$gt); return { select: async () => ({ _id: 'grant' }) } }
  Document.findOne = (query) => { ownerFilter = query; return { select: async () => ({ _id: documentId, ownerId: patientId, fileType: 'application/pdf' }) } }
  DocumentAnalysis.findOne = async (query) => { analysisFilter = query; return completed }
  try {
    const req = { user: { id: doctorId, role: 'doctor' }, params: { patientId, documentId }, body: {} }
    const read = response()
    await getSharedDocumentAnalysis(req, read)
    assert.equal(read.body.analysis.status, 'completed')
    assert.equal(String(ownerFilter.ownerId), patientId)
    assert.equal(String(analysisFilter.ownerId), patientId)
    assert.ok(grantQueries >= 2, 'authorization is rechecked before returning a persisted analysis')
    const start = response()
    await startSharedDocumentAnalysis(req, start)
    assert.equal(start.statusCode, 200)
    assert.equal(start.body.analysis.id, completed._id)
  } finally { AccessGrant.findOne = oldGrant; Document.findOne = oldDoc; DocumentAnalysis.findOne = oldAnalysis }
})

test('doctor analysis denies missing or expired/revoked grant before reading a document', async () => {
  const oldGrant = AccessGrant.findOne, oldDoc = Document.findOne
  let documentReads = 0
  AccessGrant.findOne = () => ({ select: async () => null })
  Document.findOne = () => { documentReads++; return { select: async () => null } }
  try {
    for (const role of ['doctor', 'patient']) {
      const res = response()
      await startSharedDocumentAnalysis({ user: { id: doctorId, role }, params: { patientId, documentId }, body: {} }, res)
      assert.equal(res.statusCode, 403)
    }
    assert.equal(documentReads, 0)
  } finally { AccessGrant.findOne = oldGrant; Document.findOne = oldDoc }
})

test('doctor analysis only starts a patient-owned job and kicks the existing queue', async () => {
  const oldGrant = AccessGrant.findOne, oldDoc = Document.findOne, oldAnalysisFind = DocumentAnalysis.findOne
  const oldAnalysisUpdate = DocumentAnalysis.updateOne, oldDocumentUpdate = Document.updateOne, oldImmediate = globalThis.setImmediate
  const document = { _id: documentId, ownerId: patientId, fileType: 'application/pdf' }
  const job = { _id: 'dddddddddddddddddddddddd', documentId, ownerId: patientId, status: 'pending', attempts: 0 }
  let kicks = 0, queryUsed
  AccessGrant.findOne = () => ({ select: async () => ({ _id: 'active-grant' }) })
  Document.findOne = (query) => { queryUsed = query; return { select: async () => document } }
  let calls = 0
  DocumentAnalysis.findOne = async () => ++calls === 1 ? null : job
  DocumentAnalysis.updateOne = async (query, update, options) => { assert.equal(String(update.$setOnInsert.ownerId), patientId); assert.equal(options.upsert, true); return { upsertedCount: 1 } }
  Document.updateOne = async () => ({ modifiedCount: 1 })
  globalThis.setImmediate = () => { kicks++; return 0 }
  try {
    const res = response()
    await startSharedDocumentAnalysis({ user: { id: doctorId, role: 'doctor' }, params: { patientId, documentId }, body: {} }, res)
    assert.equal(res.statusCode, 202)
    assert.equal(res.body.analysis.status, 'pending')
    assert.equal(String(queryUsed.ownerId), patientId)
    assert.equal(kicks, 1)
  } finally { AccessGrant.findOne = oldGrant; Document.findOne = oldDoc; DocumentAnalysis.findOne = oldAnalysisFind; DocumentAnalysis.updateOne = oldAnalysisUpdate; Document.updateOne = oldDocumentUpdate; globalThis.setImmediate = oldImmediate }
})

test('doctor can retry a failed unconfirmed shared analysis through the persistent queue', async () => {
  const oldGrant = AccessGrant.findOne, oldDoc = Document.findOne, oldAnalysisFind = DocumentAnalysis.findOne
  const oldDocumentUpdate = Document.updateOne, oldSave = DocumentAnalysis.prototype.save, oldImmediate = globalThis.setImmediate
  const analysis = { _id: 'dddddddddddddddddddddddd', status: 'failed', attempts: 4, confirmedAt: null, async save() { this.saved = true } }
  let kicks = 0
  AccessGrant.findOne = () => ({ select: async () => ({ _id: 'active-grant' }) })
  Document.findOne = () => ({ select: async () => ({ _id: documentId }) })
  DocumentAnalysis.findOne = async () => analysis
  Document.updateOne = async () => ({ modifiedCount: 1 })
  globalThis.setImmediate = () => { kicks++; return 0 }
  try {
    const res = response()
    await retrySharedDocumentAnalysis({ user: { id: doctorId, role: 'doctor' }, params: { patientId, documentId } }, res)
    assert.equal(res.statusCode, 202)
    assert.equal(analysis.status, 'pending')
    assert.equal(analysis.attempts, 0)
    assert.equal(analysis.saved, true)
    assert.equal(kicks, 1)
  } finally { AccessGrant.findOne = oldGrant; Document.findOne = oldDoc; DocumentAnalysis.findOne = oldAnalysisFind; Document.updateOne = oldDocumentUpdate; DocumentAnalysis.prototype.save = oldSave; globalThis.setImmediate = oldImmediate }
})

test('doctor cannot read a persisted summary when grant is expired, revoked, or belongs to another doctor', async () => {
  const oldGrant = AccessGrant.findOne, oldSummary = PatientSummary.findOne, oldUser = User.findOne
  let summaryReads = 0
  AccessGrant.findOne = () => ({ select: async () => null })
  PatientSummary.findOne = async () => { summaryReads++; return null }
  User.findOne = () => { throw new Error('patient lookup must follow grant validation') }
  try {
    const res = response()
    await getPatientSummary({ user: { id: doctorId, role: 'doctor' }, params: { patientId } }, res)
    assert.equal(res.statusCode, 403)
    assert.equal(summaryReads, 0)
  } finally { AccessGrant.findOne = oldGrant; PatientSummary.findOne = oldSummary; User.findOne = oldUser }
})

test('summary generation is authorized, cites source references, and separates patient-confirmed sources', async () => {
  const oldGrant = AccessGrant.findOne, oldUser = User.findOne, oldDocuments = Document.find, oldAnalyses = DocumentAnalysis.find, oldRecords = MedicalRecord.find, oldIntake = HealthIntake.findOne
  const oldSummaryFind = PatientSummary.findOne, oldCreate = PatientSummary.create, oldSummaryUpdate = PatientSummary.findOneAndUpdate, oldSummaryFailureUpdate = PatientSummary.updateOne
  const recordId = 'eeeeeeeeeeeeeeeeeeeeeeee'
  const record = { _id: recordId, title: 'Synthetic CBC', category: 'Lab result', provider: '', eventDate: new Date('2026-10-12T00:00:00Z'), notes: 'Hemoglobin 13.2 g/dL', documentId: null, analysisId: 'ffffffffffffffffffffffff', updatedAt: new Date() }
  const row = { _id: '121212121212121212121212', patientId, status: 'generating', sourceFingerprint: 'fingerprint', leaseUntil: new Date(Date.now() + 60000), sourceReferences: [], updatedAt: new Date() }
  const saved = { ...row, status: 'completed', generatedAt: new Date(), keyPoints: [{ text: 'Hemoglobin 13.2 g/dL', sourceIds: [`record:${recordId}`], evidence: 'Hemoglobin 13.2 g/dL' }], medications: [], allergies: [], insufficientInformation: false, sourceReferences: [{ id: `record:${recordId}`, verification: 'patient-confirmed', documentId: null, date: record.eventDate }] }
  AccessGrant.findOne = () => ({ select: async () => ({ _id: 'grant' }) })
  User.findOne = () => queryResult({ _id: patientId, name: 'Synthetic Patient', email: 'patient@example.test' })
  Document.find = () => queryResult([])
  DocumentAnalysis.find = () => queryResult([])
  MedicalRecord.find = () => queryResult([record])
  HealthIntake.findOne = () => queryResult(null)
  PatientSummary.findOne = async () => null
  PatientSummary.create = async () => ({})
  let updates = 0
  PatientSummary.findOneAndUpdate = async () => ++updates === 1 ? row : saved
  try {
    let receivedSources
    const res = response()
    await generatePatientSummary({ user: { id: doctorId, role: 'doctor' }, params: { patientId }, body: {} }, res, { generate: async (sources) => { receivedSources = sources; return { keyPoints: saved.keyPoints, medications: [], allergies: [], insufficientInformation: false } } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.summary.status, 'completed')
    assert.equal(res.body.summary.keyPoints[0].sources[0].verification, 'patient-confirmed')
    assert.equal(receivedSources[0].id, `record:${recordId}`)
    assert.equal(updates, 2)
  } finally { AccessGrant.findOne = oldGrant; User.findOne = oldUser; Document.find = oldDocuments; DocumentAnalysis.find = oldAnalyses; MedicalRecord.find = oldRecords; HealthIntake.findOne = oldIntake; PatientSummary.findOne = oldSummaryFind; PatientSummary.create = oldCreate; PatientSummary.findOneAndUpdate = oldSummaryUpdate }
})

test('summary read marks a changed source snapshot as needing refresh', async () => {
  const oldGrant = AccessGrant.findOne, oldUser = User.findOne, oldDocuments = Document.find, oldAnalyses = DocumentAnalysis.find, oldRecords = MedicalRecord.find, oldIntake = HealthIntake.findOne, oldSummary = PatientSummary.findOne
  AccessGrant.findOne = () => ({ select: async () => ({ _id: 'grant' }) })
  User.findOne = () => queryResult({ _id: patientId, name: 'Synthetic Patient', email: 'patient@example.test' })
  Document.find = () => queryResult([]); DocumentAnalysis.find = () => queryResult([]); MedicalRecord.find = () => queryResult([]); HealthIntake.findOne = () => queryResult(null)
  PatientSummary.findOne = async () => ({ _id: 'summary', patientId, status: 'completed', sourceFingerprint: 'old-fingerprint', keyPoints: [], medications: [], allergies: [], sourceReferences: [], generatedAt: new Date(), updatedAt: new Date() })
  try {
    const res = response()
    await getPatientSummary({ user: { id: doctorId, role: 'doctor' }, params: { patientId } }, res)
    assert.equal(res.body.summary.freshness, 'needs_refresh')
    assert.equal(res.body.freshness, 'needs_refresh')
  } finally { AccessGrant.findOne = oldGrant; User.findOne = oldUser; Document.find = oldDocuments; DocumentAnalysis.find = oldAnalyses; MedicalRecord.find = oldRecords; HealthIntake.findOne = oldIntake; PatientSummary.findOne = oldSummary }
})

test('concurrent summary generation reuses the active generation lock instead of calling Groq twice', async () => {
  const oldGrant = AccessGrant.findOne, oldUser = User.findOne, oldDocuments = Document.find, oldAnalyses = DocumentAnalysis.find, oldRecords = MedicalRecord.find, oldIntake = HealthIntake.findOne, oldSummaryFind = PatientSummary.findOne, oldSummaryUpdate = PatientSummary.findOneAndUpdate
  const active = { _id: 'summary-id', patientId, status: 'generating', leaseUntil: new Date(Date.now() + 30000), sourceFingerprint: 'fingerprint', sourceReferences: [], keyPoints: [], medications: [], allergies: [], updatedAt: new Date() }
  AccessGrant.findOne = () => ({ select: async () => ({ _id: 'grant' }) })
  User.findOne = () => queryResult({ _id: patientId, name: 'Synthetic Patient', email: 'patient@example.test' })
  Document.find = () => queryResult([]); DocumentAnalysis.find = () => queryResult([]); MedicalRecord.find = () => queryResult([{ _id: 'record-id', title: 'Synthetic record', notes: 'Synthetic finding', updatedAt: new Date() }]); HealthIntake.findOne = () => queryResult(null)
  PatientSummary.findOne = async () => active
  PatientSummary.findOneAndUpdate = async () => null
  let modelCalls = 0
  try {
    const res = response()
    await generatePatientSummary({ user: { id: doctorId, role: 'doctor' }, params: { patientId }, body: {} }, res, { generate: async () => { modelCalls++; return { keyPoints: [], medications: [], allergies: [], insufficientInformation: true } } })
    assert.equal(res.statusCode, 202)
    assert.equal(res.body.summary.status, 'generating')
    assert.equal(modelCalls, 0)
  } finally { AccessGrant.findOne = oldGrant; User.findOne = oldUser; Document.find = oldDocuments; DocumentAnalysis.find = oldAnalyses; MedicalRecord.find = oldRecords; HealthIntake.findOne = oldIntake; PatientSummary.findOne = oldSummaryFind; PatientSummary.findOneAndUpdate = oldSummaryUpdate }
})

test('Groq summary validates source IDs and displays only source-grounded evidence', async () => {
  const sources = [{ id: 'source-a', text: 'Hemoglobin 13.2 g/dL', verification: 'patient-confirmed' }]
  const data = { overview: null, keyPoints: [{ text: 'Hemoglobin 13.2 g/dL', sourceIds: ['source-a'], evidence: 'Hemoglobin 13.2 g/dL' }], medications: [], allergies: [], insufficientInformation: false }
  let request
  const client = { chat: { completions: { create: async (body) => { request = body; return { choices: [{ message: { content: JSON.stringify(data) } }] } } } } }
  const valid = await generateMedicalSummary(sources, { client, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } })
  assert.equal(valid.keyPoints[0].text, data.keyPoints[0].text)
  assert.deepEqual(request.response_format.json_schema.schema, medicalSummaryJsonSchema)
  assert.equal(request.response_format.json_schema.strict, true)
  const badIdClient = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ ...data, keyPoints: [{ ...data.keyPoints[0], sourceIds: ['other'] }] }) } }] }) } } }
  await assert.rejects(generateMedicalSummary(sources, { client: badIdClient, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } }), { code: 'GROQ_SOURCE_ID_INVALID' })
  const badEvidenceClient = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ ...data, keyPoints: [{ ...data.keyPoints[0], evidence: 'diagnosis confirmed' }] }) } }] }) } } }
  await assert.rejects(generateMedicalSummary(sources, { client: badEvidenceClient, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } }), { code: 'GROQ_SOURCE_EVIDENCE_INVALID' })
  const multilineSources = [{ id: 'source-a', text: 'Hemoglobin\n13.2   g/dL', verification: 'unconfirmed-ai-extraction' }]
  const paraphraseClient = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ ...data, keyPoints: [{ ...data.keyPoints[0], text: 'The patient has a hemoglobin level of 13.2.' , evidence: 'Hemoglobin 13.2 g/dL' }] }) } }] }) } } }
  const grounded = await generateMedicalSummary(multilineSources, { client: paraphraseClient, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } })
  assert.equal(grounded.keyPoints[0].text, 'Hemoglobin 13.2 g/dL')
  assert.deepEqual(grounded.keyPoints[0].sourceIds, ['source-a'])
  const malformedClient = { chat: { completions: { create: async () => ({ choices: [{ message: { content: '{malformed' } }] }) } } }
  await assert.rejects(generateMedicalSummary(sources, { client: malformedClient, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } }), { code: 'GROQ_MALFORMED_RESPONSE' })
  const missingFieldsClient = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ ...data, overview: undefined }) } }] }) } } }
  await assert.rejects(generateMedicalSummary(sources, { client: missingFieldsClient, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } }), { code: 'GROQ_SCHEMA_INVALID' })
})

test('Groq summary failures are normalized into safe actionable categories', async () => {
  assert.equal(classifyGroqRequestError(Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' })), 'GROQ_CONNECTION_ERROR')
  assert.equal(classifyGroqRequestError(Object.assign(new Error('rate limited'), { status: 429 })), 'GROQ_RATE_LIMITED')
  assert.equal(classifyGroqRequestError(Object.assign(new Error('bad credentials'), { status: 401 })), 'GROQ_AUTH_FAILED')
  assert.equal(classifyGroqRequestError(Object.assign(new Error('timeout'), { status: 504 })), 'GROQ_TIMEOUT')
  const client = { chat: { completions: { create: async () => { throw Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' }) } } } }
  await assert.rejects(generateMedicalSummary([{ id: 'synthetic', text: 'Synthetic report data' }], { client, env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-20b' } }), { code: 'GROQ_CONNECTION_ERROR' })
})
