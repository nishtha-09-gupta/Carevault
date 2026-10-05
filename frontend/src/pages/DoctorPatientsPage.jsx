import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Download, LoaderCircle, UsersRound } from 'lucide-react'
import AppShell from '../components/AppShell'
import { EmptyState, PageHeading, RecordIcon, StatusBadge } from '../components/UI'
import { fetchDoctorPatients, fetchPatientDocumentFile, fetchPatientDocuments } from '../services/accessApi'

function dateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function DoctorPatientsPage() {
  const [params] = useSearchParams()
  const query = (params.get('q') || '').trim().toLowerCase()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetchDoctorPatients().then(setPatients).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])
  const visiblePatients = patients.filter((item) => [item.patient.name, item.patient.email].join(' ').toLowerCase().includes(query))

  return <AppShell role="doctor">
    <PageHeading eyebrow="CLINICIAN WORKSPACE" title="Patients" subtitle="Patients who have granted your account active, time-limited access to their CareVault records." action={<span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-teal"><UsersRound size={14}/>{patients.length} active</span>} />
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {loading ? <div role="status" className="card flex justify-center p-10 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin text-teal" size={18}/>Loading active patient access…</div>
      : patients.length === 0 ? <EmptyState title="No patients have shared their records with you yet." text="When a patient grants your account access, they will appear here until that access expires or is revoked."/>
      : visiblePatients.length === 0 ? <EmptyState title="No matching patients" text="Try another name or email."/>
      : <div className="space-y-3">{visiblePatients.map((item) => <article key={item.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lilac text-sm font-bold text-indigo-700">{item.patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
        <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{item.patient.name}</h2><p className="truncate text-xs text-slate-500">{item.patient.email}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 size={13}/>Granted {dateTime(item.grantedAt)}</span><span>Expires {dateTime(item.expiresAt)}</span><span>{item.documentCount} {item.documentCount === 1 ? 'document' : 'documents'}</span></p></div>
        <StatusBadge>Active</StatusBadge>
        <Link to={`/doctor/patients/${item.patient.id}`} className="btn-primary">View records</Link>
      </article>)}</div>}
  </AppShell>
}

export function DoctorPatientPage() {
  const { patientId } = useParams()
  const [patient, setPatient] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState('')

  useEffect(() => {
    let current = true
    setLoading(true)
    Promise.all([fetchDoctorPatients(), fetchPatientDocuments(patientId)]).then(([patients, docs]) => {
      if (!current) return
      const access = patients.find((entry) => entry.patient.id === patientId)
      if (!access) throw new Error('This patient has not granted your account active access.')
      setPatient(access)
      setDocuments(docs)
    }).catch((e) => { if (current) setError(e.message) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [patientId])

  async function openDocument(document) {
    setOpening(document.id)
    setError('')
    const tab = window.open('about:blank', '_blank')
    if (!tab) { setOpening(''); setError('Allow pop-ups to open this document.'); return }
    tab.opener = null
    try {
      const blob = await fetchPatientDocumentFile(patientId, document.id)
      const url = URL.createObjectURL(blob)
      tab.location.replace(url)
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    } catch (e) { tab.close(); setError(e.message) } finally { setOpening('') }
  }

  return <AppShell role="doctor">
    <Link to="/doctor/patients" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-teal"><ArrowLeft size={16}/>All patients</Link>
    {loading ? <div role="status" className="card flex justify-center p-10 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin text-teal" size={18}/>Checking access and loading records…</div>
      : error && !patient ? <div className="card p-6"><p role="alert" className="text-sm text-rose-700">{error}</p></div>
      : <>
        <PageHeading eyebrow="SHARED PATIENT RECORD" title={patient.patient.name} subtitle={patient.patient.email} action={<StatusBadge>Active access</StatusBadge>} />
        <p className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500"><span>Granted {dateTime(patient.grantedAt)}</span><span>Expires {dateTime(patient.expiresAt)}</span></p>
        {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        <section><h2 className="mb-4 font-semibold">Medical documents <span className="ml-1 text-xs font-normal text-slate-400">{documents.length}</span></h2>
          {documents.length === 0 ? <EmptyState title="No documents available" text="This patient has no documents stored in CareVault."/> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{documents.map((doc) => <article key={doc.id} className="card flex min-w-0 items-center gap-3 p-4"><RecordIcon lab={doc.fileType === 'application/pdf'}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={doc.originalFileName}>{doc.title}</p><p className="mt-1 text-xs text-slate-500">Uploaded {dateTime(doc.uploadedAt)}</p></div><button type="button" disabled={opening === doc.id} onClick={() => openDocument(doc)} className="btn-secondary !px-3 !py-2 text-xs">{opening === doc.id ? <LoaderCircle size={14} className="animate-spin"/> : <Download size={14}/>}Open</button></article>)}</div>}
        </section>
        <section className="card mt-7 p-5"><h2 className="font-semibold">Health history</h2><p className="mt-2 text-sm leading-6 text-slate-500">CareVault does not currently store patient timeline or health-history entries in the database. Only the documents listed above are available through this active access grant.</p></section>
      </>}
  </AppShell>
}
