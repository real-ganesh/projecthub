import Link from 'next/link'

function Seal() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="text-[var(--color-ink)]">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 10h7l3 3v9H11V10z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M18 10v3h3" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <line x1="13" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="13" y1="19" x2="19" y2="19" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule flex items-center gap-3">
        <Seal />
        <span className="font-display text-lg italic">ProjectHub</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="ledger-card fade-rise-in max-w-lg w-full px-10 py-12 text-center">
          <h1 className="font-display italic text-4xl mb-4">Welcome</h1>
          <p className="text-[var(--color-ink-soft)] mb-10 leading-relaxed">
            Select and manage your final-year project topic, track progress,
            and stay in sync with your department — all in one place.
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

      <footer className="px-8 py-6 rule text-sm text-[var(--color-ink-soft)] text-center">
        © {new Date().getFullYear()} ProjectHub
      </footer>
    </div>
  )
}