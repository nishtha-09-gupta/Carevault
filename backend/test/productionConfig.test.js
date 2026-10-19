import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.NODE_ENV = 'production'
process.env.CORS_ORIGINS = 'https://carevault.example,https://preview.carevault.example'

const { createCorsMiddleware } = await import('../src/app.js')
const { setSessionCookie, clearSessionCookie } = await import('../src/services/session.js')

test('production CORS permits configured origins and credentialed preflight only', () => {
  const middleware = createCorsMiddleware(['https://carevault.example', 'https://preview.carevault.example'])
  const invoke = (method, origin) => {
    const result = { headers: {}, statusCode: 200, nextCalled: false }
    const req = { method, get: (name) => name === 'Origin' ? origin : undefined }
    const res = {
      vary: (name) => { result.vary = name },
      setHeader: (name, value) => { result.headers[name.toLowerCase()] = value },
      status: (code) => { result.statusCode = code; return res },
      json: (body) => { result.body = body; return res },
      sendStatus: (code) => { result.statusCode = code; return res },
    }
    middleware(req, res, () => { result.nextCalled = true })
    return result
  }

  const allowed = invoke('GET', 'https://carevault.example')
  assert.equal(allowed.nextCalled, true)
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://carevault.example')
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true')

  const preflight = invoke('OPTIONS', 'https://preview.carevault.example')
  assert.equal(preflight.statusCode, 204)
  assert.equal(preflight.headers['access-control-allow-origin'], 'https://preview.carevault.example')

  assert.equal(invoke('GET', 'https://attacker.example').statusCode, 403)
  assert.equal(invoke('POST', undefined).statusCode, 403)
})

test('production session cookie is secure, cross-site capable, and cleared with matching attributes', () => {
  const response = { setHeader(name, value) { this[name] = value } }
  setSessionCookie(response, 'opaque-token')
  assert.match(response['Set-Cookie'], /HttpOnly/)
  assert.match(response['Set-Cookie'], /SameSite=None/)
  assert.match(response['Set-Cookie'], /Secure/)
  assert.doesNotMatch(response['Set-Cookie'], /Domain=/)

  clearSessionCookie(response)
  assert.match(response['Set-Cookie'], /SameSite=None/)
  assert.match(response['Set-Cookie'], /Secure/)
  assert.match(response['Set-Cookie'], /Max-Age=0/)
})
