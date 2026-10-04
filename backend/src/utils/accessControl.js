export const MAX_ACCESS_DURATION_HOURS = 24 * 30

export function isValidAccessDurationHours(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_ACCESS_DURATION_HOURS
}

export function isAccessGrantActive(grant, now = new Date()) {
  return Boolean(grant && grant.status === 'active' && new Date(grant.expiresAt).getTime() > now.getTime())
}

export function activeGrantQuery(patientId, doctorId, now = new Date()) {
  return { patientId, doctorId, status: 'active', expiresAt: { $gt: now } }
}
