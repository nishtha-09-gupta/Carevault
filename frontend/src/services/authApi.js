async function request(path, options = {}) {
  const response = await fetch('/api/auth' + path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The account request failed. Please try again.')
  return body
}

export const signUp = (details) => request('/register', { method: 'POST', body: JSON.stringify(details) })
export const signIn = (details) => request('/login', { method: 'POST', body: JSON.stringify(details) })
export const requestPasswordReset = (email) => request('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
export const verifyPasswordResetOtp = (details) => request('/verify-reset-otp', { method: 'POST', body: JSON.stringify(details) })
export const resetPassword = (details) => request('/reset-password', { method: 'POST', body: JSON.stringify(details) })
export const signOut = () => request('/logout', { method: 'POST' })
export const getCurrentUser = () => request('/me')
