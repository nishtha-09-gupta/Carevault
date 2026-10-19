import { useEffect, useState } from 'react'
import { Check, ClipboardList, Info, LoaderCircle, Save } from 'lucide-react'
import AppShell from '../components/AppShell'
import { PageHeading } from '../components/UI'
import { fetchHealthIntake, saveHealthIntake } from '../services/healthIntakeApi'

const emptyFields = {
  mainConcern: '',
  startedAt: '',
  impact: '',
  allergies: '',
  medications: '',
  additionalNotes: '',
}

export default function IntakePage({ role = 'patient' }) {
  const [fields, setFields] = useState(emptyFields)
  const [intake, setIntake] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetchHealthIntake()
      .then((savedIntake) => {
        if (!active) return
        setIntake(savedIntake)
        if (savedIntake) {
          setFields({
            mainConcern: savedIntake.mainConcern || '',
            startedAt: savedIntake.startedAt || '',
            impact: savedIntake.impact || '',
            allergies: savedIntake.allergies || '',
            medications: savedIntake.medications || '',
            additionalNotes: savedIntake.additionalNotes || '',
          })
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function updateField(event) {
    const { name, value } = event.target
    setFields((current) => ({ ...current, [name]: value }))
    setNotice('')
  }

  async function persist(status) {
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const savedIntake = await saveHealthIntake({ ...fields, status }, intake?.id)
      setIntake(savedIntake)
      setNotice(status === 'draft' ? 'Draft saved.' : intake ? 'Intake updated.' : 'Intake saved.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    persist('submitted')
  }

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

      {loading && <p role="status" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin"/>Loading saved intake…</p>}
      {!loading && !intake && !error && <p role="status" className="mb-4 text-sm text-slate-500">You haven’t saved a health intake yet.</p>}
      {intake && <p className="mb-4 text-xs text-slate-500">{intake.status === 'draft' ? 'Draft saved' : 'Last saved'} {new Date(intake.updatedAt).toLocaleString()}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <form className="space-y-5" onSubmit={submit}>
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

            <label htmlFor="mainConcern" className="mb-1.5 block text-sm font-medium">Main concern</label>
            <textarea
              id="mainConcern"
              name="mainConcern"
              className="field min-h-28 resize-y"
              required
              maxLength={2000}
              value={fields.mainConcern}
              onChange={updateField}
              placeholder="For example: headaches that started last week..."
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="startedAt" className="mb-1.5 block text-sm font-medium">When did it begin?</label>
                <input id="startedAt" name="startedAt" className="field" type="date" value={fields.startedAt} onChange={updateField} />
              </div>
              <div>
                <label htmlFor="impact" className="mb-1.5 block text-sm font-medium">How much does it affect you?</label>
                <select id="impact" name="impact" className="field" value={fields.impact} onChange={updateField}>
                  <option value="">Select impact</option>
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>Significant</option>
                </select>
              </div>
            </div>
          </section>

          <section className="card p-5 sm:p-7">
            <h2 className="font-semibold">Relevant health details</h2>
            <p className="mt-1 text-xs text-slate-500">Add anything that may help your clinician understand your history.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="allergies" className="mb-1.5 block text-sm font-medium">Known allergies</label>
                <input id="allergies" name="allergies" className="field" maxLength={2000} value={fields.allergies} onChange={updateField} placeholder="e.g. Penicillin, seasonal pollen" />
              </div>
              <div>
                <label htmlFor="medications" className="mb-1.5 block text-sm font-medium">Current medications</label>
                <input id="medications" name="medications" className="field" maxLength={2000} value={fields.medications} onChange={updateField} placeholder="Medication and dosage" />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="additionalNotes" className="mb-1.5 block text-sm font-medium">Anything else your care team should know?</label>
              <textarea id="additionalNotes" name="additionalNotes" className="field min-h-24 resize-y" maxLength={5000} value={fields.additionalNotes} onChange={updateField} placeholder="Optional context, questions, or relevant history" />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={loading || saving}>
              {saving ? <LoaderCircle size={16} className="animate-spin"/> : <Save size={16} />} {intake?.status === 'submitted' ? 'Update intake' : 'Save intake'}
            </button>
            <button type="button" className="btn-secondary" disabled={loading || saving} onClick={() => persist('draft')}>
              Save as draft
            </button>
            {notice && <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal"><Check size={16} />{notice}</span>}
          </div>
        </form>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold">Before you share</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">This form collects information you choose to enter. Review your sharing settings before sending it to a connected clinician.</p>
            <a href="/sharing" className="mt-4 inline-block text-sm font-semibold text-teal hover:underline">Review sharing settings →</a>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Not for urgent concerns</p>
            <p className="mt-2 text-xs leading-5 text-amber-800">This portfolio demo is not monitored by a care team and does not provide medical advice. For urgent help, contact local emergency services.</p>
          </section>

          <section className="card p-5">
            <h3 className="text-sm font-semibold">Intake checklist</h3>
            <ul className="mt-3 space-y-3 text-xs text-slate-500">
              <li className="flex gap-2"><Check size={14} className="text-teal" /> Describe your main concern</li>
              <li className="flex gap-2"><Check size={14} className="text-teal" /> Include relevant allergies</li>
              <li className="flex gap-2"><Check size={14} className="text-teal" /> Add current medications</li>
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
