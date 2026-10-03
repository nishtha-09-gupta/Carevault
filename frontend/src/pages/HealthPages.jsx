import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Link2,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react'
import AppShell from '../components/AppShell'
import { EmptyState, PageHeading, RecordIcon, StatusBadge } from '../components/UI'
import { records, timeline } from '../data/demoData'
import { fetchDocument, fetchDocuments, removeDocument, uploadDocument } from '../services/documentApi'
import { useAuth } from '../components/AuthContext'

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
  const query = params.get('q') || ''
  const recordsForRole = role === 'doctor'
    ? records.map((record, index) => ({ ...record, provider: ['Nisha Rao', 'Arjun Mehta', 'Maya Iyer', 'Kabir Shah'][index % 4] }))
    : records
  const visible = recordsForRole.filter((record) =>
    [record.title, record.provider, record.type].join(' ').toLowerCase().includes(query.toLowerCase()) &&
    (category === 'All types' || record.type === category)
  )
  const displayRows = visible

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="YOUR HEALTH HISTORY"
        title={role === 'doctor' ? 'Patient records' : 'Medical records'}
        subtitle={role === 'doctor' ? 'Prototype sample only. Patient-shared records are not available yet.' : 'This screen shows sample records only. Upload your own files in Documents.'}
        action={
          <Link to={role === 'doctor' ? '/doctor/documents' : '/documents'} className="btn-primary">
            <Plus size={16} /> Add record
          </Link>
        }
      />

      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">These entries are fictional sample data and are not part of your account. Your uploaded files are in the Documents library.</p>
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
            {['All types', ...new Set(records.map((record) => record.type))].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_100px] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:grid">
          <span>Record</span>
          <span>Category</span>
          <span>Date added</span>
          <span>Status</span>
        </div>

        {visible.length ? (
          displayRows.map((r) => (
            <div
              key={r.title}
              className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_100px] sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <RecordIcon lab={r.lab} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="truncate text-xs text-slate-400">{r.provider}</p>
                </div>
              </div>
              <span className="text-xs text-slate-500 sm:block">{r.type}</span>
              <span className="text-xs text-slate-500">{r.date}</span>
              <span>
                <StatusBadge tone={r.status === 'Private' ? 'gray' : 'green'}>
                  {r.status}
                </StatusBadge>
              </span>
            </div>
          ))
        ) : (
          <div className="p-6">
            <EmptyState title="No matching records" text="Try another search term." />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="text-teal" />
        {role === 'doctor' ? 'This sample list represents patient-shared records in the demo.' : 'Private records stay private in this demo. Sharing is managed per connection.'}
      </div>
    </AppShell>
  )
}

