import { apiUrl } from './apiUrl.js'

const DOCUMENTS_URL = apiUrl('/api/documents')

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'The document request failed. Please try again.')
  }
  return payload
}

async function apiRequest(url, options = {}) {
  const timeoutSignal = AbortSignal.timeout(30000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal
  try {
    return await readJson(await fetch(url, { credentials: 'include', ...options, signal }))
  } catch (error) {
    // Caller aborts (for example React StrictMode effect cleanup or navigation)
    // must stay identifiable so page handlers can ignore them. Only the timeout
    // signal should become the user-facing timeout error.
    if (error.name === 'TimeoutError') {
      throw new Error('The CareVault API request timed out. Check the server connection and retry.')
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the CareVault API. Start the backend and check its MongoDB connection.')
    }
    throw error
  }
}

function analysisFrom(payload, { requireId = false } = {}) {
  const analysis = payload?.analysis
  if (!analysis || !['pending', 'processing', 'completed', 'failed', 'not_requested'].includes(analysis.status) || (requireId && !analysis.id)) {
    throw new Error('The CareVault API returned an invalid analysis status. Refresh the page and retry.')
  }
  return analysis
}

export async function fetchDocuments(signal) {
  const payload = await apiRequest(DOCUMENTS_URL, { signal })
  return payload.documents
}

export async function uploadDocument(file, onProgress, metadata = {}) {
  const data = new FormData()
  data.append('document', file)
  if (metadata.category) data.append('category', metadata.category)
  if (metadata.eventDate) data.append('eventDate', metadata.eventDate)

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', DOCUMENTS_URL)
    request.withCredentials = true
    request.responseType = 'json'
    request.timeout = 120000
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      const payload = request.response || {}
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload.error || 'The document could not be uploaded.'))
        return
      }
      resolve(payload.document)
    })
    request.addEventListener('error', () => reject(new Error('Network error while uploading. Check that the API server is running.')))
    request.addEventListener('timeout', () => reject(new Error('The upload timed out. Check the server and try again.')))
    request.addEventListener('abort', () => reject(new Error('The upload was cancelled.')))
    request.send(data)
  })
}

export async function fetchDocument(id) {
  const payload = await apiRequest(DOCUMENTS_URL + '/' + encodeURIComponent(id))
  return payload.document
}

export async function fetchDocumentFile(id) {
  let response
  try {
    response = await fetch(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/file`, { credentials: 'include' })
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Could not reach the CareVault API. Start the backend and check its MongoDB connection.')
    throw error
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'The document could not be opened.')
  }
  return response.blob()
}

export async function removeDocument(id) {
  return apiRequest(DOCUMENTS_URL + '/' + encodeURIComponent(id), { method: 'DELETE' })
}

export async function fetchDocumentAnalysis(id) {
  const payload = await apiRequest(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/analysis`)
  return analysisFrom(payload)
}

export async function startDocumentAnalysis(id, { reanalyze = false } = {}) {
  const payload = await apiRequest(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reanalyze }) })
  return analysisFrom(payload, { requireId: true })
}

export async function saveDocumentAnalysisReview(id, analysisId, result) {
  const payload = await apiRequest(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/analysis/${encodeURIComponent(analysisId)}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result }) })
  return payload.analysis
}

export async function confirmDocumentAnalysis(id, analysisId, result) {
  return apiRequest(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/analysis/${encodeURIComponent(analysisId)}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result }) })
}

export async function retryDocumentAnalysis(id) {
  const payload = await apiRequest(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/analysis/retry`, { method: 'POST' })
  return payload.analysis
}
