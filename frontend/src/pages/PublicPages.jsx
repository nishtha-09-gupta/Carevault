import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, ArrowUpRight, Check, CheckCircle2, ClipboardList, Clock3, FileHeart, FileText, FolderOpen, HeartPulse, LockKeyhole, Share2, ShieldCheck, Stethoscope, Upload, UserRoundCheck, UsersRound } from 'lucide-react'
import Brand from '../components/Brand'
import Footer from '../components/Footer'
import { useAuth } from '../components/AuthContext'
import { requestPasswordReset, resetPassword, verifyPasswordResetOtp } from '../services/authApi'

function PublicNav() {
  return (
    <header className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-8 md:grid-cols-[auto_1fr_auto] md:gap-x-6 md:py-5">
      <Link to="/" className="shrink-0">
        <Brand />
      </Link>
      <nav className="col-span-2 row-start-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600 sm:text-sm md:col-span-1 md:col-start-2 md:row-start-1 md:gap-5 lg:gap-8">
        <Link className="whitespace-nowrap hover:text-teal" to="/how-it-works">How it works</Link>
        <Link className="whitespace-nowrap hover:text-teal" to="/for-you">For you</Link>
        <Link className="whitespace-nowrap hover:text-teal" to="/privacy">Privacy</Link>
      </nav>
      <div className="col-start-2 row-start-1 ml-auto flex shrink-0 items-center gap-2 sm:gap-3 md:col-start-3">
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
              Your health history
              <br />
              <span className="text-teal">Organized Intelligently at one place </span>
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

        <section id="how-it-works" className="border-y border-slate-100 bg-white py-14">
          <div className="mx-auto mb-10 max-w-7xl px-5 sm:px-8">
            <p className="eyebrow">A clear path through your care</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">From your records to a more prepared visit.</h2>
          </div>
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 md:grid-cols-3">
            <Feature icon={FileHeart} title="Add your health information" text="Collect results, visit summaries, medications, and key details in one organized profile." />
            <Feature icon={UsersRound} title="Choose what to share" text="Connect with a clinician and review which parts of your history are available to them." />
            <Feature icon={LockKeyhole} title="Use it to prepare" text="Bring relevant history and questions into the conversation, then keep a record of what comes next." />
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
              <RoleCard icon={FileHeart} label="FOR PATIENTS" title="Keep your health story together" text="Find records, track events over time, prepare visit details, and decide what to share." links={[["Medical records", "/records", FolderOpen], ["Health timeline", "/timeline", Clock3], ["Prepare for a visit", "/intake", ClipboardList]]} to="/patient" action="Explore patient view" />
              <RoleCard icon={Stethoscope} label="FOR CLINICIANS" title="Review shared context" text="See connected patient information, review incoming requests, and follow a clear clinical timeline." links={[["Connected patients", "/doctor/connections", UsersRound], ["Shared records", "/doctor/records", FolderOpen], ["Patient intake", "/doctor/intake", ClipboardList]]} to="/doctor" action="Explore clinician view" />
            </div>
            <p className="mt-5 text-xs text-slate-400">This portfolio demo uses fictional records and does not coordinate or schedule care.</p>
          </div>
        </section>

        <section id="privacy" className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Your choices stay visible</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Sharing should be clear at a glance.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">CareVault’s prototype makes sharing choices easy to find: connect with an invite code, review access by category, and return to those choices when your needs change.</p>
            <Link to="/sharing" className="btn-primary mt-6">Explore sharing controls <ArrowRight size={16} /></Link>
            <p className="mt-3 text-xs text-slate-400">These controls are a UI demo. No real records are shared.</p>
          </div>
          <div className="card p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><LockKeyhole size={18} /></span><div><p className="text-xs text-slate-400">SHARING PREVIEW</p><p className="mt-1 text-sm font-semibold">Dr. Anika Sharma</p></div></div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Connected</span>
            </div>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Choose what to share</p>
            <SharingPreviewRow label="Visit summaries" checked />
            <SharingPreviewRow label="Lab results" checked />
            <SharingPreviewRow label="Medications" checked />
            <SharingPreviewRow label="Patient-entered intake" checked={false} />
            <Link to="/connections" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">Manage care connections <ArrowUpRight size={14} /></Link>
          </div>
        </section>

        {/* Shared Footer & CTA UI */}
        <Footer />
      </main>
    </div>
  )
}

