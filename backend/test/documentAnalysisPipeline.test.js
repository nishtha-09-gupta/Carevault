import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeMedicalDocumentText } from '../src/services/documentAnalysisPipeline.js'
import { createMedicalDocumentChunks, hierarchicalMergeDocumentChunkResults, mergeDocumentChunkResults } from '../src/services/medicalDocumentChunking.js'
import { clearModelTokenLimitsCache, createTokenBudget, estimateTokenCount } from '../src/services/groqTokenBudget.js'
import { MedicalAnalysisResult, medicalAnalysisJsonSchema } from '../src/services/medicalAnalysisSchema.js'
import { MEDICAL_EXTRACTION_SYSTEM_PROMPT } from '../src/services/groqMedicalAnalysis.js'
import { extractDocumentText } from '../src/services/documentTextExtraction.js'

const env = { GROQ_API_KEY: 'synthetic-test-key', GROQ_MODEL: 'openai/gpt-oss-20b', GROQ_ANALYSIS_CHUNK_TOKENS: '500', GROQ_ANALYSIS_OUTPUT_TOKENS: '4096', GROQ_ANALYSIS_CHUNK_OVERLAP_TOKENS: '24', GROQ_ANALYSIS_CONCURRENCY: '2' }

function sourcePages(count, rows = 3) {
  return Array.from({ length: count }, (_, page) => `[[PAGE ${page + 1}]]\nSynthetic lab panel page ${page + 1}.\n${Array.from({ length: rows }, (_, row) => `Marker-${page + 1}-${row + 1}: ${100 + row} units`).join('\n')}`).join('\n')
}

function responseFor(text) {
  const tests = [...text.matchAll(/(Marker-([\w-]+)):\s*(\d+)\s+(units)/g)].map((match) => ({
    name: match[1], nameEvidence: match[1], value: match[3], valueEvidence: `${match[1]}: ${match[3]}`,
    unit: match[4], unitEvidence: match[4], referenceRange: null, referenceRangeEvidence: null,
    abnormalFlag: null, abnormalFlagEvidence: null, reportDate: null, reportDateEvidence: null,
    pageNumber: Number(match[2].match(/^([0-9]+)/)?.[1] || text.match(/\[\[PAGE\s+(\d+)\]\]/)?.[1] || 1),
  }))
  return { documentType: null, documentTypeEvidence: null, documentTitle: null, documentTitleEvidence: null, category: null, categoryEvidence: null, provider: null, providerEvidence: null, patientInformation: [], reportDate: null, reportDateEvidence: null, findings: [], tests, medications: [], sections: [], details: [] }
}

function clientFor({ beforeResponse, response = responseFor } = {}) {
  const calls = []
  return {
    calls,
    models: { list: async () => ({ data: [{ id: env.GROQ_MODEL, context_window: 131072, max_completion_tokens: 65536 }] }) },
    chat: { completions: { create: async (request) => {
      const text = request.messages[1].content
      calls.push(text)
      const result = await beforeResponse?.(text, calls.length)
      if (result?.throw) throw result.throw
      return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result?.response || response(text)) } }], usage: { prompt_tokens: estimateTokenCount(text), completion_tokens: 100 } }
    } } },
  }
}

function syntheticPdf(pageCount, rows = 3) {
  const objects = []
  const pageRefs = Array.from({ length: pageCount }, (_, index) => `${4 + index * 2} 0 R`).join(' ')
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (let page = 0; page < pageCount; page += 1) {
    const pageObject = 4 + page * 2
    const contentObject = pageObject + 1
    const content = `BT /F1 10 Tf 40 750 Td (Synthetic lab page ${page + 1}. ${Array.from({ length: rows }, (_, row) => `Marker-${page + 1}-${row + 1}: ${100 + row} units`).join(' ')}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`)
    objects.push(`<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`)
  }
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'ascii')
}

