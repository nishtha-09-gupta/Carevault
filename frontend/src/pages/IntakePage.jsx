import { useState } from 'react'
import { Check, ClipboardList, Info, Save } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading } from '../components/UI'

export default function IntakePage({ role = 'patient' }) {
  const [saved, setSaved] = useState(false)

  return (
    <AppShell role={role}>
      <PageHeading
        eyebrow="PATIENT PROVIDED INFORMATION"
        title="Health intake"
        subtitle="Capture the details you want your care team to know before a visit."
        action={
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <Info size={14} /> Demo form · not a diagnosis
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            setSaved(true)
          }}
        >
          <section className="card p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal">
                <ClipboardList size={19} />
              </span>
              <div>
                <h2 className="font-semibold">What brings you in?</h2>
                <p className="text-xs text-slate-500">Describe your concern in your own words.</p>
              </div>
            </div>

            <label className="mb-1.5 block text-sm font-medium">Main concern</label>
            <textarea
              className="field min-h-28 resize-y"
              required
              placeholder="For example: headaches that started last week..."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">When did it begin?</label>
                <input className="field" type="date" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  How much does it affect you?
                </label>
                <select className="field" defaultValue="">
                  <option value="" disabled>
                    Select impact
                  </option>
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>Significant</option>
                </select>
              </div>
            </div>
          </section>

          <section className="card p-5 sm:p-7">
            <h2 className="font-semibold">Relevant health details</h2>
            <p className="mt-1 text-xs text-slate-500">
              Add anything that may help your clinician understand your history.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Known allergies</label>
                <input className="field" placeholder="e.g. Penicillin, seasonal pollen" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Current medications</label>
                <input className="field" placeholder="Medication and dosage" />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium">
                Anything else your care team should know?
              </label>
              <textarea
                className="field min-h-24 resize-y"
                placeholder="Optional context, questions, or relevant history"
              />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary">
              <Save size={16} /> Save intake
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSaved(false)}
            >
              Save as draft
            </button>
            {saved && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal"
              >
                <Check size={16} /> Saved in this page only
              </span>
            )}
          </div>
        </form>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold">Before you share</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This form collects information you choose to enter. Review your sharing settings
              before sending it to a connected clinician.
            </p>
            <a href="/sharing" className="mt-4 inline-block text-sm font-semibold text-teal hover:underline">
              Review sharing settings →
            </a>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Not for urgent concerns</p>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              This portfolio demo is not monitored by a care team and does not provide medical
              advice. For urgent help, contact local emergency services.
            </p>
          </section>

          <section className="card p-5">
            <h3 className="text-sm font-semibold">Intake checklist</h3>
            <ul className="mt-3 space-y-3 text-xs text-slate-500">
              <li className="flex gap-2">
                <Check size={14} className="text-teal" /> Describe your main concern
              </li>
              <li className="flex gap-2">
                <Check size={14} className="text-teal" /> Include relevant allergies
              </li>
              <li className="flex gap-2">
                <Check size={14} className="text-teal" /> Add current medications
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
