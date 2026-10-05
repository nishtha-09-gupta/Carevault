async function request(path, options = {}) {
  const response = await fetch('/api/access' + path, {
    ...options,
    credentials: 'same-origin',
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
  const response = await fetch('/api/doctor/patients', { credentials: 'same-origin' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The patient list could not be loaded.')
  return payload.patients
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
  const response = await fetch(`/api/doctor/patients/${encodeURIComponent(patientId)}/documents${suffix}`, { credentials: 'same-origin' })
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
