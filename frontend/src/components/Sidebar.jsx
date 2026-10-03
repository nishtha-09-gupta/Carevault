import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Clock3,
  FolderOpen,
  UsersRound,
  Settings,
  LogOut,
  Stethoscope,
  X,
  ClipboardList,
  LockKeyhole,
} from 'lucide-react'
import Brand from './Brand'
import { useAuth } from './AuthContext'
import { useNavigate } from 'react-router-dom'

const patientItems = [
  { to: '/patient', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/records', label: 'Medical records', icon: FileText },
  { to: '/timeline', label: 'Health timeline', icon: Clock3 },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/intake', label: 'Health intake', icon: ClipboardList },
  { to: '/connections', label: 'Connections', icon: UsersRound },
  { to: '/sharing', label: 'Sharing & access', icon: LockKeyhole },
]

const doctorItems = [
  { to: '/doctor', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/doctor/records', label: 'Patient records', icon: FileText },
  { to: '/doctor/timeline', label: 'Clinical timeline', icon: Clock3 },
  { to: '/doctor/documents', label: 'Documents', icon: FolderOpen },
  { to: '/doctor/intake', label: 'Clinical intake', icon: ClipboardList },
  { to: '/doctor/connections', label: 'Connections', icon: UsersRound },
  { to: '/doctor/sharing', label: 'Sharing & access', icon: LockKeyhole },
]

export default function Sidebar({ role = 'patient', open = false, onClose }) {
  const items = role === 'doctor' ? doctorItems : patientItems
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    try { await signOut() } finally { navigate('/login', { replace: true }) }
  }

  return (
    <>
      {open && (
        <button
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200/80 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <Link to="/">
            <Brand />
          </Link>
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
          Workspace
        </div>

        <nav className="mt-3 space-y-1" aria-label="Main navigation">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-mint text-teal'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-lilac p-4">
          <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-white text-indigo-600">
            <Stethoscope size={18} />
          </div>
          <p className="text-sm font-semibold">Your care, in context</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Share the right parts of your health history with your care team.
          </p>
          <Link
            to={role === 'doctor' ? '/doctor/connections' : '/connections'}
            onClick={onClose}
            className="mt-3 inline-block text-xs font-bold text-teal hover:underline"
          >
            Manage connections →
          </Link>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <Link to={role === 'doctor' ? '/doctor/settings' : '/settings'} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
            <Settings size={17} /> Settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
