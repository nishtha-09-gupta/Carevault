import { ArrowUpRight, FileText, FlaskConical, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ title, link, to = '/records' }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-semibold text-ink">{title}</h2>
      {link && (
        <Link
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
          to={to}
        >
          {link}
          <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, hint, tint = 'bg-mint text-teal' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
          <Icon size={19} />
        </span>
        <button aria-label={`More about ${label}`} className="text-slate-300">
          <MoreHorizontal size={19} />
        </button>
      </div>
      <p className="mt-5 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

export function RecordIcon({ lab }) {
  const Icon = lab ? FlaskConical : FileText
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
        lab ? 'bg-lilac text-indigo-600' : 'bg-mint text-teal'
      }`}
    >
      <Icon size={18} />
    </span>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  text = 'When you add information, it will appear here.',
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400">
        <FileText size={21} />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  )
}

export function StatusBadge({ children, tone = 'green' }) {
  const colors =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'gray'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-emerald-50 text-emerald-700'

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors}`}>
      {children}
    </span>
  )
}
