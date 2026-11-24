import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadVerifiedDemoFixtures } from '../src/services/demoPatientData.js'
import { extractDocumentText } from '../src/services/documentTextExtraction.js'

test('all checked-in demo PDFs match the reviewed synthetic fixture allowlist before upload', async () => {
  const fixtures = await loadVerifiedDemoFixtures()
  assert.equal(fixtures.size, 9)
  for (const [filename, buffer] of fixtures) {
    assert.ok(filename.endsWith('.pdf'))
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
  }
})

test('every current demo PDF has searchable text and passes the real extraction path', async () => {
  const fixtures = await loadVerifiedDemoFixtures()
  for (const [filename, buffer] of fixtures) {
    let metrics
    const extracted = await extractDocumentText(buffer, 'application/pdf', { onMetrics: (value) => { metrics = value } })
    assert.equal(metrics.mode, 'digital-pdf', `${filename} should not depend on OCR`)
    assert.equal(metrics.ocrPages, 0, `${filename} should have embedded searchable text`)
    assert.ok(extracted.replace(/\[\[PAGE \d+\]\]/g, '').replace(/[^\p{L}\p{N}]/gu, '').length > 40, `${filename} should contain usable report text`)
  }
})
