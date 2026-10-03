import { Bell, Menu, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function Topbar({ role = 'patient', onMenu }) {
  const [query, setQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const recordPath = role === 'doctor' ? '/doctor/records' : '/records'
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-7">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onMenu}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <form
          className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-400 sm:flex"
          onSubmit={(event) => {
            event.preventDefault()
            navigate(recordPath + '?q=' + encodeURIComponent(query))
          }}
        >
          <Search size={16} />
          <input
            aria-label="Search health history"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your health history"
            className="w-52 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          />
          <button aria-label="Submit search" className="rounded border bg-white px-1.5 py-0.5 text-[10px]">↵</button>
        </form>
        <span className="text-xs font-medium text-slate-400 sm:hidden">Workspace</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-teal sm:inline">
          {user?.name || (role === 'doctor' ? 'Clinician account' : 'Patient account')}
        </span>
        <div className="relative">
          <button aria-label={showNotifications ? 'Close notifications' : 'Open notifications'} aria-expanded={showNotifications} type="button" onClick={() => setShowNotifications(!showNotifications)} className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
            {showNotifications ? <X size={18}/> : <Bell size={18}/>}
            {!showNotifications && <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal"/>}
          </button>
          {showNotifications && <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><p className="text-sm font-semibold">You’re all caught up</p><p className="mt-1 text-xs leading-5 text-slate-500">Demo connection updates will appear here.</p><button onClick={() => { setShowNotifications(false); navigate(role === 'doctor' ? '/doctor/connections' : '/connections') }} className="mt-3 text-xs font-semibold text-teal hover:underline">View connections →</button></div>}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-teal text-xs font-bold text-white">
          {(user?.name || 'CV').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
        </div>
      </div>
    </header>
  )
}
