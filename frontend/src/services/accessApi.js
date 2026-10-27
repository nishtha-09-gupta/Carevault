import { apiUrl } from './apiUrl'

async function request(path, options = {}) {
  const response = await fetch(apiUrl('/api/access' + path), {
    ...options,
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The access request could not be completed.')
  return payload
}

export async function findDoctors(query) {
  const payload = await request('/doctors?q=' + encodeURIComponent(query))
  return payload.doctors
}

export async function fetchAccessGrants() {
  const payload = await request('/')
  return payload.grants
}

export async function fetchDoctorPatients() {
  const response = await fetch(apiUrl('/api/doctor/patients'), { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The patient list could not be loaded.')
  return payload.patients
}

export async function fetchDoctorPatientAccess(patientId) {
  const response = await fetch(apiUrl(`/api/doctor/patients/${encodeURIComponent(patientId)}`), { credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  // An already-running API process may predate the newer detail route. The
  // patient list endpoint is older and still returns only active grants.
  if (response.status === 404 && payload.error === 'API route not found.') {
    const activePatients = await fetchDoctorPatients()
    const active = activePatients.find((entry) => entry.patient.id === patientId)
    if (active) return active
    throw new Error('This patient has not granted your account active access.')
  }
  if (!response.ok) throw new Error(payload.error || 'Patient access could not be checked.')
  return payload.access
}

export async function grantDoctorAccess(doctorId, durationHours) {
  const payload = await request('/', { method: 'POST', body: JSON.stringify({ doctorId, durationHours }) })
  return payload.grant
}

export async function revokeDoctorAccess(grantId) {
  const payload = await request('/' + encodeURIComponent(grantId), { method: 'DELETE' })
  return payload.grant
}

async function patientDocumentsRequest(patientId, suffix = '') {
  let response = await fetch(apiUrl(`/api/doctor/patients/${encodeURIComponent(patientId)}/documents${suffix}`), { credentials: 'include' })
  if (response.status === 404) {
    const payload = await response.clone().json().catch(() => ({}))
    if (payload.error === 'API route not found.') {
      // Legacy route performs the same doctor, patient, owner, and expiry checks.
      response = await fetch(apiUrl(`/api/patients/${encodeURIComponent(patientId)}/documents${suffix}`), { credentials: 'include' })
    }
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || 'The shared documents could not be loaded.')
  }
  return response
}

export async function fetchPatientDocuments(patientId) {
  const response = await patientDocumentsRequest(patientId)
  const payload = await response.json()
  return payload.documents
}

export async function fetchPatientDocumentFile(patientId, documentId) {
  const response = await patientDocumentsRequest(patientId, `/${encodeURIComponent(documentId)}/file`)
  return response.blob()
}

export async function fetchSharedDocumentAnalysis(patientId, documentId) {
  const response = await patientDocumentsRequest(patientId, `/${encodeURIComponent(documentId)}/analysis`)
  const payload = await response.json()
  return payload.analysis
}

async function doctorPatientRequest(patientId, suffix, options = {}) {
  const { timeoutMs = 30000, ...requestOptions } = options
  let response
  try {
    response = await fetch(apiUrl(`/api/doctor/patients/${encodeURIComponent(patientId)}${suffix}`), {
      ...requestOptions, credentials: 'include', signal: requestOptions.signal || AbortSignal.timeout(timeoutMs),
      headers: requestOptions.body ? { 'Content-Type': 'application/json', ...requestOptions.headers } : requestOptions.headers,
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('The request timed out. Check your connection, refresh the status, and retry if needed.')
    throw error
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The patient request could not be completed.')
  return payload
}

export async function startSharedDocumentAnalysis(patientId, documentId) {
  const payload = await doctorPatientRequest(patientId, `/documents/${encodeURIComponent(documentId)}/analysis`, { method: 'POST', body: '{}' })
  return payload.analysis
}

export async function retrySharedDocumentAnalysis(patientId, documentId) {
  const payload = await doctorPatientRequest(patientId, `/documents/${encodeURIComponent(documentId)}/analysis/retry`, { method: 'POST', body: '{}' })
  return payload.analysis
}

export async function fetchPatientSummary(patientId) {
  return doctorPatientRequest(patientId, '/summary')
}

export async function generatePatientSummary(patientId, { refresh = false } = {}) {
  return doctorPatientRequest(patientId, '/summary', { method: 'POST', body: JSON.stringify({ refresh }), timeoutMs: 70000 })
}

export async function fetchPatientHealthIntake(patientId) {
  const response = await fetch(apiUrl(`/api/doctor/patients/${encodeURIComponent(patientId)}/intake`), { credentials: 'include' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Could not load the patient health intake.')
  return body.intake
}
