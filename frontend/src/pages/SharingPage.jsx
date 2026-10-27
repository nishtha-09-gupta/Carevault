import { useCallback, useEffect, useState } from 'react'
import { Clock3, LoaderCircle, Search, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { EmptyState, PageHeading, StatusBadge } from '../components/UI'
import { fetchAccessGrants, findDoctors, grantDoctorAccess, revokeDoctorAccess } from '../services/accessApi'
import { ACCESS_HISTORY_PAGE_SIZE, canRevokeAccess, countAccessHistory, effectiveGrantStatus, filterAccessHistory, paginateAccessHistory, visiblePageNumbers } from '../utils/sharingHistory'

function dateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SharingPage({ role = 'patient' }) {
  const isDoctor = role === 'doctor'
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revokingId, setRevokingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [searching, setSearching] = useState(false)
  const [duration, setDuration] = useState('24')
  const [customHours, setCustomHours] = useState('48')
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState('all')
  const [historyPage, setHistoryPage] = useState(1)
  const hoursToGrant = duration === 'custom' ? Number(customHours) : Number(duration)
  const validHours = Number.isInteger(hoursToGrant) && hoursToGrant >= 1 && hoursToGrant <= 720

  const loadGrants = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setGrants(await fetchAccessGrants())
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGrants() }, [loadGrants])

  async function search() {
    setError('')
    setNotice('')
    setSelectedDoctor('')
    setSearching(true)
    try {
      setDoctors(await findDoctors(query.trim()))
    } catch (searchError) {
      setError(searchError.message)
      setDoctors([])
    } finally {
      setSearching(false)
    }
  }

  async function grant() {
    if (!selectedDoctor) return
    if (!validHours) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const created = await grantDoctorAccess(selectedDoctor, hoursToGrant)
      setGrants((current) => [created, ...current.filter((item) => item.doctor?.id !== created.doctor?.id || item.status !== 'active')])
      setNotice(`Access granted to ${created.doctor?.name || 'the doctor'} until ${dateTime(created.expiresAt)}.`)
      setSelectedDoctor('')
      setDoctors([])
      setQuery('')
    } catch (grantError) {
      setError(grantError.message)
    } finally {
      setSaving(false)
    }
  }

  async function revoke(grantId) {
    const grantItem = grants.find((item) => item.id === grantId)
    if (isDoctor || !grantItem || !canRevokeAccess(grantItem)) return
    const person = isDoctor ? grantItem?.patient : grantItem?.doctor
    if (!window.confirm(`Revoke access for ${person?.name || 'this person'}? They will immediately lose access to your shared documents.`)) return
    setRevokingId(grantId)
    setError('')
    setNotice('')
    try {
      const updated = await revokeDoctorAccess(grantId)
      setGrants((current) => current.map((grantItem) => grantItem.id === updated.id ? updated : grantItem))
      setNotice('Doctor access revoked. Further document requests will be denied.')
    } catch (revokeError) {
      setError(revokeError.message)
      await loadGrants()
    } finally {
      setRevokingId('')
    }
  }

  const now = Date.now()
  const statusCounts = countAccessHistory(grants, now)
  const activeGrants = grants.filter((grantItem) => effectiveGrantStatus(grantItem, now) === 'active')
  const filteredGrants = filterAccessHistory(grants, { status: historyStatus, search: historySearch, isDoctor, now })
  const pageView = paginateAccessHistory(filteredGrants, historyPage, ACCESS_HISTORY_PAGE_SIZE)
  const pageNumbers = visiblePageNumbers(pageView.page, pageView.pageCount)

  useEffect(() => { setHistoryPage((current) => Math.min(current, Math.max(1, pageView.pageCount))) }, [pageView.pageCount])

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="PRIVACY CONTROLS"
        title="Sharing & access"
        subtitle={isDoctor ? 'Patients who have granted your account time-limited access to their documents.' : 'Choose a doctor account, set an access period, and revoke access whenever you need.'}
        action={<span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-teal"><ShieldCheck size={14}/>{activeGrants.length} active</span>}
      />

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {!isDoctor && <section className="card mb-7 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><UserRoundPlus size={18}/></span>
          <div><h2 className="font-semibold">Grant a doctor temporary access</h2><p className="mt-1 text-sm text-slate-500">Doctors can view your uploaded documents until the access period ends or you revoke it.</p></div>
        </div>
        <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); search() }}>
          <label className="block text-xs font-semibold text-slate-600">Find a doctor
            <span className="mt-1 flex gap-2"><input className="field" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedDoctor(''); setDoctors([]) }} placeholder="Name or registered email"/><button type="submit" className="btn-secondary shrink-0" disabled={searching || query.trim().length < 2}>{searching ? <LoaderCircle size={16} className="animate-spin"/> : <Search size={16}/>} Search</button></span>
          </label>
          <label className="block text-xs font-semibold text-slate-600">Access duration
            <select className="field mt-1" value={duration} onChange={(event) => setDuration(event.target.value)}>
              <option value="1">1 hour</option><option value="6">6 hours</option><option value="24">24 hours</option><option value="168">7 days</option><option value="custom">Custom</option>
            </select>
          </label>
          <button type="button" className="btn-primary" disabled={saving || !selectedDoctor || !validHours} onClick={grant}>{saving ? <LoaderCircle size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} Grant access</button>
        </form>
        {duration === 'custom' && <label className="mt-3 block max-w-xs text-xs font-semibold text-slate-600">Custom duration in hours
          <input type="number" min="1" max="720" step="1" className="field mt-1" value={customHours} onChange={(event) => setCustomHours(event.target.value)}/>
        </label>}
        {doctors.length > 0 && <div className="mt-4 space-y-2" aria-label="Doctor search results">
          {doctors.map((doctor) => <button type="button" key={doctor.id} onClick={() => setSelectedDoctor(doctor.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selectedDoctor === doctor.id ? 'border-teal bg-mint/40' : 'border-slate-200 hover:border-teal/50'}`}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-lilac text-xs font-bold text-indigo-700">{doctor.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{doctor.name}</span><span className="block truncate text-xs text-slate-500">{doctor.email}</span></span>
            {selectedDoctor === doctor.id && <StatusBadge>Selected</StatusBadge>}
          </button>)}
        </div>}
        {doctors.length === 0 && query.length >= 2 && !searching && <p className="mt-3 text-xs text-slate-500">Search for a registered doctor to select the account.</p>}
        {duration === 'custom' && !validHours && <p className="mt-2 text-xs text-rose-700">Choose a whole number of hours up to 720.</p>}
      </section>}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">{isDoctor ? 'Patients sharing with you' : 'Doctor access history'}</h2>{isDoctor && <Link to="/doctor/documents" className="text-xs font-semibold text-teal hover:underline">View shared documents</Link>}</div>
        <div className="card mb-4 space-y-3 p-3 sm:p-4">
          <label className="relative block max-w-md"><span className="sr-only">Search access history by person name or email</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="search" value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1) }} className="field !py-2 !pl-9 text-sm" placeholder="Search name or email"/></label>
          <div className="flex flex-wrap gap-2" aria-label="Filter access history by status">
            {[['all', 'All'], ['active', 'Active'], ['expired', 'Expired'], ['revoked', 'Revoked']].map(([status, label]) => <button key={status} type="button" aria-pressed={historyStatus === status} onClick={() => { setHistoryStatus(status); setHistoryPage(1) }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${historyStatus === status ? 'border-teal bg-mint text-teal' : 'border-slate-200 bg-white text-slate-600 hover:border-teal/50'}`}>{label} <span className="ml-1 tabular-nums opacity-75">{statusCounts[status]}</span></button>)}
          </div>
        </div>
        {loading ? <div role="status" className="card flex items-center justify-center gap-3 p-10 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-teal"/> Loading access records…</div>
          : grants.length === 0 ? <EmptyState title={isDoctor ? 'No patients have shared documents' : 'No doctor access yet'} text={isDoctor ? 'When a patient grants your account access, the patient and expiry will appear here.' : 'Search for a registered doctor above to grant temporary access to your documents.'}/>
          : filteredGrants.length === 0 ? <EmptyState title="No matching access records" text="Try another name or email, or choose a different status filter."/>
          : <>
          <p className="mb-2 text-xs text-slate-500" aria-live="polite">Showing {pageView.start}–{pageView.end} of {filteredGrants.length}</p>
          <div className="space-y-2">{pageView.items.map((grantItem) => {
            const status = effectiveGrantStatus(grantItem, now)
            const active = status === 'active'
            const other = isDoctor ? grantItem.patient : grantItem.doctor
            return <article key={grantItem.id} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lilac text-xs font-bold text-indigo-700">{other?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || '?'}</span>
              <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{other?.name || 'Account unavailable'}</h3><p className="truncate text-xs text-slate-500">{other?.email || 'User account'}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13}/> {active ? 'Expires ' + dateTime(grantItem.expiresAt) : status === 'revoked' ? 'Revoked ' + dateTime(grantItem.revokedAt || grantItem.expiresAt) : 'Expired ' + dateTime(grantItem.expiresAt)}</p></div>
              <StatusBadge tone={active ? 'green' : status === 'revoked' ? 'gray' : 'amber'}>{status === 'active' ? 'Active' : status === 'revoked' ? 'Revoked' : 'Expired'}</StatusBadge>
              {!isDoctor && canRevokeAccess(grantItem, now) && <button type="button" disabled={revokingId === grantItem.id} onClick={() => revoke(grantItem.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{revokingId === grantItem.id ? 'Revoking…' : 'Revoke access'}</button>}
            </article>
          })}</div>
          {pageView.pageCount > 1 && <nav className="mt-4 flex flex-wrap items-center justify-center gap-1.5" aria-label="Access history pages">
            <button type="button" disabled={pageView.page === 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} className="btn-secondary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            {pageView.pageCount > 5 && pageNumbers[0] > 1 && <><PageButton value={1} current={pageView.page} onSelect={setHistoryPage}/>{pageNumbers[0] > 2 && <span className="px-1 text-xs text-slate-400">…</span>}</>}
            {pageNumbers.map((number) => <PageButton key={number} value={number} current={pageView.page} onSelect={setHistoryPage}/>) }
            {pageView.pageCount > 5 && pageNumbers.at(-1) < pageView.pageCount && <>{pageNumbers.at(-1) < pageView.pageCount - 1 && <span className="px-1 text-xs text-slate-400">…</span>}<PageButton value={pageView.pageCount} current={pageView.page} onSelect={setHistoryPage}/></>}
            <button type="button" disabled={pageView.page === pageView.pageCount} onClick={() => setHistoryPage((current) => Math.min(pageView.pageCount, current + 1))} className="btn-secondary !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </nav>}
          </>}
      </section>
      <p className="mt-6 text-xs leading-5 text-slate-400">Access applies to documents stored in CareVault. Every shared-document request is checked against the current grant, doctor, patient, document owner, and expiry.</p>
    </AppShell>
  )
}

function PageButton({ value, current, onSelect }) {
  return <button type="button" aria-label={`Page ${value}`} aria-current={current === value ? 'page' : undefined} onClick={() => onSelect(value)} className={`grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-xs font-semibold ${current === value ? 'border-teal bg-mint text-teal' : 'border-slate-200 bg-white text-slate-600 hover:border-teal/50'}`}>{value}</button>
}
