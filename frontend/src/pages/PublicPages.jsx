import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, ClipboardList, Clock3, FileHeart, FolderOpen, LockKeyhole, ShieldCheck, Stethoscope, UsersRound } from 'lucide-react'
import Brand from '../components/Brand'
import Footer from '../components/Footer'
import { useAuth } from '../components/AuthContext'
import { requestPasswordReset, resetPassword, verifyPasswordResetOtp } from '../services/authApi'

function PublicNav() {
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/">
        <Brand />
      </Link>
      <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
        <a href="/#how-it-works">How it works</a>
        <a href="/#for-you">For you</a>
        <a href="/#privacy">Privacy</a>
      </nav>
      <div className="flex items-center gap-3">
        <Link to="/login" className="hidden px-3 py-2 text-sm font-semibold sm:inline">
          Log in
        </Link>
        <Link to="/signup" className="btn-primary !py-2.5 text-sm">
          Get started <ArrowRight size={15} />
        </Link>
      </div>
    </header>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-canvas">
      <PublicNav />
      <main>
        {/* Hero Section */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 md:grid-cols-[1.03fr_.97fr] md:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/10 bg-white px-3 py-1.5 text-xs font-semibold text-teal">
              <ShieldCheck size={14} /> Health information, on your terms
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-.04em] text-ink sm:text-5xl lg:text-[62px]">
              Your health history.
              <br />
              <span className="text-teal">Organized. Intelligent. Yours.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600">
              Keep your medical records in one calm, clear space. Share the details your care team
              needs, when you choose.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary">
                Create an account <ArrowRight size={17} />
              </Link>
              <Link to="/login" className="btn-secondary">
                Explore the demo
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <Check size={14} className="text-teal" /> Your records, together
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={14} className="text-teal" /> You control sharing
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[36px] bg-gradient-to-br from-mint via-lilac to-white blur-2xl" />
            <div className="card relative p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-400">PATIENT OVERVIEW</p>
                  <p className="mt-1 font-semibold">Good morning, Nisha</p>
                </div>
                <span className="rounded-full bg-mint px-3 py-1 text-[11px] font-semibold text-teal">
                  Up to date
                </span>
              </div>
              <div className="mt-5 rounded-2xl bg-gradient-to-r from-teal to-emerald-600 p-5 text-white">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold">
                  YOUR HEALTH SNAPSHOT
                </span>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xs text-white/70">Active conditions</p>
                    <p className="mt-1 font-semibold">Migraine</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3">
                    <p className="text-xs text-white/70">Care connections</p>
                    <p className="mt-1 font-semibold">1 clinician</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm font-semibold">Recent records</p>
                <Link to="/records" className="text-xs font-semibold text-teal">
                  View all →
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                {[
                  ['Complete Blood Count', 'Sep 18 · Lab result'],
                  ['Annual wellness visit', 'Aug 29 · Visit summary'],
                ].map(([name, detail]) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-lilac text-indigo-600">
                      <FileHeart size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="text-xs text-slate-400">{detail}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-y border-slate-100 bg-white py-14">
          <div className="mx-auto mb-10 max-w-7xl px-5 sm:px-8">
            <p className="eyebrow">A clear path through your care</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">From your records to a more prepared visit.</h2>
          </div>
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 md:grid-cols-3">
            <Feature
              icon={FileHeart}
              title="Add your health information"
              text="Collect results, visit summaries, medications, and key details in one organized profile."
            />
            <Feature
              icon={UsersRound}
              title="Choose what to share"
              text="Connect with a clinician and review which parts of your history are available to them."
            />
            <Feature
              icon={LockKeyhole}
              title="Use it to prepare"
              text="Bring relevant history and questions into the conversation, then keep a record of what comes next."
            />
          </div>
        </section>

        <section id="for-you" className="bg-[#f0efff]/55">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="max-w-2xl">
              <p className="eyebrow">Designed around your role</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">A useful workspace for everyone involved.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">Patients and clinicians see tools shaped for their part in the care conversation.</p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <RoleCard icon={FileHeart} label="FOR PATIENTS" title="Keep your health story together" text="Find records, track events over time, prepare visit details, and decide what to share." links={[['Medical records','/records',FolderOpen],['Health timeline','/timeline',Clock3],['Prepare for a visit','/intake',ClipboardList]]} to="/patient" action="Explore patient view" />
              <RoleCard icon={Stethoscope} label="FOR CLINICIANS" title="Review shared context" text="See connected patient information, review incoming requests, and follow a clear clinical timeline." links={[['Connected patients','/doctor/connections',UsersRound],['Shared records','/doctor/records',FolderOpen],['Patient intake','/doctor/intake',ClipboardList]]} to="/doctor" action="Explore clinician view" />
            </div>
            <p className="mt-5 text-xs text-slate-400">This portfolio demo uses fictional records and does not coordinate or schedule care.</p>
          </div>
        </section>

        <section id="privacy" className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Your choices stay visible</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Sharing should be clear at a glance.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">CareVault’s prototype makes sharing choices easy to find: connect with an invite code, review access by category, and return to those choices when your needs change.</p>
            <Link to="/sharing" className="btn-primary mt-6">Explore sharing controls <ArrowRight size={16}/></Link>
            <p className="mt-3 text-xs text-slate-400">These controls are a UI demo. No real records are shared.</p>
          </div>
          <div className="card p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><LockKeyhole size={18}/></span><div><p className="text-xs text-slate-400">SHARING PREVIEW</p><p className="mt-1 text-sm font-semibold">Dr. Anika Sharma</p></div></div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Connected</span>
            </div>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Choose what to share</p>
            <SharingPreviewRow label="Visit summaries" checked/>
            <SharingPreviewRow label="Lab results" checked/>
            <SharingPreviewRow label="Medications" checked/>
            <SharingPreviewRow label="Patient-entered intake" checked={false}/>
            <Link to="/connections" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">Manage care connections <ArrowUpRight size={14}/></Link>
          </div>
        </section>

        {/* Shared Footer & CTA UI */}
        <Footer />
      </main>
    </div>
  )
}

function RoleCard({ icon: Icon, label, title, text, links, to, action }) {
  return (
    <article className="card overflow-hidden p-6 sm:p-7">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><Icon size={19}/></span><span className="eyebrow">{label}</span></div>
      <h3 className="mt-5 text-xl font-bold">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{text}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">{links.map(([label, href, LinkIcon]) => <Link key={label} to={href} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-mint hover:text-teal"><LinkIcon size={15}/>{label}</Link>)}</div>
      <Link to={to} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">{action}<ArrowUpRight size={15}/></Link>
    </article>
  )
}