export function TimelinePage({ role = 'patient' }) {
  const [selected, setSelected] = useState(['Visits', 'Lab results', 'Medications', 'Documents'])
  const visibleTimeline = timeline.filter((event) => {
    const category = event.kind === 'Visit' ? 'Visits' : event.kind === 'Lab result' ? 'Lab results' : event.kind === 'Medication' ? 'Medications' : 'Documents'
    return selected.includes(category)
  })
  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="YOUR HEALTH HISTORY"
        title="Health timeline"
        subtitle="Prototype timeline using sample events. It is not generated from your records or saved to your account."
        action={<span className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-500">{visibleTimeline.length} events shown</span>}
      />

      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">The events below are fictional examples. Uploads are stored separately in your private Documents library.</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
        <div className="card p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-sm font-semibold">2026</p>
              <p className="mt-1 text-xs text-slate-400">{visibleTimeline.length} events · most recent first</p>
            </div>
            <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-teal">
              All events
            </span>
          </div>

          <div className="pt-5">
            {visibleTimeline.map((event, index) => (
              <div key={event.title} className="relative flex gap-4 pb-7 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mt-1 grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-teal">
                    {event.kind === 'Visit' ? <UsersRound size={17} /> : <FlaskConical size={17} />}
                  </span>
                  {index < timeline.length - 1 && (
                    <span className="mt-2 h-full w-px bg-slate-200" />
                  )}
                </div>
                <div className="flex-1 rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold tracking-widest text-slate-400">
                      {event.month}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${event.color}`}
                    >
                      {event.kind}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold">{event.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{event.place}</p>
                  <Link to={role === 'doctor' ? '/doctor/records' : '/records'} className="mt-3 inline-block text-xs font-semibold text-teal hover:underline">View related records →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="card h-fit p-5">
          <p className="font-semibold">Timeline filters</p>
          <p className="mt-1 text-xs text-slate-500">Choose which events to show.</p>
          <div className="mt-5 space-y-3">
            {['Visits', 'Lab results', 'Medications', 'Documents'].map((name, i) => (
              <label key={name} className="flex items-center gap-2.5 text-sm text-slate-600">
                <input type="checkbox" checked={selected.includes(name)} onChange={() => setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])} className="accent-teal" />
                {name}
                <span className="ml-auto text-xs text-slate-400">{[2, 2, 0, 4][i]}</span>
              </label>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}

export function DocumentsPage({ role = 'patient' }) {
  const { user } = useAuth()
  const readOnlyDemo = user?.isDemo
  const input = useRef(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [deletingId, setDeletingId] = useState('')
  const [pageError, setPageError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchDocuments(controller.signal)
      .then((items) => setDocuments(items))
      .catch((error) => {
        if (error.name !== 'AbortError') setPageError(error.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [role, reloadCount])

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
      const document = await uploadDocument(file, setProgress)
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
    const newTab = window.open('about:blank', '_blank')
    if (!newTab) {
      setPageError('Your browser blocked the new tab. Allow pop-ups, then try again.')
      return
    }
    newTab.opener = null
    setPageError('')
    try {
      const fullDocument = await fetchDocument(document.id)
      newTab.location.replace(fullDocument.fileUrl)
    } catch (error) {
      newTab.close()
      setPageError(error.message)
    }
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
        title="Documents"
        subtitle={readOnlyDemo ? 'Explore the private document library with this read-only demo account.' : 'Upload and manage documents in your private CareVault library.'}
        action={
          <button disabled={readOnlyDemo || uploading || loading} onClick={() => input.current?.click()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} /> {readOnlyDemo ? 'Demo is read-only' : 'Upload document'}
          </button>
        }
      />

      <input
        ref={input}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => saveFile(e.target.files?.[0])}
      />

      {readOnlyDemo && <p className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">Demo mode is read-only. Create a personal account to upload files to your own private library.</p>}

      <button
        type="button"
        disabled={readOnlyDemo || uploading || loading}
        aria-busy={uploading}
        onClick={() => !uploading && !loading && input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (!readOnlyDemo) saveFile(e.dataTransfer.files?.[0])
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
      </button>

      {uploading && <div className="mb-6 rounded-xl border border-teal/15 bg-white p-4" role="status" aria-live="polite"><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-700">{progress === 100 ? 'Saving to document storage…' : 'Sending file…'}</span><span className="tabular-nums text-slate-500">{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal transition-[width]" style={{ width: progress + '%' }}/></div></div>}
      {uploadError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{uploadError}</p>}
      {pageError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{pageError}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <h2 className="mb-4 font-semibold">
        Your documents{' '}
        <span className="ml-1 text-xs font-normal text-slate-400">
          {documents.length}
        </span>
      </h2>

      {loading ? <div role="status" className="card flex items-center justify-center gap-3 p-10 text-sm text-slate-500"><LoaderCircle className="animate-spin text-teal" size={18}/> Loading your documents…</div>
        : pageError && documents.length === 0 ? <div className="card p-8 text-center"><p role="alert" className="text-sm text-rose-700">{pageError}</p><button onClick={() => { setPageError(''); setLoading(true); setReloadCount((count) => count + 1) }} className="btn-secondary mt-4">Try again</button></div>
        : documents.length === 0 ? <EmptyState title="No documents yet" text={readOnlyDemo ? 'Create an account to add files to a private document library.' : 'Upload a PDF or image to start your document library.'}/>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <DocumentCard key={document.id} document={document} readOnly={readOnlyDemo} deleting={deletingId === document.id} onOpen={() => openFile(document)} onDelete={() => deleteFile(document)}/>)}</div>}
    </AppShell>
  )
}

function DocumentCard({ document, readOnly, deleting, onOpen, onDelete }) {
  const date = new Date(document.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const size = document.fileSize < 1024 * 1024 ? Math.max(1, Math.round(document.fileSize / 1024)) + ' KB' : (document.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
  return (
    <article className="card flex min-w-0 flex-col p-4">
      <div className="flex min-w-0 items-center gap-3">
        <RecordIcon lab={document.fileType === 'application/pdf'}/>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={document.originalFileName}>{document.title}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{size} · {date}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={onOpen} className="btn-secondary flex-1 !px-3 !py-2 text-xs"><Download size={14}/> Open / download</button>
        {!readOnly && <button type="button" disabled={deleting} onClick={onDelete} aria-label={'Delete ' + document.originalFileName} className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50">{deleting ? <LoaderCircle size={15} className="animate-spin"/> : <Trash2 size={15}/>}</button>}
      </div>
    </article>
  )
}

export function ConnectionsPage({ role = 'patient' }) {
  const doctor = role === 'doctor'
  const [code, setCode] = useState('')
  const [connected, setConnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const [requestState, setRequestState] = useState({})
  const invite = doctor ? 'DR-48XM' : 'PT-92KL'

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="CARE TEAM"
        title="Connections"
        subtitle="Connect patients and clinicians using invite codes. You choose what health information to share."
        action={<Link to={doctor ? '/doctor/sharing' : '/sharing'} className="btn-secondary"><ShieldCheck size={16}/> Sharing settings</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint text-teal">
              <Link2 size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Your invite code</h2>
              <p className="mt-1 text-sm text-slate-500">
                {doctor
                  ? 'Share this code with a patient to receive a request.'
                  : 'Share this code with your clinician to connect.'}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-dashed border-teal/30 bg-mint/40 p-4">
            <code className="text-xl font-bold tracking-[.18em] text-teal">{invite}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(invite)
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              }}
              className="btn-secondary !px-3 !py-2 text-xs"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Demo code only. Invite codes are examples and are not connected to a service.
          </p>
        </section>

        <section className="card p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-lilac text-indigo-600">
              <UserRoundPlus size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Connect with {doctor ? 'a patient' : 'a clinician'}</h2>
              <p className="mt-1 text-sm text-slate-500">Enter the invite code you received.</p>
            </div>
          </div>

          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.trim()) setConnected(true)
            }}
          >
            <input
              className="field uppercase tracking-wider"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={doctor ? 'Patient code' : 'Clinician code'}
            />
            <button className="btn-primary shrink-0">Send request</button>
          </form>
          {connected && (
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-teal">
              <Check size={15} /> Demo request sent. No account was contacted.
            </p>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-semibold">{doctor ? 'Patient connections' : 'Your care team'}</h2>
          <div className="card divide-y divide-slate-100 px-5">
            {(doctor
              ? [
                  ['Nisha Rao', 'Primary care · Connected Sep 02'],
                  ['Arjun Mehta', 'Cardiology · Connected Aug 14'],
                ]
              : [['Dr. Anika Sharma', 'Primary care · Connected Sep 02']]
            ).map(([name, sub], index) => (
              <div key={name} className="flex flex-wrap items-center gap-3 py-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-lilac text-xs font-bold text-indigo-700">
                  {name
                    .split(' ')
                    .slice(-2)
                    .map((x) => x[0])
                    .join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-slate-400">{sub}</p>
                </div>
                <StatusBadge>Active</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-semibold">Pending requests</h2>
          <div className="card divide-y divide-slate-100 px-5">
            {(doctor
              ? [
                  ['Maya Iyer', 'Patient · Requested today'],
                  ['Kabir Shah', 'Patient · Requested yesterday'],
                ]
              : [['Dr. Neil Patel', 'Cardiology · Requested Sep 20']]
            ).map(([name, sub]) => (
              <div key={name} className="flex items-center gap-3 py-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">
                  {name
                    .split(' ')
                    .map((x) => x[0])
                    .join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-slate-400">{sub}</p>
                </div>
                {requestState[name] ? <StatusBadge>{requestState[name]}</StatusBadge> : <>
                  <StatusBadge tone="amber">Pending</StatusBadge>
                  {doctor ? <div className="flex w-full justify-end gap-2 sm:w-auto"><button onClick={() => setRequestState((current) => ({ ...current, [name]: 'Accepted' }))} className="rounded-lg bg-mint px-2.5 py-1.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white">Accept</button><button onClick={() => setRequestState((current) => ({ ...current, [name]: 'Declined' }))} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">Decline</button></div> : <button onClick={() => setRequestState((current) => ({ ...current, [name]: 'Cancelled' }))} className="text-xs font-medium text-slate-500 hover:text-rose-700">Cancel</button>}
                </>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="text-teal" /> A connection does not automatically share
        every record. You decide what to share.
      </p>
    </AppShell>
  )
}
