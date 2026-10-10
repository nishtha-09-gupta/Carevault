async function request(path, options = {}) {
  const response = await fetch('/api/medical-records' + path, {
    ...options,
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  })
  const payload = await response.json().catch(() => ({}))
  if (response.status === 404 && payload.error === 'API route not found.') {
    throw new Error('The CareVault backend is running an older build. Restart it with “npm --prefix backend run dev”, then refresh this page.')
  }
  if (!response.ok) throw new Error(payload.error || 'The medical record request failed.')
  return payload
}

export async function fetchMedicalRecords(signal) {
  return request('/', { signal })
}
export async function saveMedicalRecord(record) {
  const path = record.id ? `/${encodeURIComponent(record.id)}` : ''
  const payload = await request(path, { method: record.id ? 'PUT' : 'POST', body: JSON.stringify(record) })
  return payload.record
}
export async function deleteMedicalRecord(id) {
  return request(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export async function fetchTimeline(signal) {
  const payload = await request('/timeline', { signal })
  return payload
}
