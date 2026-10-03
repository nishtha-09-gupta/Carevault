import { useState } from 'react'
import { Check, Eye, FileText, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading, StatusBadge } from '../components/UI'

const people = [
  {
    name: 'Dr. Anika Sharma',
    role: 'Primary care · Connected Sep 02',
    initials: 'AS',
  },
  {
    name: 'Dr. Neil Patel',
    role: 'Cardiology · Request pending',
    initials: 'NP',
  },
]

const categories = [
  'Visit summaries',
  'Lab results',
  'Medications',
  'Patient-entered intake',
]

export default function SharingPage({ role = 'patient' }) {
  const [sharing, setSharing] = useState([true, true, true, false])
  const [revoked, setRevoked] = useState(false)

  function toggle(index) {
    setSharing((current) => current.map((value, i) => (i === index ? !value : value)))
  }

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="PRIVACY CONTROLS"
        title="Sharing & access"
        subtitle="Review what information you share with each care connection."
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-teal">
            <ShieldCheck size={14} /> Demo privacy controls
          </span>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Summary icon={UsersRound} value="1 active" label="Care connection" />
        <Summary
          icon={FileText}
          value={sharing.filter(Boolean).length + ' of 4'}
          label="Categories enabled"
        />
        <Summary icon={LockKeyhole} value="You decide" label="Sharing preference" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <h2 className="font-semibold">Connected care team</h2>
          {people.map((person, index) => (
            <article key={person.name} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-lilac text-sm font-bold text-indigo-700">
                  {person.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{person.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{person.role}</p>
                </div>
                {index === 0 && !revoked ? (
                  <StatusBadge>Active</StatusBadge>
                ) : (
                  <StatusBadge tone="amber">Pending</StatusBadge>
                )}
              </div>

              {index === 0 && !revoked && (
                <>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Information this clinician can view
                    </p>
                    <div className="space-y-1">
                      {categories.map((category, i) => (
                        <label
                          key={category}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={sharing[i]}
                            onChange={() => toggle(i)}
                            className="h-4 w-4 accent-teal"
                          />
                          <span className="flex-1 text-sm">{category}</span>
                          <span className={sharing[i] ? 'text-teal' : 'text-slate-300'}>
                            {sharing[i] ? <Eye size={16} /> : <LockKeyhole size={15} />}
                          </span>
                          <span className="w-16 text-right text-xs text-slate-400">
                            {sharing[i] ? 'Shared' : 'Private'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400">Changes are local to this UI demo.</p>
                    <button
                      onClick={() => setRevoked(true)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Revoke demo access
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal">
              <LockKeyhole size={18} />
            </div>
            <h2 className="mt-3 font-semibold">You’re in control</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Choose which categories are visible to a connected clinician. Keep an item private
              by switching it off.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold">How demo sharing works</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              These toggles demonstrate the interface only. No records are transmitted and no real
              permissions are changed.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-teal">
              <Check size={14} /> Prototype controls only
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}

function Summary({ icon: Icon, value, label }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-teal">
        <Icon size={18} />
      </span>
      <div>
        <p className="font-semibold">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}
