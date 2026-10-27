import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchDocumentAnalysis } from '../src/services/documentApi.js'

test('document API requests without options still receive credentials and timeout cancellation', async () => {
  const originalFetch = globalThis.fetch
  let request
  try {
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return Response.json({ analysis: { id: 'analysis-1', status: 'pending', result: null, confirmed: false } })
    }

    const analysis = await fetchDocumentAnalysis('document-1')

    assert.equal(request.url, '/api/documents/document-1/analysis')
    assert.equal(request.options.credentials, 'include')
    assert.ok(request.options.signal instanceof AbortSignal)
    assert.equal(analysis.status, 'pending')
  } finally {
    globalThis.fetch = originalFetch
  }
})
