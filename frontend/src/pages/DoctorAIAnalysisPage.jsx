import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, FileText, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import AppShell from '../components/AppShell'
import DocumentPreview from '../components/DocumentPreview'
import { EmptyState, PageHeading, StatusBadge } from '../components/UI'
import { fetchDoctorPatients, fetchPatientDocumentFile, fetchPatientDocuments, fetchSharedDocumentAnalysis, retrySharedDocumentAnalysis, startSharedDocumentAnalysis } from '../services/accessApi'

function dateLabel(value) { return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date not stated' }

export default function DoctorAIAnalysisPage() {
  const [params, setParams] = useSearchParams()
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState(params.get('patient') || '')
  const [documents, setDocuments] = useState([])
  const [analyses, setAnalyses] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [opening, setOpening] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const activePatients = useMemo(() => patients.filter((entry) => entry.status === 'active' && new Date(entry.expiresAt) > new Date()), [patients])
  const selectedPatient = activePatients.find((entry) => entry.patient.id === patientId)?.patient

  const load = useCallback(async (keepLoading = false) => {
    try {
      const available = await fetchDoctorPatients()
      setPatients(available)
      const chosen = available.find((entry) => entry.patient.id === patientId && entry.status === 'active' && new Date(entry.expiresAt) > new Date())
      if (!chosen) {
        setDocuments([]); setAnalyses({}); setPreview(null)
        if (patientId) setError('This patient has not granted your account active access.')
        return
      }
      const docs = await fetchPatientDocuments(patientId)
      setDocuments(docs)
      const pairs = await Promise.all(docs.map(async (doc) => [doc.id, await fetchSharedDocumentAnalysis(patientId, doc.id)]))
      setAnalyses(Object.fromEntries(pairs))
      setError('')
    } catch (e) { setError(e.message); setDocuments([]); setAnalyses({}); setPreview(null) }
    finally { if (keepLoading) setLoading(false) }
  }, [patientId])

  useEffect(() => { fetchDoctorPatients().then((items) => { setPatients(items); if (!patientId && items[0]) setPatientId(items[0].patient.id) }).catch((e) => setError(e.message)).finally(() => setLoading(false)) }, [])
  useEffect(() => { setParams(patientId ? { patient: patientId, ...(params.get('document') ? { document: params.get('document') } : {}) } : {}, { replace: true }) }, [patientId])
  useEffect(() => {
    if (!patientId) return
    let alive = true
    const refresh = async () => { try { const docs = await fetchPatientDocuments(patientId); const pairs = await Promise.all(docs.map(async (doc) => [doc.id, await fetchSharedDocumentAnalysis(patientId, doc.id)])); if (alive) { setDocuments(docs); setAnalyses(Object.fromEntries(pairs)); setError('') } } catch (e) { if (alive) { setError(e.message); setDocuments([]); setAnalyses({}); setPreview(null) } } }
    const timer = window.setInterval(refresh, 4000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [patientId])
  useEffect(() => { if (patientId) load(true) }, [patientId, load])
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])
  useEffect(() => {
    const id = params.get('document')
    if (!id || !documents.some((document) => document.id === id)) return
    const timer = window.setTimeout(() => document.getElementById(`analysis-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    return () => window.clearTimeout(timer)
  }, [params, documents])

  async function analyze(doc, retry = false) {
    setBusy(doc.id); setError('')
    try {
      const analysis = retry ? await retrySharedDocumentAnalysis(patientId, doc.id) : await startSharedDocumentAnalysis(patientId, doc.id)
      setAnalyses((old) => ({ ...old, [doc.id]: analysis }))
      await load(false)
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
  }

  async function openReport(doc) {
    setOpening(doc.id); setError('')
    try {
      const blob = await fetchPatientDocumentFile(patientId, doc.id)
      const url = URL.createObjectURL(blob)
      setPreview({ document: doc, url })
    } catch (e) { setError(e.message) }
    finally { setOpening('') }
  }

  const documentsWithAnalysis = documents.map((document) => ({ ...document, analysis: analyses[document.id] }))
  return <AppShell role="doctor">
    <PageHeading eyebrow="CLINICIAN WORKSPACE" title="AI Analysis" subtitle="Analyze an individual report shared by a patient. AI output requires professional verification and does not alter the patient's records." action={<Link to="/doctor/summaries" className="btn-secondary">Summaries <ArrowUpRight size={15}/></Link>} />
    <section className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="text-sm font-semibold text-slate-700" htmlFor="analysis-patient">Patient with active access</label>
      <select id="analysis-patient" className="field max-w-xl" value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Select a patient</option>{activePatients.map((entry) => <option key={entry.patient.id} value={entry.patient.id}>{entry.patient.name} · {entry.patient.email}</option>)}</select>
    </section>
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error} Check that patient access is still active, then retry.</p>}
    {!patientId ? loading ? <div role="status" className="card flex justify-center p-8 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/>Loading shared patients…</div> : <EmptyState title="No active patients" text="A patient must grant your account access before their reports are available."/> : null}
    {patientId && selectedPatient && <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Reports shared by {selectedPatient.name}</p><p className="text-xs text-slate-500">Each report and analysis is checked against the active patient-sharing grant.</p></div><Link to={`/doctor/summaries?patient=${encodeURIComponent(patientId)}`} className="text-sm font-semibold text-teal">Open patient summary →</Link></div>
      {documentsWithAnalysis.length === 0 ? <EmptyState title="No shared reports" text="This patient has no documents available under the current grant."/> : <div className="space-y-4">{documentsWithAnalysis.map((doc) => <ReportAnalysisCard key={doc.id} doc={doc} loading={busy === doc.id} opening={opening === doc.id} onAnalyze={() => analyze(doc)} onRetry={() => analyze(doc, true)} onOpen={() => openReport(doc)}/>)}</div>}
    </>}
    <DocumentPreview preview={preview} onClose={() => setPreview(null)}/>
  </AppShell>
}

function ReportAnalysisCard({ doc, loading, opening, onAnalyze, onRetry, onOpen }) {
  const analysis = doc.analysis || { status: doc.analysisStatus || 'not_requested', result: null }
  const stateLabel = { not_requested: 'Not analyzed', pending: 'Pending', processing: 'Processing', completed: 'Completed', failed: 'Failed' }[analysis.status] || analysis.status
  const result = analysis.result
  return <article id={`analysis-${doc.id}`} className="card scroll-mt-8 p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint text-teal"><FileText size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold" title={doc.title}>{doc.title}</h2><StatusBadge tone={analysis.status === 'failed' ? 'amber' : analysis.status === 'completed' ? 'green' : 'gray'}>{stateLabel}</StatusBadge></div><p className="mt-1 text-xs text-slate-500">{doc.originalFileName} · Report date {dateLabel(doc.eventDate)} · Uploaded {dateLabel(doc.uploadedAt)}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary !px-3 !py-2 text-xs" disabled={opening} onClick={onOpen}>{opening ? <LoaderCircle size={14} className="animate-spin"/> : <FileText size={14}/>}Open report</button>{analysis.status === 'failed' ? <button className="btn-primary !px-3 !py-2 text-xs" disabled={loading} onClick={onRetry}>{loading ? <LoaderCircle size={14} className="animate-spin"/> : <RefreshCw size={14}/>}Retry</button> : analysis.status === 'not_requested' ? <button className="btn-primary !px-3 !py-2 text-xs" disabled={loading} onClick={onAnalyze}>{loading ? <LoaderCircle size={14} className="animate-spin"/> : <Sparkles size={14}/>}Analyze report</button> : null}</div></div>
    {(analysis.status === 'pending' || analysis.status === 'processing') && <p role="status" className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Analysis {analysis.status}. This can take a short while; the status updates automatically.</p>}
    {analysis.status === 'failed' && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">Analysis failed ({analysis.lastErrorCode || 'ANALYSIS_FAILED'}). Retry this report or verify the source file is readable.</p>}
    {result && <div className="mt-5 border-t border-slate-100 pt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">AI-extracted findings</h3><span className="text-xs text-slate-500">{analysis.confirmed ? 'Patient-confirmed' : 'Unconfirmed AI extraction'} · Verify against the source report</span></div>
      {result.reportDate && <p className="mb-3 text-sm"><span className="font-medium">Report date:</span> {result.reportDate}</p>}
      {result.tests?.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="pb-2">Test</th><th className="pb-2">Value</th><th className="pb-2">Reference range</th><th className="pb-2">Report flag</th></tr></thead><tbody className="divide-y divide-slate-100">{result.tests.map((test, index) => <tr key={`${test.name}-${index}`}><td className="py-2 pr-3 font-medium">{test.name}</td><td className="py-2 pr-3">{test.value ?? 'Not stated'} {test.unit || ''}</td><td className="py-2 pr-3">{test.referenceRange || 'Not stated'}</td><td className="py-2">{test.abnormalFlag || 'Not stated'}</td></tr>)}</tbody></table></div>}
      {result.findings?.length > 0 && <ul className="mt-3 space-y-2">{result.findings.map((finding, index) => <li key={index} className="rounded-xl bg-slate-50 p-3 text-sm"><p>{finding.text}</p>{finding.evidence && <p className="mt-1 text-xs text-slate-500">Source: “{finding.evidence}”</p>}</li>)}</ul>}
      {!result.reportDate && !result.tests?.length && !result.findings?.length && <p className="text-sm text-slate-500">No supported findings could be extracted from this report.</p>}
    </div>}
  </article>
}
