async function request(path, options = {}) {
  const response = await fetch(`/api/health-intake${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The health intake could not be saved.')
  return body
}

export async function fetchHealthIntake() {
  const { intake } = await request('/')
  return intake
}

export async function saveHealthIntake(fields, intakeId) {
  const path = intakeId ? `/${encodeURIComponent(intakeId)}` : '/'
  const method = intakeId ? 'PUT' : 'POST'
  const { intake } = await request(path, { method, body: JSON.stringify(fields) })
  return intake
}
