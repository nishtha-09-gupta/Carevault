import { z } from 'zod'

const nullableText = (limit = 4000) => z.preprocess((value) => typeof value === 'string' && !value.trim() ? null : value, z.string().trim().max(limit).nullable().default(null))
const pageNumber = z.number().int().min(1).max(100).nullable().default(null)
const evidence = nullableText(4000)

const Test = z.object({
  name: z.string().trim().min(1).max(500), nameEvidence: evidence,
  value: nullableText(1000), valueEvidence: evidence,
  unit: nullableText(300), unitEvidence: evidence,
  referenceRange: nullableText(1000), referenceRangeEvidence: evidence,
  abnormalFlag: nullableText(300), abnormalFlagEvidence: evidence,
  reportDate: nullableText(200), reportDateEvidence: evidence,
  pageNumber,
}).strict()

const Finding = z.object({ text: z.string().trim().min(1).max(4000), evidence, pageNumber }).strict()
const Section = z.object({
  type: z.string().trim().min(1).max(100),
  title: nullableText(500), titleEvidence: evidence,
  text: z.string().trim().min(1).max(4000), evidence,
  pageNumber,
}).strict()
const Medication = z.object({
  name: z.string().trim().min(1).max(500), nameEvidence: evidence,
  dosage: nullableText(1000), dosageEvidence: evidence,
  route: nullableText(500), routeEvidence: evidence,
  frequency: nullableText(1000), frequencyEvidence: evidence,
  duration: nullableText(1000), durationEvidence: evidence,
  instructions: nullableText(2000), instructionsEvidence: evidence,
  pageNumber,
}).strict()
const PatientInformation = z.object({ label: z.string().trim().min(1).max(500), value: z.string().trim().min(1).max(2000), evidence, pageNumber }).strict()
const Detail = z.object({ label: z.string().trim().min(1).max(500), value: z.string().trim().min(1).max(4000), evidence, pageNumber }).strict()

// Defaults keep older persisted analyses and clients compatible while the Groq
// JSON Schema below requires an explicit value for each field.
export const MedicalAnalysisResult = z.object({
  documentType: nullableText(120), documentTypeEvidence: evidence,
  documentTitle: nullableText(500), documentTitleEvidence: evidence,
  category: nullableText(200), categoryEvidence: evidence,
  provider: nullableText(500), providerEvidence: evidence,
  patientInformation: z.array(PatientInformation).max(2000).default([]),
  reportDate: nullableText(200), reportDateEvidence: evidence,
  findings: z.array(Finding).max(2000).default([]),
  tests: z.array(Test).max(2000).default([]),
  medications: z.array(Medication).max(2000).default([]),
  sections: z.array(Section).max(2000).default([]),
  details: z.array(Detail).max(2000).default([]),
}).strict()

const nullableString = { type: ['string', 'null'] }
const evidenceString = { type: ['string', 'null'] }
const optionalPage = { type: ['integer', 'null'] }
const closed = (properties) => ({
  type: 'object', additionalProperties: false, properties, required: Object.keys(properties),
})

export const medicalAnalysisJsonSchema = closed({
  documentType: nullableString, documentTypeEvidence: evidenceString,
  documentTitle: nullableString, documentTitleEvidence: evidenceString,
  category: nullableString, categoryEvidence: evidenceString,
  provider: nullableString, providerEvidence: evidenceString,
  patientInformation: { type: 'array', items: closed({ label: { type: 'string' }, value: { type: 'string' }, evidence: evidenceString, pageNumber: optionalPage }) },
  reportDate: nullableString, reportDateEvidence: evidenceString,
  findings: { type: 'array', items: closed({ text: { type: 'string' }, evidence: evidenceString, pageNumber: optionalPage }) },
  tests: { type: 'array', items: closed({
    name: { type: 'string' }, nameEvidence: evidenceString,
    value: nullableString, valueEvidence: evidenceString,
    unit: nullableString, unitEvidence: evidenceString,
    referenceRange: nullableString, referenceRangeEvidence: evidenceString,
    abnormalFlag: nullableString, abnormalFlagEvidence: evidenceString,
    reportDate: nullableString, reportDateEvidence: evidenceString,
    pageNumber: optionalPage,
  }) },
  medications: { type: 'array', items: closed({
    name: { type: 'string' }, nameEvidence: evidenceString,
    dosage: nullableString, dosageEvidence: evidenceString,
    route: nullableString, routeEvidence: evidenceString,
    frequency: nullableString, frequencyEvidence: evidenceString,
    duration: nullableString, durationEvidence: evidenceString,
    instructions: nullableString, instructionsEvidence: evidenceString,
    pageNumber: optionalPage,
  }) },
  sections: { type: 'array', items: closed({
    type: { type: 'string' }, title: nullableString, titleEvidence: evidenceString,
    text: { type: 'string' }, evidence: evidenceString, pageNumber: optionalPage,
  }) },
  details: { type: 'array', items: closed({ label: { type: 'string' }, value: { type: 'string' }, evidence: evidenceString, pageNumber: optionalPage }) },
})

