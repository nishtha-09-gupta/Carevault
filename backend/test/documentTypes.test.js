import assert from 'node:assert/strict'
import { test } from 'node:test'
import { medicalAnalysisJsonSchema } from '../src/services/medicalAnalysisSchema.js'
import { analyzeMedicalText } from '../src/services/groqMedicalAnalysis.js'
import { readFile } from 'node:fs/promises'

const medicalDocumentCases = JSON.parse(await readFile(new URL('./fixtures/medicalDocumentCases.json', import.meta.url), 'utf8'))

function responseFor(fixture) {
  const result = {
    documentType: 'Synthetic', documentTypeEvidence: 'Synthetic',
    documentTitle: null, documentTitleEvidence: null, category: null, categoryEvidence: null,
    provider: null, providerEvidence: null, patientInformation: [], reportDate: null, reportDateEvidence: null,
    findings: [], tests: [], medications: [], sections: [], details: [],
  }
  if (fixture.test) {
    result.tests.push({
      name: fixture.test.name, nameEvidence: fixture.test.name,
      value: fixture.test.value, valueEvidence: fixture.test.value ? `${fixture.test.name} ${fixture.test.value}` : null,
      unit: fixture.test.unit ?? null, unitEvidence: fixture.test.unit ? fixture.test.unit : null,
      referenceRange: fixture.test.referenceRange ?? null, referenceRangeEvidence: fixture.test.referenceRange ? fixture.test.referenceRange : null,
      abnormalFlag: fixture.test.abnormalFlag ?? null, abnormalFlagEvidence: null,
      pageNumber: fixture.test.pageNumber ?? 1,
    })
  }
  if (fixture.section) result.sections.push({ ...fixture.section, titleEvidence: fixture.section.title, evidence: fixture.section.text, pageNumber: fixture.section.pageNumber ?? 1 })
  if (fixture.medication) result.medications.push({
    name: fixture.medication.name, nameEvidence: fixture.medication.name,
    dosage: fixture.medication.dosage ?? null, dosageEvidence: fixture.medication.dosage ?? null,
    route: fixture.medication.route ?? null, routeEvidence: fixture.medication.route ?? null,
    frequency: fixture.medication.frequency ?? null, frequencyEvidence: fixture.medication.frequency ?? null,
    duration: null, durationEvidence: null, instructions: null, instructionsEvidence: null, pageNumber: 1,
  })
  if (fixture.detail) result.details.push({ ...fixture.detail, evidence: `${fixture.detail.label}: ${fixture.detail.value}`, pageNumber: 1 })
  return result
}

test('strict Groq schema accepts synthetic common, narrative, unknown, scanned, and mixed report structures', async (t) => {
  const env = { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-20b' }
  for (const fixture of medicalDocumentCases) {
    await t.test(fixture.name, async () => {
      const expected = responseFor(fixture)
      let request
      const client = { models: { list: async () => ({ data: [{ id: env.GROQ_MODEL, context_window: 131072, max_completion_tokens: 65536 }] }) }, chat: { completions: { create: async (body) => {
        request = body
        return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(expected) } }] }
      } } } }
      const parsed = await analyzeMedicalText(fixture.source, { client, env })
      assert.deepEqual(request.response_format.json_schema.schema, medicalAnalysisJsonSchema)
      assert.equal(parsed.documentType, 'Synthetic')
      if (fixture.test) assert.equal(parsed.tests[0].name, fixture.test.name)
      if (fixture.section) assert.equal(parsed.sections[0].text, fixture.section.text)
      if (fixture.medication) assert.equal(parsed.medications[0].name, fixture.medication.name)
      if (fixture.detail) assert.equal(parsed.details[0].value, fixture.detail.value)
      if (fixture.kind === 'mixed') {
        assert.equal(parsed.tests[0].pageNumber, 1)
        assert.equal(parsed.sections[0].pageNumber, 2)
      }
    })
  }
})

test('nullable and unfamiliar lab fields are retained without coercing missing values to zero', async () => {
  const fixture = { source: 'Synthetic report. Unusual marker ZX-91: detected.', test: { name: 'ZX-91', value: null } }
  const response = responseFor(fixture)
  const parsed = await analyzeMedicalText(fixture.source, {
    env: { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-20b' },
    client: { models: { list: async () => ({ data: [{ id: 'openai/gpt-oss-20b', context_window: 131072, max_completion_tokens: 65536 }] }) }, chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(response) } }] }) } } },
  })
  assert.equal(parsed.tests[0].name, 'ZX-91')
  assert.equal(parsed.tests[0].value, null)
})

test('a long report with more than the former 100-test limit validates without losing unfamiliar test names', async () => {
  const count = 125
  const lines = Array.from({ length: count }, (_, index) => `Marker-${index + 1}: ${index + 10} units`)
  const source = `[[PAGE 1]]\nSynthetic extended pathology panel.\n${lines.join('\n')}`
  const tests = lines.map((line, index) => {
    const [name, rest] = line.split(': ')
    const [value, unit] = rest.split(' ')
    return { name, nameEvidence: name, value, valueEvidence: line, unit, unitEvidence: line, referenceRange: null, referenceRangeEvidence: null, abnormalFlag: null, abnormalFlagEvidence: null, pageNumber: 1 }
  })
  const raw = { documentType: 'Pathology panel', documentTypeEvidence: 'extended pathology panel', tests, findings: [], reportDate: null }
  const { validateGroundedAnalysis } = await import('../src/services/medicalAnalysisSchema.js')
  const validated = validateGroundedAnalysis(raw, source)
  assert.equal(validated.tests.length, count)
  assert.equal(validated.tests[124].name, 'Marker-125')
  assert.equal(validated.tests[124].value, '134')
})

test('invalid and truncated Groq outputs have distinct safe error codes', async () => {
  const options = { env: { GROQ_API_KEY: 'mock-key', GROQ_MODEL: 'openai/gpt-oss-20b' } }
  const models = { list: async () => ({ data: [{ id: 'openai/gpt-oss-20b', context_window: 131072, max_completion_tokens: 65536 }] }) }
  const malformed = { ...options, client: { models, chat: { completions: { create: async () => ({ choices: [{ message: { content: '{' } }] }) } } } }
  await assert.rejects(analyzeMedicalText('Synthetic report', malformed), { code: 'GROQ_INVALID_JSON' })
  const truncated = { ...options, client: { models, chat: { completions: { create: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) } } } }
  await assert.rejects(analyzeMedicalText('Synthetic report', truncated), { code: 'GROQ_RESPONSE_TRUNCATED' })
  const invalidSchema = { ...options, client: { models, chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ ...responseFor({}), stray: true }) } }] }) } } } }
  await assert.rejects(analyzeMedicalText('Synthetic report', invalidSchema), (error) => error.code === 'GROQ_SCHEMA_INVALID' && Array.isArray(error.validationIssuePaths) && JSON.stringify(error.validationIssuePaths).includes('[other]'))
})
