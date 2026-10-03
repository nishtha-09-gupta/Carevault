import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Plus } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading, RecordIcon, SectionTitle, StatCard, StatusBadge } from '../components/UI'
import { useAuth } from '../components/AuthContext'
import { fetchDocuments } from '../services/documentApi'

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
        <section className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">YOUR ACCOUNT</p><p className="mt-3 text-lg font-semibold">Private by default</p><p className="mt-1 text-sm leading-6 text-slate-500">Only your signed-in account can list, open, or delete its documents. Sharing and care connections are not enabled yet.</p></section>
      </div>
      <p className="mt-6 text-xs leading-5 text-slate-400">Uploaded documents are stored in your account. The timeline, health details, and clinician sharing screens are not connected yet; do not rely on them as a medical record.</p>
    </AppShell>
  )
}

export function DoctorDashboard() {
  const { user } = useAuth()
  return (
    <AppShell role="doctor">
      <PageHeading
        eyebrow="CLINICIAN WORKSPACE"
        title={`Welcome, ${user?.name || 'clinician'}`}
        subtitle="Your private account is ready. Clinician verification and patient sharing are not enabled yet."
        action={<Link to="/doctor/documents" className="btn-primary"><Plus size={16} /> Manage documents</Link>}
      />
      <div className="card p-6"><p className="font-semibold">Clinician workspace status</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This account can store its own documents. Patient lists, connection requests, shared records, and care permissions are prototype views and do not expose another account's information.</p><Link to="/doctor/documents" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal">Go to private documents <ArrowRight size={15}/></Link></div>
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