test('model token budget uses live model metadata and accounts for prompt, schema, output, and text', async () => {
  clearModelTokenLimitsCache()
  const client = clientFor()
  const limits = await client.models.list().then((response) => response.data[0])
  const budget = createTokenBudget({ systemPrompt: MEDICAL_EXTRACTION_SYSTEM_PROMPT, schema: medicalAnalysisJsonSchema, modelLimits: { contextWindow: limits.context_window, maxCompletionTokens: limits.max_completion_tokens }, env })
  const input = '[[PAGE 1]]\n' + 'Synthetic CBC marker: 13.2 g/dL. '.repeat(100)
  assert.ok(estimateTokenCount(input) > 0)
  assert.ok(budget.estimatedRequestTokens(input) < limits.context_window)
  assert.equal(budget.chunkTokens, 500)
  assert.equal(budget.outputTokens, 4096)
})

test('1, 19, 50 and 100-page synthetic digital PDFs preserve page markers and extracted rows', async (t) => {
  for (const [pages, rows] of [[1, 3], [19, 3], [50, 3], [100, 3]]) {
    await t.test(`${pages} pages`, async () => {
      clearModelTokenLimitsCache()
      const pdf = syntheticPdf(pages, rows)
      const sourceText = await extractDocumentText(pdf, 'application/pdf')
      assert.equal([...sourceText.matchAll(/\[\[PAGE\s+\d+\]\]/g)].length, pages)
      const client = clientFor()
      const updates = []
      const outcome = await analyzeMedicalDocumentText(sourceText, { client, env, concurrency: 2, onProgress: (progress) => updates.push(progress.progress) })
      assert.equal(outcome.progress.failed, 0)
      assert.equal(outcome.progress.completed, outcome.progress.total)
      assert.equal(outcome.result.tests.length, pages * rows)
      assert.equal(new Set(outcome.result.tests.map((item) => item.pageNumber)).size, pages)
      assert.ok(updates.length > outcome.progress.total)
      assert.ok(client.calls.every((chunk) => /\[\[PAGE\s+\d+\]\]/.test(chunk)))
    })
  }
})

test('oversized page is split on row boundaries with overlap and no source lines lost', () => {
  const lines = Array.from({ length: 90 }, (_, index) => `LongMarker-${index}: ${index + 1} units; reference range ${index}-${index + 10}.`)
  const source = `[[PAGE 7]]\n${lines.join('\n')}`
  const chunks = createMedicalDocumentChunks(source, { maxTokens: 256, overlapTokens: 20 })
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.pageStart === 7 && chunk.pageEnd === 7))
  assert.ok(chunks.every((chunk) => chunk.estimatedInputTokens <= 256))
  for (const line of lines) assert.ok(chunks.some((chunk) => chunk.text.includes(line)), `missing source row ${line}`)
})

test('page gaps retain original page numbers rather than renumbering source references', () => {
  const chunks = createMedicalDocumentChunks('[[PAGE 1]]\nFirst page.\n[[PAGE 3]]\nThird page.', { maxTokens: 256 })
  assert.equal(chunks.length, 1)
  assert.match(chunks[0].text, /\[\[PAGE 1\]\]/)
  assert.match(chunks[0].text, /\[\[PAGE 3\]\]/)
  assert.equal(chunks[0].pageEnd, 3)
})

