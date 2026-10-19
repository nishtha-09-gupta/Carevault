export function requireWritableAccount(req, res, next) {
  if (req.user?.isDemo) return res.status(403).json({ error: 'Demo accounts have read-only access.' })
  return next()
}

export function demoDoctorPatient(req, res, next) {
  if (req.user?.demoRole !== 'doctor') return next()
  if (String(req.params.patientId) !== String(req.user.demoPartnerId || '')) {
    return res.status(404).json({ error: 'Patient not found.' })
  }
  return next()
}
