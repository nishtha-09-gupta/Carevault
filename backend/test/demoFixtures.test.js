import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadVerifiedDemoFixtures } from '../src/services/demoPatientData.js'

test('all checked-in demo PDFs match the reviewed synthetic fixture allowlist before upload', async () => {
  const fixtures = await loadVerifiedDemoFixtures()
  assert.equal(fixtures.size, 9)
  for (const [filename, buffer] of fixtures) {
    assert.ok(filename.endsWith('.pdf'))
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
  }
})