test('large table rows stay together, repeated overlapping findings deduplicate, and date conflicts remain explicit', () => {
  const rows = '[[PAGE 1]]\nA: 1 units\nB: 2 units\nA: 1 units\nB: 2 units'
  const chunks = createMedicalDocumentChunks(rows, { maxTokens: 256, overlapTokens: 20 })
  assert.equal(chunks.length, 1)
  const merged = mergeDocumentChunkResults([
    { ...responseFor('[[PAGE 1]]\nMarker-1: 100 units'), reportDate: '1 Jan 2026', reportDateEvidence: '1 Jan 2026', findings: [{ text: 'Same supported finding', evidence: 'Same supported finding', pageNumber: 1 }] },
    { ...responseFor('[[PAGE 1]]\nMarker-1: 100 units'), reportDate: '2 Jan 2026', reportDateEvidence: '2 Jan 2026', findings: [{ text: 'Same supported finding', evidence: 'Same supported finding', pageNumber: 1 }] },
  ])
  assert.equal(merged.findings.length, 1)
  assert.equal(merged.reportDate, null)
  assert.equal(merged.details.filter((item) => item.label === 'Conflicting report date').length, 2)
  const conflictingFindings = hierarchicalMergeDocumentChunkResults(Array.from({ length: 40 }, (_, index) => ({
    ...responseFor(`[[PAGE ${index + 1}]]\nMarker-${index}: 100 units`),
    findings: [{ text: index % 2 ? 'Finding A' : 'Finding B', evidence: index % 2 ? 'Finding A' : 'Finding B', pageNumber: index + 1 }],
  })), { fanIn: 4 })
  assert.equal(conflictingFindings.findings.length, 40)
  assert.equal(conflictingFindings.findings[0].text, 'Finding B')
  assert.equal(conflictingFindings.findings[1].text, 'Finding A')
})

test('aggregation keeps dated repeat measurements and conflicting page-cited findings', () => {
  const sameTest = (value, date, page) => ({
    name: 'Hemoglobin', nameEvidence: 'Hemoglobin', value, valueEvidence: `Hemoglobin ${value}`,
    unit: 'g/dL', unitEvidence: 'g/dL', referenceRange: '12–16', referenceRangeEvidence: '12–16',
    abnormalFlag: null, abnormalFlagEvidence: null, reportDate: date, reportDateEvidence: date, pageNumber: page,
  })
  const merged = mergeDocumentChunkResults([
    { ...responseFor(''), tests: [sameTest('13.1', '12 Oct 2026', 2)], findings: [{ text: 'No acute finding', evidence: 'No acute finding', pageNumber: 2 }] },
    { ...responseFor(''), tests: [sameTest('13.1', '13 Oct 2026', 7)], findings: [{ text: 'Acute finding noted', evidence: 'Acute finding noted', pageNumber: 7 }] },
  ])
  assert.equal(merged.tests.length, 2)
  assert.deepEqual(merged.tests.map((test) => [test.reportDate, test.pageNumber, test.unit, test.referenceRange]), [['12 Oct 2026', 2, 'g/dL', '12–16'], ['13 Oct 2026', 7, 'g/dL', '12–16']])
  assert.deepEqual(merged.findings.map((finding) => [finding.text, finding.pageNumber]), [['No acute finding', 2], ['Acute finding noted', 7]])
})

test('provider Retry-After defers a rate-limited chunk to the persisted job retry', async () => {
  clearModelTokenLimitsCache()
  const client = clientFor({ beforeResponse: async () => ({ throw: Object.assign(new Error('rate limited'), { status: 429, headers: { 'retry-after': '12' } }) }) })
  const error = await analyzeMedicalDocumentText('[[PAGE 1]]\nSynthetic report value: 12 units.', { client, env: { ...env, GROQ_ANALYSIS_CHUNK_TOKENS: '500' }, concurrency: 1, sleepFn: async () => { throw new Error('must not sleep inline on 429') } }).catch((caught) => caught)
  assert.equal(error.code, 'GROQ_CHUNK_FAILED')
  assert.equal(error.retryAfterMs, 12000)
  assert.equal(error.progress.failed, 1)
  assert.equal(client.calls.length, 1)
  assert.ok(error.chunks[0].retryAt instanceof Date)
  const resumeClient = clientFor()
  const resumed = await analyzeMedicalDocumentText('[[PAGE 1]]\nSynthetic report value: 12 units.', { client: resumeClient, env: { ...env, GROQ_ANALYSIS_CHUNK_TOKENS: '500' }, existingChunks: error.chunks, existingSourceTextHash: error.sourceTextHash, concurrency: 1 }).catch((caught) => caught)
  assert.equal(resumed.code, 'GROQ_CHUNK_FAILED')
  assert.equal(resumeClient.calls.length, 0)
  assert.ok(resumed.retryAfterMs > 0)
})