function comparable(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\u00a0]+/g, ' ').trim()
}

function hasSourceEvidence(sourceText, claim, quote) {
  if (claim === null) return quote === null
  if (typeof quote !== 'string' || !quote.trim()) return false
  return comparable(sourceText).includes(comparable(quote)) && comparable(quote).includes(comparable(claim))
}

function evidenceForPage(sourceText, quote, page) {
  if (!Number.isInteger(page)) return null
  const marker = `[[PAGE ${page}]]`
  const start = sourceText.indexOf(marker)
  if (start < 0) return null
  const end = sourceText.indexOf('[[PAGE ', start + marker.length)
  const pageText = sourceText.slice(start + marker.length, end < 0 ? undefined : end)
  return comparable(pageText).includes(comparable(quote)) ? page : null
}

function groundedField(item, field, evidenceField, sourceText) {
  if (!hasSourceEvidence(sourceText, item[field], item[evidenceField])) {
    item[field] = null
    item[evidenceField] = null
  }
}

function groundedClassification(item, field, evidenceField, sourceText) {
  // These are document labels, not clinical assertions. They may normalize an
  // explicit source heading (for example, "CBC") to a readable type ("blood
  // count"), but the cited basis must still be an exact excerpt from the file.
  const quote = item[evidenceField]
  if (item[field] === null || typeof quote !== 'string' || !quote.trim() || !comparable(sourceText).includes(comparable(quote))) {
    item[field] = null
    item[evidenceField] = null
  }
}

function validatePage(item, sourceText, evidenceField = 'evidence') {
  if (item.pageNumber !== null) item.pageNumber = evidenceForPage(sourceText, item[evidenceField], item.pageNumber)
}

export function validateGroundedAnalysis(value, sourceText) {
  const parsed = MedicalAnalysisResult.parse(value)
  groundedClassification(parsed, 'documentType', 'documentTypeEvidence', sourceText)
  groundedClassification(parsed, 'category', 'categoryEvidence', sourceText)
  for (const [field, evidenceField] of [
    ['documentTitle', 'documentTitleEvidence'], ['provider', 'providerEvidence'], ['reportDate', 'reportDateEvidence'],
  ]) groundedField(parsed, field, evidenceField, sourceText)

  parsed.patientInformation = parsed.patientInformation.flatMap((item) => {
    if (!hasSourceEvidence(sourceText, item.value, item.evidence) || !hasSourceEvidence(sourceText, item.label, item.evidence)) return []
    validatePage(item, sourceText)
    return [item]
  })
  parsed.findings = parsed.findings.flatMap((item) => {
    if (!hasSourceEvidence(sourceText, item.text, item.evidence)) return []
    validatePage(item, sourceText)
    return [item]
  })
  parsed.tests = parsed.tests.flatMap((item) => {
    if (!hasSourceEvidence(sourceText, item.name, item.nameEvidence)) return []
    for (const field of ['value', 'unit', 'referenceRange', 'abnormalFlag', 'reportDate']) groundedField(item, field, `${field}Evidence`, sourceText)
    validatePage(item, sourceText, 'nameEvidence')
    return [item]
  })
  parsed.medications = parsed.medications.flatMap((item) => {
    if (!hasSourceEvidence(sourceText, item.name, item.nameEvidence)) return []
    for (const field of ['dosage', 'route', 'frequency', 'duration', 'instructions']) groundedField(item, field, `${field}Evidence`, sourceText)
    validatePage(item, sourceText, 'nameEvidence')
    return [item]
  })
  parsed.sections = parsed.sections.flatMap((item) => {
    if (!hasSourceEvidence(sourceText, item.text, item.evidence)) return []
    groundedField(item, 'title', 'titleEvidence', sourceText)
    validatePage(item, sourceText)
    return [item]
  })
  parsed.details = parsed.details.flatMap((item) => {
    if (!hasSourceEvidence(sourceText, item.value, item.evidence) || !hasSourceEvidence(sourceText, item.label, item.evidence)) return []
    validatePage(item, sourceText)
    return [item]
  })
  return parsed
}
