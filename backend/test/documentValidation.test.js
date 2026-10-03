import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTitle, isAllowedFile, MAX_FILE_SIZE, validateFileContents } from '../src/utils/documentValidation.js'
import { demoPatient } from '../src/middleware/demoPatient.js'

test('only PDF, JPG, JPEG, and PNG extension and MIME pairs are allowed', () => {
  assert.equal(isAllowedFile({ originalname: 'record.pdf', mimetype: 'application/pdf' }), true)
  assert.equal(isAllowedFile({ originalname: 'photo.JPG', mimetype: 'image/jpeg' }), true)
  assert.equal(isAllowedFile({ originalname: 'photo.jpeg', mimetype: 'image/jpeg' }), true)
  assert.equal(isAllowedFile({ originalname: 'photo.png', mimetype: 'image/png' }), true)
  assert.equal(isAllowedFile({ originalname: 'photo.jpg', mimetype: 'application/octet-stream' }), true)
  assert.equal(isAllowedFile({ originalname: 'record.pdf', mimetype: 'image/png' }), false)
  assert.equal(isAllowedFile({ originalname: 'script.html', mimetype: 'text/html' }), false)
})

test('the backend upload size limit is 10 MB', () => {
  assert.equal(MAX_FILE_SIZE, 10 * 1024 * 1024)
})

test('file signatures are checked instead of trusting the filename', async () => {
  const fakePdf = { originalname: 'record.pdf', buffer: Buffer.from('not a PDF') }
  await assert.rejects(validateFileContents(fakePdf), /contents do not match/)

  const pdf = { originalname: 'record.pdf', buffer: Buffer.from('%PDF-1.4') }
  assert.equal(await validateFileContents(pdf), 'application/pdf')
})

test('the display title is derived from the uploaded file name', () => {
  assert.equal(getTitle('annual-checkup.pdf'), 'annual-checkup')
})

test('the development identity comes from server configuration, not the request body', () => {
  const previousId = process.env.DEMO_PATIENT_ID
  const previousEnvironment = process.env.NODE_ENV
  try {
    process.env.DEMO_PATIENT_ID = '111111111111111111111111'
    process.env.NODE_ENV = 'development'
    const request = { body: { patientId: '222222222222222222222222' } }
    let nextCalled = false
    demoPatient(request, {}, () => { nextCalled = true })
    assert.equal(request.user.id, '111111111111111111111111')
    assert.equal(nextCalled, true)
  } finally {
    if (previousId === undefined) delete process.env.DEMO_PATIENT_ID
    else process.env.DEMO_PATIENT_ID = previousId
    if (previousEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousEnvironment
  }
})