function PublicInfoPage({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export function HowItWorksPage() {
  return (
    <PublicInfoPage>
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute -right-28 -top-36 h-[30rem] w-[30rem] rounded-full bg-mint/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="eyebrow">How CareVault works</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-.04em] text-ink sm:text-5xl lg:text-[58px]">Your health records, finally in one place.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Bring your medical documents and personal health context together. When it’s time to share, you decide which doctor gets access and for how long.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary">Create an account <ArrowRight size={16} /></Link>
              <Link to="/login" className="btn-secondary">Explore the demo</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-teal" /> One organized record space</span>
              <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-teal" /> Patient-controlled access</span>
            </div>
          </div>
          <VaultPreview />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">A simple, patient-led journey</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">From scattered files to a clearer picture.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">CareVault brings the practical steps of record keeping and sharing into one steady flow.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <JourneyCard number="01" icon={Upload} title="Upload records" text="Add the medical documents you want to keep together." />
          <JourneyCard number="02" icon={FolderOpen} title="Keep them organized" text="Find stored files in one place when you need them." />
          <JourneyCard number="03" icon={HeartPulse} title="Add your context" text="Record concerns, allergies, medications, and other health details." />
          <JourneyCard number="04" icon={UserRoundCheck} title="Choose access" text="Select a registered doctor and set a time limit for access." />
          <JourneyCard number="05" icon={FileHeart} title="Review together" text="Your doctor can view records while your permission is active." />
        </div>
      </section>

      <section className="bg-[#f0efff]/55 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Your CareVault</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A record that’s easier to bring with you.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Keep uploaded documents alongside the health intake you provide. The records stay attached to your account, ready for you to review and share when you choose.</p>
            <Link to="/records" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline">Explore medical records <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile icon={FolderOpen} title="Medical documents" text="Store and revisit files in your account." />
            <InfoTile icon={Activity} title="Health timeline" text="Explore the timeline view with sample health events." />
            <InfoTile icon={ClipboardList} title="Your health intake" text="Add context in your own words." />
            <InfoTile icon={Clock3} title="Temporary access" text="Share with a doctor for a chosen duration." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Sharing stays in your hands</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A clear path to the right records.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-500">Doctors don’t get access just because they have a CareVault account. A patient grants access, and the doctor’s record view is available only for that patient while the grant remains active.</p>
          </div>
          <div className="card p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ['You choose', UserRoundCheck],
                ['Set duration', Clock3],
                ['Doctor views', FileHeart],
                ['You stay in control', LockKeyhole],
              ].map(([label, Icon], index) => (
                <div key={label} className="relative rounded-2xl bg-slate-50 p-4 text-center">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-mint text-teal"><Icon size={20} /></span>
                  <p className="mt-3 text-xs font-semibold text-slate-700">{label}</p>
                  {index < 3 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-slate-300 sm:block" size={16} />}
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-slate-500">Access ends when it expires or when you revoke it. The doctor’s document requests are checked against that permission.</p>
          </div>
        </div>
      </section>

    </PublicInfoPage>
  )
}

export function ForYouPage() {
  return (
    <PublicInfoPage>
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute -left-28 -top-32 h-[28rem] w-[28rem] rounded-full bg-lilac/60 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="eyebrow">Made for real care conversations</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-[-.04em] sm:text-5xl">A little more clarity for everyone involved in your care.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">CareVault gives patients a place for their records and gives doctors a focused view of the records patients have shared with them.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">Get started <ArrowRight size={16} /></Link>
            <Link to="/login" className="btn-secondary">Explore the demo</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <AudiencePanel
          label="FOR PATIENTS"
          title="Your health information, organized around you."
          text="Keep medical documents and the health context you enter together. Find what you need, then choose whether to share records with a doctor."
          icon={FileHeart}
          points={['Keep uploaded records in one account', 'Add health intake in your own words', 'Grant time-limited access to a doctor']}
          links={[["Medical records", "/records", FolderOpen], ["Health intake", "/intake", ClipboardList], ["Sharing controls", "/sharing", LockKeyhole]]}
          to="/patient"
          action="Explore the patient workspace"
        />
      </section>
      <section className="bg-[#f0efff]/55 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <AudiencePanel
            label="FOR FAMILIES AND CAREGIVERS"
            title="Keep important information easier to find."
            text="When you help someone prepare for a care conversation, having their key documents in one place can reduce the scramble through old files and messages."
            icon={UsersRound}
            points={['Gather relevant documents before a visit', 'Keep a clearer view of the information that matters', 'Share from the patient’s account when they choose']}
            note="CareVault currently supports individual patient accounts; family or dependent profiles are not a separate feature."
          />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <AudiencePanel
          label="FOR DOCTORS"
          title="A focused view of records patients have shared."
          text="See patients who granted you access, review their available documents, and open records through CareVault while their permission is active."
          icon={Stethoscope}
          points={['See your active shared-patient list', 'Open patient-specific documents', 'Access ends on expiry or patient revocation']}
          links={[["Shared patients", "/doctor/patients", UsersRound], ["Shared documents", "/doctor/documents", FolderOpen]]}
          to="/doctor"
          action="Explore the doctor workspace"
        />
      </section>
    </PublicInfoPage>
  )
}

export function PrivacyPage() {
  return (
    <PublicInfoPage>
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute -right-24 -top-36 h-[28rem] w-[28rem] rounded-full bg-mint/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_.85fr]">
          <div>
            <p className="eyebrow">Privacy, made visible</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-.04em] sm:text-5xl">Your health information should stay in your hands.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">CareVault is built around patient-controlled sharing. A doctor sees patient records only when the patient has granted access and that permission is still active.</p>
            <Link to="/sharing" className="btn-primary mt-7">Review sharing controls <ArrowRight size={16} /></Link>
          </div>
          <div className="card relative overflow-hidden p-5 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal to-emerald-400" />
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint text-teal"><ShieldCheck size={21} /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ACCESS STATUS</p><p className="mt-1 text-sm font-semibold">Permission required</p></div>
            </div>
            <div className="mt-5 space-y-3">
              <PrivacyCheck title="Patient grants access" text="The doctor must be selected by the patient." />
              <PrivacyCheck title="Access has an expiry" text="The grant controls how long records can be viewed." />
              <PrivacyCheck title="Patient can revoke" text="Revocation ends the doctor’s access to those records." />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">How CareVault handles access</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Clear boundaries around shared records.</h2>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          <PrivacyCard icon={FolderOpen} title="Your records belong to your account" text="Documents are stored with the patient account that uploaded them. A doctor’s own account does not make another patient’s documents visible." />
          <PrivacyCard icon={UserRoundCheck} title="Access is permission-based" text="A doctor needs an active patient-to-doctor access grant before the doctor workspace can retrieve patient records." />
          <PrivacyCard icon={LockKeyhole} title="Records are not automatically shared" text="Creating an account or uploading a document does not grant a doctor access. The patient controls the sharing action." />
          <PrivacyCard icon={Clock3} title="Access is time-limited" text="When a grant expires or the patient revokes it, the doctor cannot continue opening or downloading those records." />
          <PrivacyCard icon={ShieldCheck} title="Account access is authenticated" text="Protected CareVault routes use the current signed-in account to determine what the user can access." />
          <PrivacyCard icon={FileText} title="Document access goes through CareVault" text="Patient documents are fetched through patient-specific routes that check the active grant before returning a file." />
        </div>
      </section>

      <section className="bg-[#f0efff]/55 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="eyebrow">Sharing at a glance</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">You choose. You stay in control.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ['You choose', UserRoundCheck, 'Select a doctor'],
              ['You grant access', Share2, 'Set a duration'],
              ['Doctor views', FileHeart, 'Only while active'],
              ['You remain in control', LockKeyhole, 'Revoke at any time'],
            ].map(([title, Icon, text], index) => (
              <div key={title} className="relative rounded-2xl border border-white/80 bg-white p-5 shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-mint text-teal"><Icon size={20} /></span>
                <p className="mt-4 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{text}</p>
                {index < 3 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-teal/50 sm:block" size={18} />}
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">CareVault describes the current product behavior; this page does not claim regulatory certification or end-to-end encryption.</p>
        </div>
      </section>
    </PublicInfoPage>
  )
}

function VaultPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-5 rounded-[32px] bg-gradient-to-br from-mint via-lilac to-white blur-2xl" />
      <div className="card relative p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal text-white"><ShieldCheck size={19} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">YOUR CAREVAULT</p><p className="mt-1 font-semibold">Health records</p></div></div>
          <span className="rounded-full bg-mint px-3 py-1 text-[11px] font-semibold text-teal">Organized</span>
        </div>
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#087f70] to-emerald-600 p-5 text-white">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-white/75">HEALTH SNAPSHOT</span><HeartPulse size={20} className="text-white/80" /></div>
          <p className="mt-4 text-lg font-semibold">Your health, in context.</p>
          <p className="mt-1 text-xs leading-5 text-white/75">Documents and patient-provided information, together.</p>
        </div>
        <div className="mt-5 flex items-center justify-between"><p className="text-sm font-semibold">Recent documents</p><span className="text-xs text-slate-400">Your files</span></div>
        <div className="mt-3 space-y-2">
          {['Lab result', 'Visit summary', 'Prescription'].map((name, i) => (
            <div key={name} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${i === 1 ? 'bg-lilac text-indigo-600' : 'bg-mint text-teal'}`}><FileText size={17} /></span>
              <span className="flex-1 text-sm font-medium text-slate-700">{name}</span>
              <CheckCircle2 size={16} className="text-teal" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500"><LockKeyhole size={14} className="text-teal" /> Sharing stays under your control</div>
      </div>
    </div>
  )
}

function JourneyCard({ number, icon: Icon, title, text }) {
  return (
    <article className="card group p-5 transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-teal">{number}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal transition group-hover:bg-teal group-hover:text-white"><Icon size={18} /></span></div>
      <h3 className="mt-5 text-sm font-bold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </article>
  )
}

function InfoTile({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-teal"><Icon size={18} /></span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  )
}

function AudiencePanel({ label, title, text, icon: Icon, points, links, to, action, note }) {
  return (
    <article className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(24,38,61,.05)] lg:grid-cols-[.9fr_1.1fr]">
      <div className="relative overflow-hidden bg-gradient-to-br from-mint to-[#f1efff] p-7 sm:p-9">
        <span className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border-[30px] border-white/35" />
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white text-teal shadow-sm"><Icon size={24} /></span>
        <p className="relative mt-7 text-xs font-bold tracking-[.14em] text-teal">{label}</p>
        <h2 className="relative mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h2>
        <p className="relative mt-4 text-sm leading-6 text-slate-600">{text}</p>
      </div>
      <div className="p-7 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">What CareVault helps with</p>
        <ul className="mt-5 space-y-4">
          {points.map((point) => <li key={point} className="flex items-start gap-3 text-sm leading-6 text-slate-600"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-teal" />{point}</li>)}
        </ul>
        {note && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{note}</p>}
        {links && <div className="mt-6 flex flex-wrap gap-2">{links.map(([label, href, IconLink]) => <Link key={label} to={href} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-teal/20 hover:bg-mint hover:text-teal"><IconLink size={15} />{label}</Link>)}</div>}
        {to && <Link to={to} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal hover:underline">{action}<ArrowUpRight size={16} /></Link>}
      </div>
    </article>
  )
}

function PrivacyCheck({ title, text }) {
  return <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-teal" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>
}

function PrivacyCard({ icon: Icon, title, text }) {
  return <article className="card flex gap-4 p-5 sm:p-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-teal"><Icon size={19} /></span><div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div></article>
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
