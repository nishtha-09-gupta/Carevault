import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, FileText, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import AppShell from '../components/AppShell'
import { EmptyState, PageHeading, StatusBadge } from '../components/UI'
import { fetchDoctorPatients, fetchPatientSummary, generatePatientSummary } from '../services/accessApi'

function dateLabel(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available' }

export default function DoctorSummariesPage() {
  const [params, setParams] = useSearchParams()
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState(params.get('patient') || '')
  const [patient, setPatient] = useState(null)
  const [summary, setSummary] = useState(null)
  const [freshness, setFreshness] = useState('not_generated')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const activePatients = patients.filter((entry) => entry.status === 'active' && new Date(entry.expiresAt) > new Date())

  const load = useCallback(async (showLoading = false) => {
    if (!patientId) { setSummary(null); setPatient(null); setLoading(false); return }
    if (showLoading) setLoading(true)
    try {
      const result = await fetchPatientSummary(patientId)
      setPatient(result.patient); setSummary(result.summary); setFreshness(result.freshness || result.summary?.freshness || 'not_generated'); setError('')
    } catch (e) { setSummary(null); setPatient(null); setError(e.message) }
    finally { setLoading(false) }
  }, [patientId])

  useEffect(() => { fetchDoctorPatients().then((items) => { setPatients(items); if (!patientId && items[0]) setPatientId(items[0].patient.id) }).catch((e) => setError(e.message)).finally(() => setLoading(false)) }, [])
  useEffect(() => { setParams(patientId ? { patient: patientId } : {}, { replace: true }) }, [patientId])
  useEffect(() => { load(true) }, [patientId, load])
  useEffect(() => {
    if (!patientId) return
    const poll = window.setInterval(() => load(false), summary?.status === 'generating' ? 3000 : 10000)
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') load(false) }
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () => { window.clearInterval(poll); window.removeEventListener('focus', refreshOnReturn); document.removeEventListener('visibilitychange', refreshOnReturn) }
  }, [patientId, summary?.status, load])

  async function generate(refresh = false) {
    setGenerating(true); setError('')
    try {
      const result = await generatePatientSummary(patientId, { refresh })
      setPatient(result.patient); setSummary(result.summary); setFreshness(result.summary?.freshness || 'current')
      if (result.summary?.status === 'generating') setTimeout(() => load(false), 1000)
    } catch (e) { setError(e.message); await load(false) }
    finally { setGenerating(false) }
  }

  const hasCurrent = summary?.status === 'completed' && freshness === 'current'
  const statement = (item, index, kind) => <li key={`${kind}-${index}`} className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-sm font-medium text-slate-800">{item.text}</p><p className="mt-1 text-xs text-slate-500">Evidence: “{item.evidence}”</p><div className="mt-2 flex flex-wrap items-center gap-2">{item.sources?.map((source) => <span key={source.id} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${source.verification === 'unconfirmed-ai-extraction' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{source.verification.replaceAll('-', ' ')} · {dateLabel(source.date)}</span>)}{item.sources?.filter((source) => source.documentId).map((source) => <Link key={`${source.id}-link`} to={`/doctor/ai-analysis?patient=${encodeURIComponent(patientId)}&document=${encodeURIComponent(source.documentId)}`} className="text-xs font-semibold text-teal">Open source report <ArrowUpRight size={13}/></Link>)}</div></li>

  return <AppShell role="doctor">
    <PageHeading eyebrow="CLINICIAN WORKSPACE" title="Summaries" subtitle="A separate consolidated view of information from reports and patient records you are authorized to access. AI-generated summaries require professional verification." action={<Link to="/doctor/ai-analysis" className="btn-secondary">AI Analysis <ArrowUpRight size={15}/></Link>} />
    <section className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><label htmlFor="summary-patient" className="text-sm font-semibold">Patient with active access</label><select id="summary-patient" className="field max-w-xl" value={patientId} onChange={(event) => setPatientId(event.target.value)}><option value="">Select a patient</option>{activePatients.map((entry) => <option key={entry.patient.id} value={entry.patient.id}>{entry.patient.name} · {entry.patient.email}</option>)}</select></section>
    {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error} Confirm active patient access and retry.</p>}
    {!patientId ? loading ? <div role="status" className="card flex justify-center p-8 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/>Loading shared patients…</div> : <EmptyState title="No active patients" text="A patient must grant your account access before a summary can be generated."/> : null}
    {patientId && loading ? <div role="status" className="card flex justify-center p-8 text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18}/>Checking current access and loading summary…</div> : null}
    {patientId && !loading && patient && <>
      <section className="card mb-5 flex flex-wrap items-start justify-between gap-4 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">PATIENT</p><h2 className="mt-1 text-lg font-semibold">{patient.name}</h2><p className="text-sm text-slate-500">{patient.email}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={hasCurrent ? 'green' : freshness === 'needs_refresh' ? 'amber' : 'gray'}>{hasCurrent ? 'Current' : freshness === 'needs_refresh' ? 'Needs refresh' : summary?.status === 'generating' ? 'Generating' : summary?.status === 'failed' ? 'Failed' : 'No summary'}</StatusBadge><button type="button" className="btn-primary" disabled={generating || summary?.status === 'generating'} onClick={() => generate(Boolean(summary))}>{generating || summary?.status === 'generating' ? <LoaderCircle size={15} className="animate-spin"/> : summary ? <RefreshCw size={15}/> : <Sparkles size={15} />}{summary?.status === 'failed' ? 'Retry generation' : summary ? 'Regenerate summary' : 'Generate summary'}</button></div></section>
      {summary?.status === 'generating' && <p role="status" className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Summary generation is in progress. This page will update automatically.</p>}
      {summary?.status === 'failed' && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Generation failed ({summary.lastErrorCode || 'SUMMARY_GENERATION_FAILED'}). Check Groq backend configuration and retry.</div>}
      {!summary && !error && <EmptyState title="No summary yet" text="Generate a consolidated summary from this patient's available medical records, submitted intake, and completed report analyses."/>}
      {summary?.status === 'completed' && <>
        <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">Medical information summary</h2><p className="mt-1 text-sm text-slate-500">Generated {dateLabel(summary.generatedAt)} · Last updated {dateLabel(summary.updatedAt)}</p></div><StatusBadge tone="amber">AI-generated · Verify clinically</StatusBadge></div>
          <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900">This summary organizes cited source information. It is not a diagnosis or treatment recommendation. “Unconfirmed AI extraction” indicates the patient has not confirmed that source analysis.</p>
          {summary.insufficientInformation && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">There is insufficient reliable information in the available records for a fuller summary.</p>}
          <SummaryList title="Key information" items={summary.keyPoints} renderItem={statement} kind="point"/>
          <SummaryList title="Documented medications" items={summary.medications} renderItem={statement} kind="medication"/>
          <SummaryList title="Documented allergies" items={summary.allergies} renderItem={statement} kind="allergy"/>
          {!summary.keyPoints?.length && !summary.medications?.length && !summary.allergies?.length && !summary.insufficientInformation && <p className="mt-4 text-sm text-slate-500">No supported summary statements were returned.</p>}
        </section>
        <section className="card mt-5 p-5"><h2 className="font-semibold">Source reports and references</h2>{!summary.sourceReferences?.length ? <p className="mt-2 text-sm text-slate-500">No source reports were available.</p> : <ul className="mt-3 divide-y divide-slate-100">{summary.sourceReferences.map((source) => <li key={source.id} className="flex flex-wrap items-center gap-3 py-3"><FileText size={17} className="text-teal"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{source.title || source.fileName || source.id}</p><p className="text-xs text-slate-500">{dateLabel(source.date)} · {source.status || source.verification?.replaceAll('-', ' ')}</p></div>{source.id && <Link className="text-xs font-semibold text-teal" to={`/doctor/ai-analysis?patient=${encodeURIComponent(patientId)}&document=${encodeURIComponent(source.id)}`}>View analysis <ArrowUpRight size={13}/></Link>}</li>)}</ul>}</section>
      </>}
    </>}
  </AppShell>
}

function SummaryList({ title, items = [], renderItem, kind }) {
  return <section className="mt-5"><h3 className="mb-2 font-semibold">{title}</h3>{items.length ? <ul className="space-y-2">{items.map((item, index) => renderItem(item, index, kind))}</ul> : <p className="text-sm text-slate-500">No documented information in this category.</p>}</section>
}
