import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTimelineEvents, parseMedicalDate, parseMedicalRecord } from '../src/utils/healthRecords.js'
import { createMedicalRecord, getMyTimeline, listMedicalRecords, updateMedicalRecord } from '../src/controllers/medicalRecordController.js'
import { listDocuments } from '../src/controllers/documentController.js'
import Document from '../src/models/Document.js'
import MedicalRecord from '../src/models/MedicalRecord.js'

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    setHeader(key, value) { this.headers[key] = value; return this },
  }
}

test('medical event dates accept real calendar dates and allow blank values', () => {
  assert.equal(parseMedicalDate('2025-02-28').toISOString(), '2025-02-28T00:00:00.000Z')
  assert.equal(parseMedicalDate(''), null)
  assert.equal(parseMedicalDate('2025-02-30'), undefined)
  assert.equal(parseMedicalDate('2025-2-01'), undefined)
})

test('medical record validation requires an allowed category and title', () => {
  assert.equal(parseMedicalRecord({ title: '  Visit  ', category: 'Visit summary', eventDate: '' }).fields.title, 'Visit')
  assert.match(parseMedicalRecord({ title: 'Visit', category: 'Diagnosis' }).error, /category/)
  assert.match(parseMedicalRecord({ title: '', category: 'Other' }).error, /Title/)
  assert.match(parseMedicalRecord({ title: 'Visit', category: 'Other', eventDate: '2025-02-30' }).error, /date/)
})

test('timeline uses user-entered record dates and upload dates, then sorts newest first', () => {
  const events = createTimelineEvents([
    { id: 'r1', title: 'Visit', category: 'Visit summary', eventDate: '2024-03-01', createdAt: '2024-03-02' },
    { id: 'r2', title: 'Undated note', category: 'Other', eventDate: null, createdAt: '2024-03-04' },
  ], [
    { id: 'd1', title: 'Scan', uploadedAt: '2024-03-03', eventDate: null },
    { id: 'd2', title: 'Dated file', uploadedAt: '2024-03-01', eventDate: '2024-03-05' },
  ])
  assert.deepEqual(events.map((event) => event.title), ['Dated file', 'Scan', 'Visit'])
  assert.equal(events[0].dateType, 'Medical event date')
  assert.equal(events[1].dateType, 'Upload date')
  assert.equal(events[2].source, 'record')
})

test('a missing or deleted linked document produces an unlinked medical record event', () => {
  const events = createTimelineEvents([
    { id: 'r1', title: 'Saved record', category: 'Other', eventDate: '2024-03-01', documentId: null },
  ], [])
  assert.equal(events.length, 1)
  assert.equal(events[0].documentId, null)
})

test('doctor sessions are denied patient medical-record and timeline endpoints', async () => {
  const req = { user: { id: 'doctor-id', role: 'doctor' }, body: {} }
  for (const handler of [listMedicalRecords, createMedicalRecord, getMyTimeline]) {
    const res = responseMock()
    await handler(req, res)
    assert.equal(res.statusCode, 403)
  }
})

test('document listing scopes its query to the server-authenticated user', async () => {
  const originalFind = Document.find
  let query
  try {
    Document.find = (filter) => {
      query = filter
      return { select: () => ({ sort: () => [] }) }
    }
    const res = responseMock()
    await listDocuments({ user: { id: 'authenticated-owner', role: 'patient' }, query: { ownerId: 'attacker-id' } }, res)
    assert.equal(query.ownerId, 'authenticated-owner')
    assert.equal(query.demoSeedKey, undefined)
  } finally {
    Document.find = originalFind
  }
})

test('medical record create and update use the authenticated owner ID', async () => {
  const originalCreate = MedicalRecord.create
  const originalFindById = MedicalRecord.findById
  const originalUpdate = MedicalRecord.findOneAndUpdate
  const originalIsValid = (await import('mongoose')).default.isValidObjectId
  const mongoose = (await import('mongoose')).default
  try {
    const createdDoc = { _id: 'record-one', title: 'Checkup', category: 'Visit summary', provider: '', eventDate: null, notes: '', documentId: null }
    MedicalRecord.create = async (data) => { assert.equal(data.ownerId, 'authenticated-owner'); return { _id: 'record-one' } }
    MedicalRecord.findById = () => ({ populate: async () => createdDoc })
    let res = responseMock()
    await createMedicalRecord({ user: { id: 'authenticated-owner', role: 'patient' }, body: { title: 'Checkup', category: 'Visit summary' } }, res)
    assert.equal(res.statusCode, 201)
    assert.equal(res.body.record.title, 'Checkup')

    mongoose.isValidObjectId = () => true
    let filter
    MedicalRecord.findOneAndUpdate = (query) => { filter = query; return { populate: async () => ({ ...createdDoc, _id: 'record-one', title: 'Updated', category: 'Other' }) } }
    res = responseMock()
    await updateMedicalRecord({ user: { id: 'authenticated-owner', role: 'patient' }, params: { id: 'record-one' }, body: { title: 'Updated', category: 'Other' } }, res)
    assert.equal(filter.ownerId, 'authenticated-owner')
    assert.equal(filter._id, 'record-one')
    assert.equal(res.body.record.title, 'Updated')
  } finally {
    MedicalRecord.create = originalCreate
    MedicalRecord.findById = originalFindById
    MedicalRecord.findOneAndUpdate = originalUpdate
    mongoose.isValidObjectId = originalIsValid
  }
})
