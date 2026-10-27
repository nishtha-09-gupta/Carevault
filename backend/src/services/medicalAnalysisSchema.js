import { z } from 'zod'

const evidence = z.string().trim().max(500).nullable()
const reportDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
}).nullable()
const Test = z.object({
  name: z.string().trim().min(1).max(180), nameEvidence: evidence,
  value: z.string().trim().max(120).nullable(), valueEvidence: evidence,
  unit: z.string().trim().max(60).nullable(), unitEvidence: evidence,
  referenceRange: z.string().trim().max(120).nullable(), referenceRangeEvidence: evidence,
  abnormalFlag: z.enum(['high', 'low', 'positive', 'negative', 'abnormal', 'normal']).nullable(), abnormalFlagEvidence: evidence,
}).strict()
const Finding = z.object({ text: z.string().trim().min(1).max(1000), evidence }).strict()
export const MedicalAnalysisResult = z.object({
  reportDate,
  reportDateEvidence: evidence,
  findings: z.array(Finding).max(40),
  tests: z.array(Test).max(100),
}).strict()

export const medicalAnalysisJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    reportDate: { type: ['string', 'null'] }, reportDateEvidence: { type: ['string', 'null'] },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, evidence: { type: ['string', 'null'] } }, required: ['text', 'evidence'] } },
    tests: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      name: { type: 'string' }, nameEvidence: { type: ['string', 'null'] },
      value: { type: ['string', 'null'] }, valueEvidence: { type: ['string', 'null'] },
      unit: { type: ['string', 'null'] }, unitEvidence: { type: ['string', 'null'] },
      referenceRange: { type: ['string', 'null'] }, referenceRangeEvidence: { type: ['string', 'null'] },
      abnormalFlag: { type: ['string', 'null'], enum: ['high', 'low', 'positive', 'negative', 'abnormal', 'normal', null] }, abnormalFlagEvidence: { type: ['string', 'null'] },
    }, required: ['name', 'nameEvidence', 'value', 'valueEvidence', 'unit', 'unitEvidence', 'referenceRange', 'referenceRangeEvidence', 'abnormalFlag', 'abnormalFlagEvidence'] } },
  }, required: ['reportDate', 'reportDateEvidence', 'findings', 'tests'],
}

function hasSourceEvidence(text, claim, quote) {
  if (claim === null) return quote === null
  if (typeof quote !== 'string' || !quote.trim()) return false
  const normalize = (value) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
  return normalize(text).includes(normalize(quote)) && normalize(quote).includes(normalize(claim))
}

export function validateGroundedAnalysis(value, sourceText) {
  const parsed = MedicalAnalysisResult.parse(value)
  if (!hasSourceEvidence(sourceText, parsed.reportDate, parsed.reportDateEvidence)) parsed.reportDate = null, parsed.reportDateEvidence = null
  parsed.findings = parsed.findings.filter((finding) => hasSourceEvidence(sourceText, finding.text, finding.evidence))
  parsed.tests = parsed.tests.filter((test) => hasSourceEvidence(sourceText, test.name, test.nameEvidence)).map((test) => {
    for (const field of ['value', 'unit', 'referenceRange', 'abnormalFlag']) {
      const evidenceField = field + 'Evidence'
      if (!hasSourceEvidence(sourceText, test[field], test[evidenceField])) test[field] = null, test[evidenceField] = null
    }
    return test
  })
  return parsed
}
