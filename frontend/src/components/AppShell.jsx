import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell({ children, role = 'patient' }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar role={role} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="min-h-screen lg:pl-[260px]">
        <Topbar role={role} onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 lg:px-9">{children}</main>
      </div>
    </div>
  )
}
