import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, LoaderCircle, Plus } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading, RecordIcon, SectionTitle, StatCard, StatusBadge } from '../components/UI'
import { useAuth } from '../components/AuthContext'
import { fetchDocuments } from '../services/documentApi'
import { fetchDoctorPatients } from '../services/accessApi'

export function PatientDashboard() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetchDocuments(controller.signal).then(setDocuments).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    })
    return () => controller.abort()
  }, [])
  return (
    <AppShell>
      <PageHeading
        eyebrow="PATIENT OVERVIEW"
        title={`Welcome, ${user?.name || 'there'}`}
        subtitle="Your private workspace for health documents. Upload records to keep them organized and available when you need them."
        action={
          <Link to="/documents" className="btn-primary">
            <Plus size={16} /> Add a document
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">PRIVATE DOCUMENTS</p><p className="mt-3 text-3xl font-bold">{error ? '—' : documents.length}</p><p className="mt-1 text-sm text-slate-500">{error || 'Files stored in your account library'}</p><Link to="/documents" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal">Open document library <ArrowRight size={15}/></Link></section>
        <section className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">YOUR ACCOUNT</p><p className="mt-3 text-lg font-semibold">Private by default</p><p className="mt-1 text-sm leading-6 text-slate-500">Only your account can access your documents unless you grant a doctor time-limited access. You can revoke that access at any time.</p></section>
      </div>
      <p className="mt-6 text-xs leading-5 text-slate-400">Uploaded documents are stored in your account. The timeline and health details still use sample information; document sharing is limited to access you explicitly grant.</p>
    </AppShell>
  )
}

export function DoctorDashboard() {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [patientError, setPatientError] = useState('')
  useEffect(() => {
    fetchDoctorPatients().then(setPatients).catch((error) => setPatientError(error.message)).finally(() => setLoadingPatients(false))
  }, [])
  return (
    <AppShell role="doctor">
      <PageHeading
        eyebrow="CLINICIAN WORKSPACE"
        title={`Welcome, ${user?.name || 'clinician'}`}
        subtitle="View patient documents only while the patient’s time-limited access grant is active."
        action={<Link to="/doctor/patients" className="btn-primary">Patients <ArrowRight size={16} /></Link>}
      />
      <section className="mb-7 grid gap-4 sm:grid-cols-2">
        <div className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ACTIVE PATIENTS</p><p className="mt-3 text-3xl font-bold">{loadingPatients ? '—' : patients.length}</p><Link to="/doctor/patients" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">Open patient list <ArrowRight size={15}/></Link></div>
        <div className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">RECORD ACCESS</p><p className="mt-3 text-sm leading-6 text-slate-600">You can view a patient’s CareVault documents while their access grant is active. Every document request is checked against the patient, doctor, and expiry.</p></div>
      </section>
      <section><h2 className="mb-4 font-semibold">Patients with active access</h2>
        {patientError ? <p role="alert" className="card p-5 text-sm text-rose-700">{patientError}</p>
          : loadingPatients ? <div role="status" className="card flex justify-center p-8 text-sm text-slate-500"><LoaderCircle size={17} className="mr-2 animate-spin"/>Loading active access…</div>
          : patients.length === 0 ? <div className="card p-8 text-center text-sm text-slate-500">No patients have shared their records with you yet.</div>
          : <div className="space-y-3">{patients.slice(0, 5).map((item) => <article key={item.id} className="card flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{item.patient.name}</p><p className="text-xs text-slate-500">{item.documentCount} documents · Expires {new Date(item.expiresAt).toLocaleString()}</p></div><Link to={`/doctor/patients/${item.patient.id}`} className="btn-secondary">View records</Link></article>)}</div>}
      </section>
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
