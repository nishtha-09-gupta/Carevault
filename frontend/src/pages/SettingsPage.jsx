import { useState } from 'react'
import { Bell, Check, CircleHelp, LockKeyhole, Save, UserRound } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading } from '../components/UI'
import { useAuth } from '../components/AuthContext'

export default function SettingsPage({ role = 'patient' }) {
  const [saved, setSaved] = useState(false)
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [recordUpdates, setRecordUpdates] = useState(true)
  const { user } = useAuth()
  const doctor = role === 'doctor'
  return (
    <AppShell role={role}>
      <PageHeading eyebrow="PREFERENCES" title="Settings" subtitle="Review your signed-in account and prototype notification preferences." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setSaved(true) }}>
          <section className="card p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><UserRound size={18}/></span><div><h2 className="font-semibold">Account details</h2><p className="text-xs text-slate-500">These details come from your signed-in account.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" defaultValue={user?.name || ''} readOnly />
              <Field label="Email address" type="email" defaultValue={user?.email || ''} readOnly />
              <div><label className="mb-1.5 block text-sm font-medium">Account type</label><input className="field capitalize" value={user?.role || role} readOnly /></div>
            </div>
          </section>
          <section className="card p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-lilac text-indigo-700"><Bell size={18}/></span><div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-slate-500">Prototype controls; notification preferences are not saved yet.</p></div></div>
            <Preference title="Email updates" detail="Receive a demo reminder when your records change." checked={emailUpdates} onChange={() => setEmailUpdates(!emailUpdates)} />
            <Preference title="Record activity" detail="Show a notification when a connected person shares a record." checked={recordUpdates} onChange={() => setRecordUpdates(!recordUpdates)} />
          </section>
          <div className="flex flex-wrap items-center gap-3"><button className="btn-primary"><Save size={16}/> Save preferences</button>{saved&&<span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal"><Check size={16}/> Saved in this demo</span>}</div>
        </form>
        <aside className="space-y-4">
          <section className="card p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><LockKeyhole size={18}/></span><h2 className="mt-3 font-semibold">Account security</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use sign out from the navigation menu to end your active sessions. Password changes and recovery are not available yet.</p></section>
          <section className="card p-5"><CircleHelp size={19} className="text-teal"/><h3 className="mt-3 font-semibold">Need a hand?</h3><p className="mt-1 text-sm text-slate-500">Review your records, timeline, or sharing controls from the workspace menu.</p></section>
        </aside>
      </div>
    </AppShell>
  )
}
function Field({ label, ...props }) { return <div><label className="mb-1.5 block text-sm font-medium">{label}</label><input className="field" {...props}/></div> }
function Preference({ title, detail, checked, onChange }) { return <label className="flex cursor-pointer items-start gap-3 border-t border-slate-100 py-4 first:border-0"><input type="checkbox" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-teal"/><span className="flex-1"><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span></span></label> }
