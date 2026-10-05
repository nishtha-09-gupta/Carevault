import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, LoaderCircle, Plus } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading, RecordIcon, SectionTitle, StatCard, StatusBadge } from '../components/UI'
import { useAuth } from '../components/AuthContext'
import { fetchDocuments } from '../services/documentApi'
import { fetchDoctorPatients } from '../services/accessApi'
import { fetchAccessGrants } from '../services/accessApi'

export function PatientDashboard() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [grants, setGrants] = useState([])
  const [error, setError] = useState('')
  const [accessError, setAccessError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetchDocuments(controller.signal).then(setDocuments).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    })
    fetchAccessGrants().then(setGrants).catch((requestError) => setAccessError(requestError.message))
    return () => controller.abort()
  }, [])
  const activeGrants = grants.filter((grant) => grant.status === 'active' && new Date(grant.expiresAt).getTime() > Date.now())
  const recentDocuments = documents.slice(0, 3)
  const fileSize = (size) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
  const fileType = (document) => document.fileType === 'application/pdf' ? 'PDF' : document.fileType === 'image/jpeg' ? 'JPEG image' : 'PNG image'
  return (
    <AppShell>
      <PageHeading
        eyebrow="PATIENT OVERVIEW"
        title={`Welcome, ${user?.name || 'there'}`}
        subtitle="Your medical records, securely in one place."
        action={
          <Link to="/documents" className="btn-primary">
            <Plus size={16} /> Add a document
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">MEDICAL RECORDS</p><p className="mt-3 text-3xl font-bold">{error ? '—' : documents.length}</p><p className="mt-1 text-sm text-slate-500">{error || 'Documents stored in your private library'}</p><Link to="/documents" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal">Open document library <ArrowRight size={15}/></Link></section>
        <section className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ACTIVE DOCTOR ACCESS</p><p className="mt-3 text-3xl font-bold">{accessError ? '—' : activeGrants.length}</p><p className="mt-1 text-sm text-slate-500">{accessError || 'You control who can view your records'}</p><Link to="/sharing" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal">Review sharing & access <ArrowRight size={15}/></Link></section>
      </div>
      <section className="mt-8"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Recent records</h2><Link to="/documents" className="text-xs font-semibold text-teal hover:underline">All documents →</Link></div>
        {error ? <p role="alert" className="card p-5 text-sm text-rose-700">{error}</p>
          : documents.length === 0 ? <div className="card p-8 text-center text-sm text-slate-500">Your CareVault document library is empty.</div>
          : <div className="card divide-y divide-slate-100 px-5">{recentDocuments.map((document) => <Link key={document.id} to="/documents" className="flex flex-wrap items-center gap-3 py-4"><RecordIcon lab={document.fileType === 'application/pdf'}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{document.title}</p><p className="mt-1 text-xs text-slate-500">{fileType(document)} · {new Date(document.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p></div><span className="text-xs text-slate-400">{fileSize(document.fileSize)}</span></Link>)}</div>}
      </section>
      {activeGrants.length > 0 && <section className="mt-8"><h2 className="mb-4 font-semibold">Doctors with active access</h2><div className="card divide-y divide-slate-100 px-5">{activeGrants.map((grant) => <div key={grant.id} className="flex flex-wrap items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{grant.doctor?.name || 'Doctor account'}</p><p className="text-xs text-slate-500">Access expires {new Date(grant.expiresAt).toLocaleString()}</p></div><StatusBadge>Active</StatusBadge></div>)}</div></section>}
    </AppShell>
  )
}

export function DoctorDashboard() {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [patientError, setPatientError] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    let mounted = true
    const load = () => fetchDoctorPatients().then((items) => { if (mounted) { setPatients(items); setPatientError('') } }).catch((error) => { if (mounted) setPatientError(error.message) }).finally(() => { if (mounted) setLoadingPatients(false) })
    load()
    const refresh = window.setInterval(load, 30000)
    const tick = window.setInterval(() => setNow(Date.now()), 10000)
    return () => { mounted = false; window.clearInterval(refresh); window.clearInterval(tick) }
  }, [])
  const activePatients = patients.filter((patient) => patient.status === 'active' && new Date(patient.expiresAt).getTime() > now)
  const attentionPatients = activePatients.filter((patient) => new Date(patient.expiresAt).getTime() - now <= 24 * 60 * 60 * 1000)
  const remaining = (expiresAt) => {
    const minutes = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 60000))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    return days ? `${days}d ${hours % 24}h remaining` : hours ? `${hours}h ${minutes % 60}m remaining` : `${minutes}m remaining`
  }
  return (
    <AppShell role="doctor">
      <PageHeading
        eyebrow="CLINICIAN WORKSPACE"
        title={`Welcome, ${user?.name || 'clinician'}`}
        subtitle="View patient documents only while the patient’s time-limited access grant is active."
        action={<Link to="/doctor/patients" className="btn-primary">Patients <ArrowRight size={16} /></Link>}
      />
      <section className="mb-7 grid gap-4 sm:grid-cols-2">
        <div className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ACTIVE PATIENTS</p><p className="mt-3 text-3xl font-bold">{loadingPatients ? '—' : activePatients.length}</p><Link to="/doctor/patients" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">Open patient list <ArrowRight size={15}/></Link></div>
        <div className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">RECORD ACCESS</p><p className="mt-3 text-sm leading-6 text-slate-600">You can view a patient’s CareVault documents while their access grant is active. Every document request is checked against the patient, doctor, and expiry.</p></div>
      </section>
      <section><h2 className="mb-4 font-semibold">Patients with active access</h2>
        {patientError ? <p role="alert" className="card p-5 text-sm text-rose-700">{patientError}</p>
          : loadingPatients ? <div role="status" className="card flex justify-center p-8 text-sm text-slate-500"><LoaderCircle size={17} className="mr-2 animate-spin"/>Loading active access…</div>
          : activePatients.length === 0 ? <div className="card p-8 text-center text-sm text-slate-500">No patients have shared their records with you yet.</div>
          : <div className="space-y-3">{activePatients.slice(0, 5).map((item) => <article key={item.id} className="card flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{item.patient.name}</p><p className="text-xs text-slate-500">{item.documentCount} documents · Expires {new Date(item.expiresAt).toLocaleString()}</p></div><Link to={`/doctor/patients/${item.patient.id}`} className="btn-secondary">View patient</Link></article>)}</div>}
      </section>
      {!loadingPatients && attentionPatients.length > 0 && <section className="mt-7"><h2 className="mb-1 font-semibold">Access requiring attention</h2><p className="mb-4 text-sm text-slate-500">These patient grants expire within the next 24 hours.</p><div className="space-y-3">{attentionPatients.map((item) => <article key={item.id} className="card flex flex-wrap items-center gap-3 border-amber-200 p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{item.patient.name}</p><p className="text-xs text-slate-500">{item.documentCount} shared {item.documentCount === 1 ? 'document' : 'documents'} · Expires {new Date(item.expiresAt).toLocaleString()}</p></div><span className="text-xs font-semibold text-amber-700">{remaining(item.expiresAt)}</span><Link to={`/doctor/patients/${item.patient.id}`} className="btn-secondary">View patient</Link></article>)}</div></section>}
    </AppShell>
  )
}

export function RecordRow({ record }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <RecordIcon lab={record.lab} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{record.title}</p>
        <p className="mt-1 truncate text-xs text-slate-400">
          {record.provider} · {record.date}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-xs text-slate-500">{record.type}</p>
        <div className="mt-1">
          <StatusBadge tone={record.status === 'Private' ? 'gray' : 'green'}>
            {record.status}
          </StatusBadge>
        </div>
      </div>
    </div>
  )
}
