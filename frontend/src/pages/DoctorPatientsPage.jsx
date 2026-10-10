import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock3, FileText, LoaderCircle, UsersRound } from 'lucide-react'
import AppShell from '../components/AppShell'
import { EmptyState, PageHeading, RecordIcon, StatusBadge } from '../components/UI'
import DocumentPreview from '../components/DocumentPreview'
import { fetchDoctorPatientAccess, fetchDoctorPatients, fetchPatientDocumentFile, fetchPatientDocuments, fetchPatientHealthIntake } from '../services/accessApi'

function dateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function remainingTime(value, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((new Date(value).getTime() - now) / 60000))
  if (!minutes) return 'Expired'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days) return `${days}d ${hours}h remaining`
  if (hours) return `${hours}h ${rest}m remaining`
  return `${rest}m remaining`
}

export function DoctorPatientsPage() {
  const [params] = useSearchParams()
  const query = (params.get('q') || '').trim().toLowerCase()
  const [patients, setPatients] = useState([])
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    fetchDoctorPatients().then(setPatients).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
    const poll = window.setInterval(load, 5000)
    const tick = window.setInterval(() => setNow(Date.now()), 10000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [load])

  const activePatients = patients.filter((item) => item.status === 'active' && new Date(item.expiresAt).getTime() > now)
  const visiblePatients = activePatients.filter((item) => [item.patient.name, item.patient.email].join(' ').toLowerCase().includes(query))

  return <AppShell role="doctor">
    <PageHeading eyebrow="CLINICIAN WORKSPACE" title="Patients" subtitle="Patients who have granted your account active, time-limited access to their CareVault records." action={<span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-teal"><UsersRound size={14}/>{activePatients.length} active</span>} />
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {loading ? <div role="status" className="card flex justify-center p-10 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin text-teal" size={18}/>Loading active patient access…</div>
      : visiblePatients.length === 0 ? <EmptyState title={query ? 'No matching active patients' : 'No patients have shared their records with you yet.'} text={query ? 'Search only includes patients with current access. Try another name or email.' : 'When a patient grants your account access, they will appear here until that access expires or is revoked.'}/>
      : <div className="space-y-3">{visiblePatients.map((item) => <PatientAccessCard key={item.id} item={item} now={now}/>)}</div>}
  </AppShell>
}

function PatientAccessCard({ item, now }) {
  const urgency = new Date(item.expiresAt).getTime() - now <= 24 * 60 * 60 * 1000
  return <article className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
    <PatientAvatar name={item.patient.name}/>
    <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{item.patient.name}</h2><p className="truncate text-xs text-slate-500">{item.patient.email}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span>Granted {dateTime(item.grantedAt)}</span><span>Expires {dateTime(item.expiresAt)}</span><span>{item.documentCount} {item.documentCount === 1 ? 'document' : 'documents'}</span></p></div>
    <div className="flex items-center gap-2"><StatusBadge tone={urgency ? 'amber' : 'green'}>{urgency ? 'Expiring soon' : 'Active'}</StatusBadge><span className="text-xs text-slate-500">{remainingTime(item.expiresAt, now)}</span></div>
    <Link to={`/doctor/patients/${item.patient.id}`} className="btn-primary">View records</Link>
  </article>
}

function PatientAvatar({ name }) {
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lilac text-sm font-bold text-indigo-700">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
}

export function DoctorPatientPage() {
  const { patientId } = useParams()
  const [access, setAccess] = useState(null)
  const [documents, setDocuments] = useState([])
  const [intake, setIntake] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState('')
  const [preview, setPreview] = useState(null)
  const [now, setNow] = useState(Date.now())
  const expires = access ? new Date(access.expiresAt).getTime() : 0
  const isActive = access?.status === 'active' && expires > now

  const load = useCallback(async () => {
    try {
      const current = await fetchDoctorPatientAccess(patientId)
      setAccess(current)
      if (current.status !== 'active' || new Date(current.expiresAt).getTime() <= Date.now()) {
        setDocuments([])
        setIntake(null)
        setPreview(null)
        return
      }
      const [docs, currentIntake] = await Promise.all([
        fetchPatientDocuments(patientId),
        fetchPatientHealthIntake(patientId),
      ])
      setDocuments(docs)
      setIntake(currentIntake)
      setError('')
    } catch (e) {
      setDocuments([])
      setIntake(null)
      setPreview(null)
      setError(e.message)
      setAccess(null)
    } finally { setLoading(false) }
  }, [patientId])

  useEffect(() => {
    setLoading(true)
    load()
    const poll = window.setInterval(load, 5000)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [load])

  useEffect(() => {
    if (!isActive) {
      setDocuments([])
      setPreview(null)
    }
  }, [isActive])

  const closePreview = useCallback(() => setPreview(null), [])
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  async function previewDocument(document) {
    if (!isActive) return
    setOpening(document.id)
    setError('')
    try {
      const blob = await fetchPatientDocumentFile(patientId, document.id)
      if (Date.now() >= expires) throw new Error('Access to this patient’s records has expired.')
      const url = URL.createObjectURL(blob)
      setPreview({ document, url })
    } catch (e) {
      setError(e.message)
      if (/active access|not granted/i.test(e.message)) { setDocuments([]); setAccess(null) }
    } finally { setOpening('') }
  }

  const fileLabel = (doc) => ({ 'application/pdf': 'PDF', 'image/jpeg': 'JPEG image', 'image/png': 'PNG image' }[doc.fileType] || 'Document')
  const fileSize = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`

  return <AppShell role="doctor">
    <Link to="/doctor/patients" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-teal"><ArrowLeft size={16}/>All patients</Link>
    {loading ? <div role="status" className="card flex justify-center p-10 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin text-teal" size={18}/>Checking access and loading records…</div>
      : error && !access ? <div className="card p-6"><p role="alert" className="text-sm text-rose-700">{error}</p><Link to="/doctor/patients" className="mt-4 inline-flex text-sm font-semibold text-teal">Back to active patients</Link></div>
      : access && <>
        <PageHeading eyebrow="SHARED PATIENT RECORD" title={access.patient.name} subtitle={access.patient.email} action={<div className="flex items-center gap-2"><PatientAvatar name={access.patient.name}/><StatusBadge tone={isActive ? 'green' : 'amber'}>{isActive ? 'Active access' : 'Expired'}</StatusBadge></div>} />
        <section className="card mb-7 p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><Clock3 size={18}/></span><div><h2 className="font-semibold">Access is temporary and controlled by the patient.</h2><p className="mt-1 text-sm text-slate-500">Your access is limited to the records the patient stored in CareVault.</p></div></div>
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3"><Info label="Status" value={isActive ? 'Active' : 'Expired'}/><Info label="Granted at" value={dateTime(access.grantedAt)}/><Info label="Expires at" value={dateTime(access.expiresAt)}/></div>
          {isActive && <p className="mt-4 text-sm font-medium text-teal">{remainingTime(access.expiresAt, now)}</p>}
        </section>
        {!isActive ? <div role="status" className="mb-7 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Access to this patient’s records has expired. Documents are no longer available.</div> : null}
        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Medical records</h2>{isActive && <span className="text-xs text-slate-400">{documents.length} documents</span>}</div>
          {!isActive ? null : documents.length === 0 ? <EmptyState title="No documents available" text="This patient has no documents stored in CareVault."/> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{documents.map((doc) => <article key={doc.id} className="card flex min-w-0 flex-col p-4">
            <div className="flex min-w-0 items-center gap-3"><RecordIcon lab={doc.fileType === 'application/pdf'}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={doc.originalFileName}>{doc.title}</p><p className="mt-1 truncate text-xs text-slate-500">{fileLabel(doc)} · {fileSize(doc.fileSize)}</p></div></div>
            <p className="mt-3 text-xs text-slate-400">Uploaded {dateTime(doc.uploadedAt)}</p>
            <button type="button" disabled={opening === doc.id || !isActive} onClick={() => previewDocument(doc)} className="btn-secondary mt-4 w-full !px-3 !py-2 text-xs">{opening === doc.id ? <LoaderCircle size={14} className="animate-spin"/> : <FileText size={14}/>}Open document</button>
          </article>)}</div>}
        </section>
        <section className="card mt-7 p-5 sm:p-6"><h2 className="font-semibold">Patient health intake</h2>
          {!isActive ? <p className="mt-2 text-sm text-slate-500">Patient intake is unavailable without active access.</p>
            : !intake ? <p className="mt-2 text-sm text-slate-500">No submitted health intake is available.</p>
            : <><p className="mt-1 text-xs text-slate-400">Updated {dateTime(intake.updatedAt)}</p><dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <IntakeDetail label="Main concern" value={intake.mainConcern}/>
              {intake.startedAt && <IntakeDetail label="When it began" value={dateTime(intake.startedAt)}/>}
              {intake.impact && <IntakeDetail label="Impact" value={intake.impact}/>}
              {intake.allergies && <IntakeDetail label="Known allergies" value={intake.allergies}/>}
              {intake.medications && <IntakeDetail label="Current medications" value={intake.medications}/>}
              {intake.additionalNotes && <IntakeDetail label="Additional notes" value={intake.additionalNotes}/>}
            </dl></>}
        </section>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        <section className="card mt-7 p-5"><h2 className="font-semibold">Health history</h2><p className="mt-2 text-sm leading-6 text-slate-500">This view contains only documents shared under the active access grant and health intake the patient submitted.</p></section>
      </>}
    <DocumentPreview preview={preview} onClose={closePreview}/>
  </AppShell>
}

function Info({ label, value }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-700">{value}</p></div>
}

function IntakeDetail({ label, value }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</dd></div>
}
