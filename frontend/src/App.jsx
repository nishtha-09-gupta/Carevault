import { Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import { LandingPage, AuthPage, ForgotPasswordPage } from './pages/PublicPages'
import { DoctorDashboard, PatientDashboard } from './pages/DashboardPages'
import { ConnectionsPage, DocumentsPage, RecordsPage, TimelinePage } from './pages/HealthPages'
import IntakePage from './pages/IntakePage'
import SharingPage from './pages/SharingPage'
import SettingsPage from './pages/SettingsPage'

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 text-center">
      <div>
        <p className="eyebrow">404 · PAGE NOT FOUND</p>
        <h1 className="mt-2 text-3xl font-bold">This page isn’t in your records.</h1>
        <p className="mt-2 text-slate-500">
          Try the overview or return to the CareVault home page.
        </p>
        <a className="btn-primary mt-5" href="/">
          Go home
        </a>
      </div>
    </main>
  )
}

function RequireAuth({ children, role }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading your account…</main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />
  return children
}

function Workspace({ children, role }) { return <RequireAuth role={role}>{children}</RequireAuth> }

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/patient" element={<Workspace><PatientDashboard /></Workspace>} />
      <Route path="/doctor" element={<Workspace role="doctor"><DoctorDashboard /></Workspace>} />
      <Route path="/records" element={<Workspace><RecordsPage /></Workspace>} />
      <Route path="/doctor/records" element={<Workspace role="doctor"><RecordsPage role="doctor" /></Workspace>} />
      <Route path="/timeline" element={<Workspace><TimelinePage /></Workspace>} />
      <Route path="/doctor/timeline" element={<Workspace role="doctor"><TimelinePage role="doctor" /></Workspace>} />
      <Route path="/documents" element={<Workspace><DocumentsPage /></Workspace>} />
      <Route path="/doctor/documents" element={<Workspace role="doctor"><DocumentsPage role="doctor" /></Workspace>} />
      <Route path="/connections" element={<Workspace><ConnectionsPage /></Workspace>} />
      <Route path="/doctor/connections" element={<Workspace role="doctor"><ConnectionsPage role="doctor" /></Workspace>} />
      <Route path="/intake" element={<Workspace><IntakePage /></Workspace>} />
      <Route path="/sharing" element={<Workspace><SharingPage /></Workspace>} />
      <Route path="/doctor/intake" element={<Workspace role="doctor"><IntakePage role="doctor" /></Workspace>} />
      <Route path="/doctor/sharing" element={<Workspace role="doctor"><SharingPage role="doctor" /></Workspace>} />
      <Route path="/settings" element={<Workspace><SettingsPage /></Workspace>} />
      <Route path="/doctor/settings" element={<Workspace role="doctor"><SettingsPage role="doctor" /></Workspace>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() { return <AuthProvider><AppRoutes /></AuthProvider> }