function SharingPreviewRow({ label, checked }) {
  return (
    <label className="flex items-center gap-3 border-t border-slate-100 py-3 first:border-0">
      <input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-teal"/>
      <span className="flex-1 text-sm text-slate-700">{label}</span>
      <span className={checked ? 'text-xs font-medium text-teal' : 'text-xs font-medium text-slate-400'}>{checked ? 'Shared' : 'Private'}</span>
    </label>
  )
}

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-teal">
        <Icon size={20} />
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">{text}</p>
      </div>
    </div>
  )
}

export function AuthPage({ mode = 'login' }) {
  const signup = mode === 'signup'
  const [role, setRole] = useState('patient')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const data = new FormData(e.currentTarget)
    const password = data.get('password')
    if (signup && (typeof password !== 'string' || password.length < 6 || password.length > 128)) {
      setError('Password must be at least 6 characters long')
      setSubmitting(false)
      return
    }
    try {
      const user = signup
        ? await auth.signUp({ name: data.get('name'), email: data.get('email'), password, role })
        : await auth.signIn({ email: data.get('email'), password })
      const requestedPath = location.state?.from
      const compatiblePath = typeof requestedPath === 'string' && (
        user.role === 'doctor'
          ? requestedPath === '/doctor' || requestedPath.startsWith('/doctor/')
          : !requestedPath.startsWith('/doctor')
      )
      navigate(compatiblePath ? requestedPath : (user.role === 'doctor' ? '/doctor' : '/patient'), { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemoCredentials = (account) => {
    setEmail(account === 'doctor' ? 'doctor.demo@gmail.com' : 'demo@gmail.com')
    setPassword(account === 'doctor' ? 'doctor123' : 'demo123')
  }

  return (
    <div className="min-h-screen bg-canvas">
      <PublicNav />
      <main className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-8 sm:px-8 md:grid-cols-2 md:py-16">
        <div className="hidden md:block">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-teal">
            <ShieldCheck size={23} />
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight">
            {signup
              ? 'A more complete picture starts here.'
              : 'Welcome back to your health story.'}
          </h1>
          <p className="mt-4 max-w-md leading-7 text-slate-500">
            {signup
              ? 'Create a secure account to keep your personal health workspace private and ready to use.'
              : 'Sign in to continue to your CareVault workspace.'}
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <Check size={16} className="text-teal" /> Keep your records organized
            </p>
            <p className="flex items-center gap-2">
              <Check size={16} className="text-teal" /> Decide what you share
            </p>
          </div>
        </div>

        <section className="card mx-auto w-full max-w-md p-6 sm:p-8">
          <h2 className="text-2xl font-bold">{signup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {signup
              ? 'Start organizing your health history.'
              : 'Log in to continue to CareVault.'}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {signup && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">I am joining as</label>
                <div className="grid grid-cols-2 gap-2">
                  {['patient', 'doctor'].map((item) => (
                    <button
                      type="button"
                      onClick={() => setRole(item)}
                      key={item}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition ${
                        role === item
                          ? 'border-teal bg-mint text-teal'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {signup && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Full name</label>
                <input name="name" minLength="2" maxLength="120" required className="field" placeholder="Your name" />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Email address</label>
              <input name="email" type="email" maxLength="254" autoComplete="email" required className="field" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <input
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                className="field"
                placeholder={signup ? 'At least 6 characters' : 'Your password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {!signup && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs font-semibold text-teal hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Please wait…' : signup ? 'Create account' : 'Log in'} <ArrowRight size={16} />
            </button>

            <p className="text-center text-xs leading-5 text-slate-400">
              {signup ? 'Password must be at least 6 characters long' : 'Your account is protected by a private session.'}
            </p>
          </form>

          {!signup && <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-3 text-center text-sm font-semibold">Want to explore CareVault?</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => fillDemoCredentials('patient')} className="btn-secondary justify-center !px-2 text-xs">Use demo patient</button>
              <button type="button" onClick={() => fillDemoCredentials('doctor')} className="btn-secondary justify-center !px-2 text-xs">Use demo doctor</button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">Credentials fill the form; log in to continue.</p>
          </div>}

          <p className="mt-5 text-center text-sm text-slate-500">
            {signup ? 'Already have an account?' : 'New to CareVault?'}{' '}
            <Link to={signup ? '/login' : '/signup'} className="font-semibold text-teal hover:underline">
              {signup ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </section>
      </main>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [stage, setStage] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (stage !== 'complete') return undefined
    const timer = window.setTimeout(() => navigate('/login', { replace: true }), 2500)
    return () => window.clearTimeout(timer)
  }, [stage, navigate])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      if (stage === 'email') {
        await requestPasswordReset(email)
        setNotice('If an account exists for that email, a verification code will be sent. If it does not arrive, try again in a minute.')
        setCooldown(60)
        setStage('otp')
      } else if (stage === 'otp') {
        const result = await verifyPasswordResetOtp({ email, otp })
        setResetToken(result.resetToken)
        setStage('password')
      } else if (stage === 'password') {
        if (password.length < 6 || password.length > 128) {
          setError('Password must be at least 6 characters long')
          return
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          return
        }
        await resetPassword({ email, resetToken, password })
        setStage('complete')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setNotice('If an account exists for that email, a verification code will be sent. If it does not arrive, try again in a minute.')
      setOtp('')
      setCooldown(60)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const heading = stage === 'email' ? 'Forgot your password?' : stage === 'otp' ? 'Check your email' : stage === 'password' ? 'Choose a new password' : 'Password reset complete'

  return (
    <div className="min-h-screen bg-canvas">
      <PublicNav />
      <main className="mx-auto max-w-md px-5 py-8 sm:px-8 md:py-16">
        <section className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{heading}</h1>
          {stage === 'email' && <p className="mt-2 text-sm leading-6 text-slate-500">Enter your account email and we’ll send a verification code if it matches an account.</p>}
          {stage === 'otp' && <p className="mt-2 text-sm leading-6 text-slate-500">Enter the 6-digit code sent to {email}. The code expires in 10 minutes.</p>}
          {stage === 'password' && <p className="mt-2 text-sm leading-6 text-slate-500">Your code is verified. Choose a new password for your account.</p>}
          {stage === 'complete' && <p className="mt-2 text-sm leading-6 text-slate-500">Your password has been changed. Redirecting you to log in…</p>}

          {stage !== 'complete' && <form className="mt-6 space-y-4" onSubmit={submit}>
            {stage === 'email' && <div>
              <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium">Email address</label>
              <input id="reset-email" name="email" type="email" autoComplete="email" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="you@example.com" />
            </div>}
            {stage === 'otp' && <div>
              <label htmlFor="reset-otp" className="mb-1.5 block text-sm font-medium">Verification code</label>
              <input id="reset-otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="field tracking-[0.3em]" placeholder="000000" />
              <button type="button" disabled={submitting || cooldown > 0} onClick={resend} className="mt-3 text-sm font-semibold text-teal disabled:cursor-not-allowed disabled:text-slate-400">
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </div>}
            {stage === 'password' && <>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">New password</label>
                <input id="new-password" name="new-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">Confirm new password</label>
                <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="field" />
              </div>
              <p className="text-xs text-slate-400">Password must be at least 6 characters long</p>
            </>}
            {notice && <p role="status" className="rounded-xl bg-mint px-3 py-2 text-sm text-teal">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">
              {submitting ? 'Please wait…' : stage === 'email' ? 'Send verification code' : stage === 'otp' ? 'Verify code' : 'Reset password'}
            </button>
          </form>}
          {stage === 'complete' && <Link to="/login" className="btn-primary mt-6 w-full">Continue to log in <ArrowRight size={16} /></Link>}
          <p className="mt-5 text-center text-sm text-slate-500">Remember your password? <Link to="/login" className="font-semibold text-teal hover:underline">Log in</Link></p>
        </section>
      </main>
    </div>
  )
}
