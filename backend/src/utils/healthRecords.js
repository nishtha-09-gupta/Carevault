import { MEDICAL_RECORD_CATEGORIES } from '../models/MedicalRecord.js'

export function parseMedicalDate(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date
}

export function parseMedicalRecord(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter medical record details.' }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title || title.length > 180) return { error: 'Title is required and must be 180 characters or fewer.' }
  if (!MEDICAL_RECORD_CATEGORIES.includes(body.category)) return { error: 'Choose a valid record category.' }
  const provider = body.provider ?? ''
  const notes = body.notes ?? ''
  if (typeof provider !== 'string' || provider.length > 180) return { error: 'Provider must be 180 characters or fewer.' }
  if (typeof notes !== 'string' || notes.length > 5000) return { error: 'Notes must be 5,000 characters or fewer.' }
  const eventDate = parseMedicalDate(body.eventDate)
  if (eventDate === undefined) return { error: 'Enter a valid medical event date.' }
  return { fields: { title, category: body.category, provider: provider.trim(), notes: notes.trim(), eventDate } }
}

export function createTimelineEvents(records, documents) {
  const events = [
    ...records.filter((record) => record.eventDate).map((record) => ({
      id: `record:${record.id}`, source: 'record', sourceId: record.id, title: record.title,
      category: record.category, provider: record.provider || '', notes: record.notes || '',
      date: record.eventDate, dateType: 'Medical event date',
      documentId: record.document?.id || record.documentId || null,
    })),
    ...documents.map((document) => ({
      id: `document:${document.id}`, source: 'document', sourceId: document.id, title: document.title,
      category: document.category || 'Document', date: document.eventDate || document.uploadedAt,
      dateType: document.eventDate ? 'Medical event date' : 'Upload date', documentId: document.id,
    })),
  ]
  return events.sort((a, b) => new Date(b.date) - new Date(a.date))
}