test('adaptive subdivision handles an oversized request and retries transient chunk failures', async () => {
  clearModelTokenLimitsCache()
  let oversizedFirstRequest = true
  let rateLimitOnce = true
  const client = clientFor({ beforeResponse: async (text) => {
    if (estimateTokenCount(text) > 350 && oversizedFirstRequest) {
      oversizedFirstRequest = false
      return { throw: Object.assign(new Error('request too large'), { status: 413 }) }
    }
    if (rateLimitOnce) {
      rateLimitOnce = false
      return { throw: Object.assign(new Error('temporary failure'), { status: 503 }) }
    }
    return null
  } })
  const outcome = await analyzeMedicalDocumentText(`[[PAGE 1]]\n${Array.from({ length: 80 }, (_, index) => `Marker-1-${index}: ${index + 1} units`).join('\n')}`, { client, env: { ...env, GROQ_ANALYSIS_CHUNK_TOKENS: '500' }, sleepFn: async () => {} })
  assert.equal(outcome.progress.failed, 0)
  assert.ok(outcome.progress.total > 1)
  assert.ok(client.calls.length > outcome.progress.total)
})

test('strict-schema output truncation from Groq triggers smaller source chunks', async () => {
  clearModelTokenLimitsCache()
  let rejected = false
  const client = clientFor({ beforeResponse: async (text) => {
    if (!rejected && estimateTokenCount(text) > 350) {
      rejected = true
      return { throw: Object.assign(new Error('Bad Request'), { status: 400, error: { message: 'max completion tokens reached before generating a valid document: the output was truncated to fit max_completion_tokens and is missing required content; json_validate_failed' } }) }
    }
    return null
  } })
  const outcome = await analyzeMedicalDocumentText(`[[PAGE 1]]\n${Array.from({ length: 80 }, (_, index) => `Marker-1-${index}: ${index + 1} units`).join('\n')}`, { client, env: { ...env, GROQ_ANALYSIS_CHUNK_TOKENS: '500' }, sleepFn: async () => {} })
  assert.equal(outcome.progress.failed, 0)
  assert.ok(outcome.progress.total > 1)
  assert.ok(client.calls.length > 1)
})

test('a failed chunk prevents a completed document result and retry reuses completed chunks', async () => {
  clearModelTokenLimitsCache()
  const sourceText = sourcePages(3, 20)
  const calls = new Map()
  const client = clientFor({ beforeResponse: async (text) => {
    const page = Number(text.match(/\[\[PAGE\s+(\d+)\]\]/)?.[1] || 1)
    calls.set(page, (calls.get(page) || 0) + 1)
    if (page === 2 && calls.get(page) <= 3) return { throw: Object.assign(new Error('temporary'), { status: 503 }) }
    return null
  } })
  const constrainedEnv = { ...env, GROQ_ANALYSIS_CHUNK_TOKENS: '256' }
  const first = await analyzeMedicalDocumentText(sourceText, { client, env: constrainedEnv, sleepFn: async () => {} }).catch((error) => error)
  assert.equal(first.code, 'GROQ_CHUNK_FAILED')
  assert.equal(first.retryable, true)
  // Keep a completed chunk and make the failed chunk succeed on the next job attempt.
  const partial = first.chunks || []
  const secondClient = clientFor()
  const result = await analyzeMedicalDocumentText(sourceText, { client: secondClient, env: constrainedEnv, existingChunks: partial, existingSourceTextHash: first.sourceTextHash, sleepFn: async () => {} })
  assert.equal(result.progress.failed, 0)
  assert.equal(result.result.tests.length, 60)
  assert.ok(secondClient.calls.length < result.progress.total)
})

test('strict document result rejects aggregation overflow instead of dropping extracted facts', () => {
  const tooMany = Array.from({ length: 2001 }, (_, index) => ({ name: `Marker-${index}`, value: '1', pageNumber: 1 }))
  const merged = mergeDocumentChunkResults([{ ...responseFor(''), tests: tooMany }])
  assert.throws(() => MedicalAnalysisResult.parse(merged))
})
