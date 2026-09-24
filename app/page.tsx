// Replace the ENTIRE contents of app/page.tsx with this.

import Link from 'next/link'
import { HubMark } from './components/Header'

function CircuitScribble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" width="52" height="52" className={className}>
      <path d="M5 30 H20 V15 H40 V45 H55" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="20" cy="15" r="3" fill="currentColor" />
      <circle cx="40" cy="45" r="3" fill="currentColor" />
    </svg>
  )
}

function ChipScribble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width="44" height="44" className={className}>
      <rect x="10" y="10" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="14" y1="4" x2="14" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="4" x2="20" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="26" y1="4" x2="26" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="14" y1="30" x2="14" y2="36" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="30" x2="20" y2="36" stroke="currentColor" strokeWidth="2" />
      <line x1="26" y1="30" x2="26" y2="36" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function WifiScribble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" className={className}>
      <circle cx="20" cy="30" r="2" fill="currentColor" />
      <path d="M12 24a12 12 0 0 1 16 0" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M6 18a20 20 0 0 1 28 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

function RobotArmScribble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width="48" height="48" className={className}>
      <circle cx="6" cy="34" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="6" y1="31" x2="14" y2="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="18" r="2.5" fill="currentColor" />
      <line x1="14" y1="18" x2="28" y2="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="28" cy="10" r="2.5" fill="currentColor" />
      <line x1="28" y1="10" x2="34" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <header className="px-8 py-6 rule flex items-center justify-center gap-2 relative z-10">
        <HubMark />
        <span className="font-display font-semibold text-lg tracking-wide">ProjectHub</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 relative">
        {/* Scattered tech scribbles */}
        <CircuitScribble className="hidden md:block absolute top-16 left-[8%] text-[var(--accent)] opacity-30 -rotate-6" />
        <ChipScribble className="hidden md:block absolute bottom-24 left-[14%] text-[var(--accent-2)] opacity-30 rotate-6" />
        <WifiScribble className="hidden md:block absolute top-24 right-[12%] text-[var(--accent)] opacity-30" />
        <RobotArmScribble className="hidden md:block absolute bottom-20 right-[10%] text-[var(--accent-2)] opacity-30 -rotate-3" />

        <div className="glass-card fade-rise-in max-w-lg w-full px-10 py-12 text-center relative z-10">
          <span className="tag tag-locked mb-5">Software · IoT · Robotics</span>
          <h1 className="font-display font-semibold text-4xl mb-4 mt-4">
            Build your final year, <span className="text-[var(--accent)]">together.</span>
          </h1>
          <p className="text-[var(--text-soft)] mb-10 leading-relaxed">
            Claim a topic, track progress, and stay in sync with your department —
            all in one place.
          </p>

          <div className="flex gap-4 justify-center">
            <Link href="/login/student" className="btn-primary">
              Student Login
            </Link>
            <Link href="/login/hod" className="btn-secondary">
              HoD Login
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-8 py-6 rule text-sm text-[var(--text-soft)] text-center relative z-10">
        © {new Date().getFullYear()} ProjectHub
      </footer>
    </div>
  )
}