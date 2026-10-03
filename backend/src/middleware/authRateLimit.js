const buckets = new Map()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 12

export function authRateLimit(req, res, next) {
  const now = Date.now()
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
  }
  const key = `${req.ip}:${req.path}`
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return next()
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000))
    return res.status(429).json({ error: 'Too many account attempts. Wait a little and try again.' })
  }
  bucket.count += 1
  return next()
}
