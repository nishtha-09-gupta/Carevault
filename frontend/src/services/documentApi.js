const DOCUMENTS_URL = '/api/documents'

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'The document request failed. Please try again.')
  }
  return payload
}

async function apiRequest(url, options) {
  try {
    return await readJson(await fetch(url, options))
  } catch (error) {
    if (error.name === 'AbortError') throw error
    if (error instanceof TypeError) {
      throw new Error('Could not reach the CareVault API. Start the backend and check its MongoDB connection.')
    }
    throw error
  }
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
    response = await fetch(`${DOCUMENTS_URL}/${encodeURIComponent(id)}/file`, { credentials: 'same-origin' })
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
