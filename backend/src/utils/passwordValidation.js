export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 128
export const PASSWORD_ERROR = 'Password must be at least 6 characters long'

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH
}
