import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CloudUpload,
  Download,
  FileText,
  FlaskConical,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react'
import AppShell from '../components/AppShell'
import DocumentPreview from '../components/DocumentPreview'
import { EmptyState, PageHeading, RecordIcon, StatusBadge } from '../components/UI'
import { fetchDocumentFile, fetchDocuments, removeDocument, uploadDocument } from '../services/documentApi'
import { fetchAccessGrants, fetchDoctorPatients, fetchPatientDocumentFile, fetchPatientDocuments } from '../services/accessApi'
import { deleteMedicalRecord, fetchMedicalRecords, fetchTimeline, saveMedicalRecord } from '../services/medicalRecordApi'

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
const DOCUMENT_TYPES = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export function RecordsPage({ role = 'patient' }) {
  const [params, setParams] = useSearchParams()
  const [category, setCategory] = useState('All types')
  const [records, setRecords] = useState([])
  const [documents, setDocuments] = useState([])
  const [isDemoAccount, setIsDemoAccount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const query = params.get('q') || ''
  if (role === 'doctor') return <DocumentsPage role="doctor" />
  useEffect(() => {
    const controller = new AbortController()
    fetchMedicalRecords(controller.signal).then((payload) => { setRecords(payload.records); setDocuments(payload.documents); setIsDemoAccount(payload.isDemoAccount) }).catch((e) => { if (e.name !== 'AbortError') setError(e.message) }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [revision])
  const visibleRecords = records.filter((r) => [r.title, r.provider, r.category, r.notes].join(' ').toLowerCase().includes(query.toLowerCase()) && (category === 'All types' || r.category === category))
  const visibleDocuments = documents.filter((d) => [d.title, d.category].join(' ').toLowerCase().includes(query.toLowerCase()) && (category === 'All types' || d.category === category))
  async function submitRecord(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    try { await saveMedicalRecord({ id: editing?.id, title: form.get('title'), category: form.get('category'), provider: form.get('provider'), eventDate: form.get('eventDate'), notes: form.get('notes'), documentId: form.get('documentId') || null }); setEditing(null); setRevision((n) => n + 1); setNotice('Medical record saved.') }
    catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  async function deleteRecord(record) {
    if (!window.confirm(`Delete “${record.title}”?`)) return
    try { await deleteMedicalRecord(record.id); setRevision((n) => n + 1); setNotice('Medical record deleted.') } catch (e) { setError(e.message) }
  }

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="YOUR HEALTH HISTORY"
        title={role === 'doctor' ? 'Patient records' : 'Medical records'}
        subtitle="Your saved medical records and uploaded documents, kept as separate entries."
        action={<button onClick={() => setEditing({})} className="btn-primary"><Plus size={16} /> Add record</button>}
      />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {isDemoAccount && <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">Demo sample records are included for exploring CareVault. Add or edit your own entries here.</p>}
      {editing && <form onSubmit={submitRecord} className="card mb-5 grid gap-3 p-5 sm:grid-cols-2">
        <label className="text-xs font-semibold">Title<input required maxLength="180" name="title" defaultValue={editing.title || ''} className="field mt-1" /></label>
        <label className="text-xs font-semibold">Category<select name="category" defaultValue={editing.category || 'Other'} className="field mt-1">{['Lab result', 'Visit summary', 'Medication', 'Prescription', 'Imaging', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-semibold">Provider or hospital (optional)<input maxLength="180" name="provider" defaultValue={editing.provider || ''} className="field mt-1" /></label>
        <label className="text-xs font-semibold">Medical event date (optional)<input type="date" name="eventDate" defaultValue={editing.eventDate ? editing.eventDate.slice(0, 10) : ''} className="field mt-1" /></label>
        <label className="text-xs font-semibold sm:col-span-2">Notes (optional)<textarea maxLength="5000" name="notes" defaultValue={editing.notes || ''} className="field mt-1" rows="3" /></label>
        <label className="text-xs font-semibold sm:col-span-2">Link an uploaded document (optional)<select name="documentId" defaultValue={editing.documentId || ''} className="field mt-1"><option value="">No linked document</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
        <div className="flex gap-2 sm:col-span-2"><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save record'}</button><button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button></div>
      </form>}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search size={17} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
            className="field pl-10"
            placeholder="Search records"
          />
        </label>
        <label className="relative">
          <span className="sr-only">Filter by record type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field h-full sm:w-48">
            {['All types', 'Lab result', 'Visit summary', 'Medication', 'Prescription', 'Imaging', 'Other'].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_100px] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:grid">
          <span>Record</span>
          <span>Category</span>
          <span>Date added</span>
          <span>Actions</span>
        </div>

        {loading ? <div role="status" className="p-6 text-sm text-slate-500">Loading your saved records…</div> : visibleRecords.length || visibleDocuments.length ? (
          <>
          {visibleRecords.map((r) => (
            <div
              key={`record-${r.id}`}
              className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_100px] sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <RecordIcon lab={r.category === 'Lab result'} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="truncate text-xs text-slate-400">Medical record{r.provider ? ` · ${r.provider}` : ''}</p>
                  {r.document && <p className="truncate text-xs text-teal">Linked document: {r.document.title}</p>}
                </div>
              </div>
              <span className="text-xs text-slate-500 sm:block">{r.category}</span>
              <span className="text-xs text-slate-500">{r.eventDate ? new Date(r.eventDate).toLocaleDateString() : 'No event date'}</span>
              <span className="flex gap-2"><button onClick={() => setEditing(r)} className="text-xs font-semibold text-teal">Edit</button><button onClick={() => deleteRecord(r)} className="text-xs text-rose-700">Delete</button></span>
            </div>
          ))}
          {visibleDocuments.map((d) => <div key={`document-${d.id}`} className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_100px] sm:items-center sm:gap-4"><div className="flex min-w-0 items-center gap-3"><RecordIcon lab={d.fileType === 'application/pdf'} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{d.title}</p><p className="text-xs text-slate-400">Uploaded document</p></div></div><span className="text-xs text-slate-500">{d.category || 'Document'}</span><span className="text-xs text-slate-500">{new Date(d.uploadedAt).toLocaleDateString()}</span><Link to="/documents" className="text-xs font-semibold text-teal">Open document</Link></div>)}
          </>
        ) : (
          <div className="p-6">
            <EmptyState title={records.length || documents.length ? 'No matching records' : 'No records yet'} text={records.length || documents.length ? 'Try another search term or category.' : 'Add a medical record or upload a document to get started.'} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="text-teal" />
        {'Medical records and documents are shown as separate saved items.'}
      </div>
    </AppShell>
  )
}

export function TimelinePage({ role = 'patient' }) {
  const [selected, setSelected] = useState(['Visits', 'Lab results', 'Medications', 'Documents'])
  const [events, setEvents] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [isDemoAccount, setIsDemoAccount] = useState(false)
  useEffect(() => { const controller = new AbortController(); fetchTimeline(controller.signal).then((payload) => { setEvents(payload.events); setIsDemoAccount(payload.isDemoAccount) }).catch((e) => { if (e.name !== 'AbortError') setError(e.message) }).finally(() => setLoading(false)); return () => controller.abort() }, [])
  const typeFor = (event) => event.source === 'document' ? 'Documents' : event.category === 'Visit summary' ? 'Visits' : event.category === 'Lab result' ? 'Lab results' : event.category === 'Medication' || event.category === 'Prescription' ? 'Medications' : event.category
  const visibleTimeline = events.filter((event) => selected.includes(typeFor(event))).sort((a, b) => new Date(b.date) - new Date(a.date))
  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="YOUR HEALTH HISTORY"
        title="Health timeline"
        subtitle="Events from your saved records and uploaded documents."
        action={<span className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-500">{visibleTimeline.length} events shown</span>}
      />

      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {isDemoAccount && <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">This demo timeline includes sample dates and records for exploring CareVault.</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
        <div className="card p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm font-semibold">Chronological events</p>
              <p className="mt-1 text-xs text-slate-400">{visibleTimeline.length} events · most recent first</p>
            </div>
            <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-teal">
              All events
            </span>
          </div>

          <div className="pt-5">
            {loading ? <div role="status" className="py-8 text-center text-sm text-slate-500">Loading your timeline…</div> : visibleTimeline.length === 0 ? <EmptyState title="No timeline events" text={events.length ? 'There are no events in the selected filters.' : 'Medical records with event dates and uploaded documents will appear here.'} /> : visibleTimeline.map((event, index) => (
              <div key={event.id} className="relative flex gap-4 pb-7 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mt-1 grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-teal">
                    {event.source === 'document' ? <FileText size={17} /> : event.category === 'Visit summary' ? <UsersRound size={17} /> : <FlaskConical size={17} />}
                  </span>
                  {index < visibleTimeline.length - 1 && (
                    <span className="mt-2 h-full w-px bg-slate-200" />
                  )}
                </div>
                <div className="flex-1 rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold tracking-widest text-slate-400">
                      {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {event.dateType}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${event.color}`}
                    >
                      {event.source === 'document' ? 'Document' : event.category}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{event.title}</h3>
                  {event.provider && <p className="mt-1 text-xs text-slate-500">{event.provider}</p>}
                  {event.notes && <p className="mt-2 text-xs text-slate-600">{event.notes}</p>}
                  <Link to={event.source === 'document' ? '/documents' : '/records'} className="mt-3 inline-block text-xs font-semibold text-teal hover:underline">View {event.source === 'document' ? 'document' : 'record'} →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="card h-fit p-5">
          <p className="font-semibold">Timeline filters</p>
          <p className="mt-1 text-xs text-slate-500">Choose which events to show.</p>
          <div className="mt-5 space-y-3">
            {['Visits', 'Lab results', 'Medications', 'Imaging', 'Other', 'Documents'].map((name) => (
              <label key={name} className="flex items-center gap-2.5 text-sm text-slate-600">
                <input type="checkbox" checked={selected.includes(name)} onChange={() => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])} className="accent-teal" />
                {name}
                <span className="ml-auto text-xs text-slate-400">{events.filter((event) => typeFor(event) === name).length}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}

export function DocumentsPage({ role = 'patient' }) {
  const input = useRef(null)
  const [documents, setDocuments] = useState([])
  const [sharedPatients, setSharedPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [deletingId, setDeletingId] = useState('')
  const [pageError, setPageError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [preview, setPreview] = useState(null)
  const [openingDocumentId, setOpeningDocumentId] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadEventDate, setUploadEventDate] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    if (role === 'doctor') {
      const loadPatients = () => fetchDoctorPatients()
        .then((patients) => {
          setSharedPatients(patients)
          setSelectedPatientId((current) => patients.some((entry) => entry.patient.id === current) ? current : patients[0]?.patient.id || '')
          if (patients.length === 0) { setDocuments([]); setPreview(null) }
        })
        .catch((error) => { if (error.name !== 'AbortError') setPageError(error.message) })
        .finally(() => setLoading(false))
      loadPatients()
      const refresh = window.setInterval(loadPatients, 5000)
      const tick = window.setInterval(() => setNow(Date.now()), 1000)
      return () => { controller.abort(); window.clearInterval(refresh); window.clearInterval(tick) }
    } else {
      fetchDocuments(controller.signal)
        .then((items) => setDocuments(items))
        .catch((error) => { if (error.name !== 'AbortError') setPageError(error.message) })
        .finally(() => setLoading(false))
    }
    return () => controller.abort()
  }, [role, reloadCount])

  const selectedAccess = sharedPatients.find((entry) => entry.patient.id === selectedPatientId)
  const doctorHasActiveAccess = Boolean(selectedAccess && selectedAccess.status === 'active' && new Date(selectedAccess.expiresAt).getTime() > now)
  const activeSharedPatients = sharedPatients.filter((entry) => entry.status === 'active' && new Date(entry.expiresAt).getTime() > now)

  useEffect(() => {
    if (role === 'doctor' && !doctorHasActiveAccess) { setDocuments([]); setPreview(null) }
  }, [role, doctorHasActiveAccess])

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  useEffect(() => {
    if (role !== 'doctor' || !selectedPatientId || !doctorHasActiveAccess) return
    let active = true
    setLoading(true)
    setPageError('')
    fetchPatientDocuments(selectedPatientId)
      .then((items) => { if (active) setDocuments(items) })
      .catch((error) => { if (active) { setDocuments([]); setPageError(error.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role, selectedPatientId, reloadCount, doctorHasActiveAccess])

  async function saveFile(file) {
    if (!file || uploading) return
    setUploadError('')
    setPageError('')
    setNotice('')

    const extension = '.' + file.name.split('.').pop().toLowerCase()
    if (!Object.prototype.hasOwnProperty.call(DOCUMENT_TYPES, extension)) {
      setUploadError('Choose a PDF, JPG, JPEG, or PNG file.')
      return
    }
    if (file.type && file.type !== DOCUMENT_TYPES[extension]) {
      setUploadError('The file extension and file type do not match.')
      return
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      setUploadError('The file is too large. Maximum size is 10 MB.')
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      const document = await uploadDocument(file, setProgress, { category: uploadCategory, eventDate: uploadEventDate })
      setDocuments((current) => [document, ...current])
      setNotice('Document uploaded successfully.')
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  async function openFile(document) {
    if (role === 'doctor') {
      if (!doctorHasActiveAccess) return
      setOpeningDocumentId(document.id)
      setPageError('')
      try {
        const file = await fetchPatientDocumentFile(selectedPatientId, document.id)
        if (Date.now() >= new Date(selectedAccess.expiresAt).getTime()) throw new Error('Access to this patient’s records has expired.')
        setPreview({ document, url: URL.createObjectURL(file) })
      } catch (error) { setPageError(error.message) }
      finally { setOpeningDocumentId('') }
      return
    }
    setPageError('')
    setOpeningDocumentId(document.id)
    try {
      const file = await fetchDocumentFile(document.id)
      setPreview({ document, url: URL.createObjectURL(file) })
    } catch (error) {
      setPageError(error.message)
    } finally { setOpeningDocumentId('') }
  }

  async function deleteFile(document) {
    const confirmed = window.confirm('Delete "' + document.originalFileName + '"? This also removes the stored file.')
    if (!confirmed) return
    setDeletingId(document.id)
    setPageError('')
    setNotice('')
    try {
      await removeDocument(document.id)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      setNotice('Document deleted successfully.')
    } catch (error) {
      setPageError(error.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="DOCUMENT LIBRARY"
        title={role === 'doctor' ? 'Shared patient documents' : 'Documents'}
        subtitle={role === 'doctor' ? 'Documents shared by patients who have granted your account active access.' : 'Upload and manage documents in your private CareVault library.'}
        action={role !== 'doctor' && (
          <button disabled={uploading || loading} onClick={() => input.current?.click()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} /> Upload document
          </button>
        )}
      />

      {role === 'doctor' && <label className="mb-5 block max-w-lg text-xs font-semibold text-slate-600">Select an active patient
        <select className="field mt-1" value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)}>
          {activeSharedPatients.length === 0 && <option value="">No active patient access</option>}
          {activeSharedPatients.map((grant) => <option key={grant.id} value={grant.patient.id}>{grant.patient.name} · until {new Date(grant.expiresAt).toLocaleString()}</option>)}
        </select>
      </label>}

      {role !== 'doctor' && <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => saveFile(e.target.files?.[0])}
      />}


      {role !== 'doctor' && <div className="mb-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Document category (optional)<select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="field mt-1"><option value="">Uncategorized</option>{['Lab result', 'Visit summary', 'Medication', 'Prescription', 'Imaging', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Medical event date (optional)<input type="date" value={uploadEventDate} onChange={(e) => setUploadEventDate(e.target.value)} className="field mt-1" /></label></div>}
      {role !== 'doctor' && <button
        type="button"
        disabled={uploading || loading}
        aria-busy={uploading}
        onClick={() => !uploading && !loading && input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          saveFile(e.dataTransfer.files?.[0])
        }}
        className="mb-3 flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center transition hover:border-teal hover:bg-mint/30 disabled:cursor-wait disabled:opacity-70"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-teal">
          {uploading ? <LoaderCircle size={23} className="animate-spin"/> : <CloudUpload size={23}/>}
        </span>
        <span className="mt-4 font-semibold">{uploading ? 'Uploading document…' : 'Drop a file here, or browse'}</span>
        <span className="mt-1 text-sm text-slate-500">
          PDF, JPG, JPEG, or PNG · Maximum 10 MB
        </span>
      </button>}

      {role !== 'doctor' && uploading && <div className="mb-6 rounded-xl border border-teal/15 bg-white p-4" role="status" aria-live="polite"><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-700">{progress === 100 ? 'Saving to document storage…' : 'Sending file…'}</span><span className="tabular-nums text-slate-500">{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal transition-[width]" style={{ width: progress + '%' }}/></div></div>}
      {role !== 'doctor' && documents.some((document) => document.isDemoSample) && <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">Sample documents are included in the demo account. Other accounts only show documents they upload.</p>}
      {role !== 'doctor' && uploadError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{uploadError}</p>}
      {pageError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{pageError}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <h2 className="mb-4 font-semibold">
        {role === 'doctor' ? `Documents shared by ${selectedAccess?.patient.name || 'this patient'}` : 'Your documents'}{' '}
        <span className="ml-1 text-xs font-normal text-slate-400">
          {documents.length}
        </span>
      </h2>

      {role === 'doctor' && !doctorHasActiveAccess && !loading ? <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{selectedAccess ? 'Access to this patient’s records has expired.' : 'No patients have shared their records with you yet.'}</div> : null}
      {loading ? <div role="status" className="card flex items-center justify-center gap-3 p-10 text-sm text-slate-500"><LoaderCircle className="animate-spin text-teal" size={18}/> Loading shared records…</div>
        : pageError && documents.length === 0 ? <div className="card p-8 text-center"><p role="alert" className="text-sm text-rose-700">{pageError}</p><button onClick={() => { setPageError(''); setLoading(true); setReloadCount((count) => count + 1) }} className="btn-secondary mt-4">Try again</button></div>
        : role === 'doctor' && !doctorHasActiveAccess ? null
        : documents.length === 0 ? <EmptyState title={role === 'doctor' ? selectedPatientId ? 'No documents shared' : 'No patient access yet' : 'No documents yet'} text={role === 'doctor' ? 'This patient has not uploaded any documents.' : 'Upload a PDF or image to start your document library.'}/>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <DocumentCard key={document.id} document={document} readOnly={role === 'doctor'} deleting={deletingId === document.id} opening={openingDocumentId === document.id} onOpen={() => openFile(document)} onDelete={() => deleteFile(document)}/>)}</div>}
      <DocumentPreview preview={preview} onClose={() => setPreview(null)}/>
    </AppShell>
  )
}

function DocumentCard({ document, readOnly, deleting, opening, onOpen, onDelete }) {
  const date = new Date(document.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const size = document.fileSize < 1024 * 1024 ? Math.max(1, Math.round(document.fileSize / 1024)) + ' KB' : (document.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
  const type = document.fileType === 'application/pdf' ? 'PDF' : document.fileType === 'image/jpeg' ? 'JPEG image' : 'PNG image'
  return (
    <article className="card flex min-w-0 flex-col p-4">
      <div className="flex min-w-0 items-center gap-3">
        <RecordIcon lab={document.fileType === 'application/pdf'}/>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={document.originalFileName}>{document.title}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{type} · {size} · {date}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" disabled={opening} onClick={onOpen} className="btn-secondary flex-1 !px-3 !py-2 text-xs">{opening ? <LoaderCircle size={14} className="animate-spin"/> : <Download size={14}/>} {readOnly ? 'Open document' : 'Open / download'}</button>
        {!readOnly && <button type="button" disabled={deleting} onClick={onDelete} aria-label={'Delete ' + document.originalFileName} className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50">{deleting ? <LoaderCircle size={15} className="animate-spin"/> : <Trash2 size={15}/>}</button>}
      </div>
    </article>
  )
}

export function ConnectionsPage({ role = 'patient' }) {
  const doctor = role === 'doctor'
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAccessGrants().then(setGrants).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [])

  const activeGrants = grants.filter((grant) => grant.status === 'active' && new Date(grant.expiresAt) > new Date())

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="CARE TEAM"
        title="Connections"
        subtitle={doctor ? 'Patients who currently share their documents with your account.' : 'Doctors with access to your documents appear here. You control each access period.'}
        action={<Link to={doctor ? '/doctor/sharing' : '/sharing'} className="btn-secondary"><ShieldCheck size={16}/> Sharing settings</Link>}
      />
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <section className="card divide-y divide-slate-100 px-5">
        {loading ? <div role="status" className="flex justify-center py-10 text-sm text-slate-500">Loading real access records…</div>
          : activeGrants.length === 0 ? <div className="py-10 text-center"><p className="text-sm text-slate-500">No active access connections.</p><Link to={doctor ? '/doctor/sharing' : '/sharing'} className="mt-3 inline-block text-sm font-semibold text-teal">{doctor ? 'Review shared patient access' : 'Find a doctor and grant access'} →</Link></div>
          : activeGrants.map((grant) => {
            const person = doctor ? grant.patient : grant.doctor
            return <div key={grant.id} className="flex flex-wrap items-center gap-3 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-lilac text-xs font-bold text-indigo-700">{person?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || '?'}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{person?.name || 'Account unavailable'}</p><p className="text-xs text-slate-400">{person?.email} · Expires {new Date(grant.expiresAt).toLocaleString()}</p></div>
              <StatusBadge>Active</StatusBadge>
            </div>
          })}
      </section>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={14} className="text-teal"/> Access is stored in CareVault and checked by the API for every shared-document request.</p>
    </AppShell>
  )
}
