import { useCallback, useEffect, useState } from 'react'
import { Clock3, LoaderCircle, Search, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { EmptyState, PageHeading, StatusBadge } from '../components/UI'
import { fetchAccessGrants, findDoctors, grantDoctorAccess, revokeDoctorAccess } from '../services/accessApi'

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

  const activeGrants = grants.filter((grantItem) => grantItem.status === 'active' && new Date(grantItem.expiresAt) > new Date())

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
        {loading ? <div role="status" className="card flex items-center justify-center gap-3 p-10 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-teal"/> Loading access records…</div>
          : grants.length === 0 ? <EmptyState title={isDoctor ? 'No patients have shared documents' : 'No doctor access yet'} text={isDoctor ? 'When a patient grants your account access, the patient and expiry will appear here.' : 'Search for a registered doctor above to grant temporary access to your documents.'}/>
          : <div className="space-y-3">{grants.map((grantItem) => {
            const active = grantItem.status === 'active' && new Date(grantItem.expiresAt) > new Date()
            const other = isDoctor ? grantItem.patient : grantItem.doctor
            return <article key={grantItem.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lilac text-sm font-bold text-indigo-700">{other?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || '?'}</span>
              <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{other?.name || 'Account unavailable'}</h3><p className="truncate text-xs text-slate-500">{other?.email || 'User account'}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13}/> {active ? 'Expires ' + dateTime(grantItem.expiresAt) : grantItem.status === 'revoked' ? 'Revoked ' + (grantItem.revokedAt ? dateTime(grantItem.revokedAt) : '') : 'Expired ' + dateTime(grantItem.expiresAt)}</p></div>
              <StatusBadge tone={active ? 'green' : grantItem.status === 'revoked' ? 'gray' : 'amber'}>{active ? 'Active' : grantItem.status === 'revoked' ? 'Revoked' : 'Expired'}</StatusBadge>
              {!isDoctor && active && <button type="button" disabled={revokingId === grantItem.id} onClick={() => revoke(grantItem.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{revokingId === grantItem.id ? 'Revoking…' : 'Revoke access'}</button>}
            </article>
          })}</div>}
      </section>
      <p className="mt-6 text-xs leading-5 text-slate-400">Access applies to documents stored in CareVault. Every shared-document request is checked against the current grant, doctor, patient, document owner, and expiry.</p>
    </AppShell>
  )
}
