import { ArrowRight, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from './Brand'

const columns = [
  { title: 'Explore', links: [['Patient overview', '/patient'], ['Medical records', '/records'], ['Health timeline', '/timeline']] },
  { title: 'Care team', links: [['Clinician workspace', '/doctor'], ['Connections', '/connections'], ['Sharing controls', '/sharing']] },
  { title: 'Your account', links: [['Health intake', '/intake'], ['Documents', '/documents'], ['Settings', '/settings']] },
]

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <section className="mb-12 flex flex-col gap-5 rounded-3xl bg-gradient-to-r from-[#075f55] to-[#0c8071] p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-teal-100">A clearer health story</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Bring your health history into focus.</h2>
            <p className="mt-2 text-sm leading-6 text-white/75">Create your private account and keep your important documents close at hand.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-teal">Create an account <ArrowRight size={16}/></Link>
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"><Stethoscope size={16}/> Join as a clinician</Link>
          </div>
        </section>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Link to="/"><Brand/></Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">CareVault provides private accounts and secure document storage, with additional health workflows in prototype form.</p>
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-teal"/> Private accounts · per-user document storage</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{column.title}</h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map(([label, to]) => <li key={label}><Link to={to} className="text-sm text-slate-500 transition hover:text-teal">{label}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-400">Accounts and uploaded documents are stored by the connected backend. Sample timeline, intake, and sharing screens are not persisted or monitored. CareVault does not provide medical advice.</div>
      </div>
    </footer>
  )
}
