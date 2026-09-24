// Replace the ENTIRE contents of app/home/page.tsx with this.
// (Same content as before — added a persistent announcements feed
// pulling live from the announcements table.)

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

type Profile = { full_name: string; role: 'student' | 'hod'; department: string }
type Stats = { available: number; locked: number; groups: number }
type Announcement = { id: string; title: string; body: string; created_at: string }

function ChipScribble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" className={className}>
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
    <svg viewBox="0 0 40 40" width="36" height="36" className={className}>
      <circle cx="20" cy="30" r="2" fill="currentColor" />
      <path d="M12 24a12 12 0 0 1 16 0" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M6 18a20 20 0 0 1 28 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

function RobotArmScribble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width="44" height="44" className={className}>
      <circle cx="6" cy="34" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="6" y1="31" x2="14" y2="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="18" r="2.5" fill="currentColor" />
      <line x1="14" y1="18" x2="28" y2="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="28" cy="10" r="2.5" fill="currentColor" />
      <line x1="28" y1="10" x2="34" y2="16" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const infoPanels = [
  {
    title: 'A Field in Motion',
    body: 'Software, AI, IoT, and systems research reshape industries every year. Computer Science rewards students who build real, working systems — not just study theory.',
  },
  {
    title: 'Why the Final Year Project Matters',
    body: 'Your capstone is the bridge between classroom learning and independent engineering. It\'s the first project evaluated end-to-end — problem, design, execution, defense — and often becomes the centerpiece of your portfolio.',
  },
  {
    title: 'About the Department',
    body: 'This platform manages topic selection, approvals, and progress tracking for the department\'s final-year cohort — replacing scattered spreadsheets and email threads with one shared system.',
  },
]

const features = [
  {
    title: 'Claim & Build',
    body: 'Browse the department\'s topic list or propose your own — request it, and it\'s locked to your group the moment it\'s approved.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="var(--accent)" strokeWidth="1.4" />
        <path d="M8 12l3 3 5-6" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Stay in Sync',
    body: 'Everyone sees the same board — who has which topic, what stage they\'re at, and what\'s still open.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="7" cy="7" r="2.5" stroke="var(--accent)" strokeWidth="1.4" />
        <circle cx="17" cy="7" r="2.5" stroke="var(--accent)" strokeWidth="1.4" />
        <circle cx="12" cy="17" r="2.5" stroke="var(--accent)" strokeWidth="1.4" />
        <path d="M9 8.5L10.5 15M15 8.5L13.5 15" stroke="var(--accent)" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    title: 'Get Real Feedback',
    body: 'Approvals, change requests, and submission comments happen right where the work lives — no more lost email threads.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 5h16v11H8l-4 4V5z" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function NetworkIllustration() {
  return (
    <svg viewBox="0 0 400 200" className="w-full h-auto">
      <defs>
        <linearGradient id="netGrad" x1="0" y1="0" x2="400" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2f6fed" />
          <stop offset="100%" stopColor="#ff6b35" />
        </linearGradient>
      </defs>
      {[
        [40, 150], [90, 60], [150, 110], [200, 40], [250, 130],
        [310, 70], [360, 150], [120, 170], [280, 30],
      ].map(([x, y], i, arr) => (
        <g key={i}>
          {arr.slice(i + 1).map(([x2, y2], j) =>
            Math.hypot(x - x2, y - y2) < 110 ? (
              <line key={j} x1={x} y1={y} x2={x2} y2={y2} stroke="url(#netGrad)" strokeWidth="0.8" opacity="0.4" />
            ) : null
          )}
        </g>
      ))}
      {[
        [40, 150], [90, 60], [150, 110], [200, 40], [250, 130],
        [310, 70], [360, 150], [120, 170], [280, 30],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 5 : 3} fill="url(#netGrad)" />
      ))}
    </svg>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats>({ available: 0, locked: 0, groups: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, department')
        .eq('id', user.id)
        .single()
      setProfile(data)

      const [{ count: available }, { count: locked }, { count: groups }, { data: ann }] = await Promise.all([
        supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'locked'),
        supabase.from('groups').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(5),
      ])
      setStats({ available: available || 0, locked: locked || 0, groups: groups || 0 })
      setAnnouncements(ann || [])
      setLoading(false)
    }
    loadProfile()
  }, [router])

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header role={profile.role} active="/home" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card fade-rise-in px-10 py-12 text-center mb-6">
            <h1 className="font-display font-semibold text-3xl mb-2">
              Welcome, {profile.full_name}
            </h1>
            <p className="text-[var(--text-soft)] mb-4">{profile.department}</p>
            <span className={`tag ${profile.role === 'hod' ? 'tag-locked' : 'tag-approved'}`}>
              {profile.role === 'hod' ? 'HoD' : 'Student'}
            </span>
          </div>

          {announcements.length > 0 && (
            <div className="glass-card fade-rise-in px-8 py-7 mb-10">
              <h2 className="font-display font-semibold text-lg mb-4">Announcements</h2>
              <div className="space-y-4">
                {announcements.map((a) => (
                  <div key={a.id} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-sm">{a.title}</h3>
                      <span className="text-xs text-[var(--text-soft)] font-mono">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-soft)]">{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-5 mb-10">
            {[
              { label: 'Topics Available', value: stats.available },
              { label: 'Topics Locked', value: stats.locked },
              { label: 'Groups Formed', value: stats.groups },
            ].map((s) => (
              <div key={s.label} className="glass-card fade-rise-in px-6 py-6 text-center">
                <div className="font-display font-semibold text-3xl text-[var(--accent)]">{s.value}</div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-soft)] font-mono mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {features.map((f) => (
              <div key={f.title} className="glass-card fade-rise-in px-6 py-7">
                <div className="mb-3">{f.icon}</div>
                <h2 className="font-display font-semibold text-lg mb-2">{f.title}</h2>
                <p className="text-sm text-[var(--text-soft)] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="glass-card fade-rise-in px-10 py-10 mb-10 relative overflow-hidden">
            <RobotArmScribble className="hidden md:block absolute top-6 right-8 text-[var(--accent-2)] opacity-25" />
            <WifiScribble className="hidden md:block absolute bottom-8 right-24 text-[var(--accent)] opacity-25" />
            <ChipScribble className="hidden md:block absolute bottom-10 right-4 text-[var(--accent-2)] opacity-20" />
            <h2 className="font-display font-semibold text-2xl mb-3">
              Where Software Meets the <span className="text-[var(--accent)]">Physical World</span>
            </h2>
            <p className="text-[var(--text-soft)] leading-relaxed max-w-2xl relative z-10">
              IoT and robotics projects push beyond the screen — sensors, embedded systems,
              and real-time control loops that interact with the physical world. A soil-moisture
              sensor triggering irrigation, or a microcontroller reading a camera feed, teaches
              constraints a purely software project never will: latency, power budgets, and
              hardware that doesn&apos;t forgive a bug the way a browser refresh does. Both categories
              live side by side here — pick whichever matches your group&apos;s strengths.
            </p>
          </div>

          <div className="glass-card fade-rise-in px-10 py-10 mb-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-display font-semibold text-2xl mb-3">
                Building in a <span className="text-[var(--accent)]">Growing Ecosystem</span>
              </h2>
              <p className="text-[var(--text-soft)] leading-relaxed">
                India is home to one of the world&apos;s largest developer communities, with hubs
                like Bengaluru, Hyderabad, and Pune driving momentum in software, AI research,
                and product engineering. Final-year projects like yours are often the first step
                into that ecosystem — a real system, built and defended, before you ever ship one professionally.
              </p>
            </div>
            <NetworkIllustration />
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {infoPanels.map((p) => (
              <div key={p.title} className="glass-card fade-rise-in px-6 py-7">
                <h2 className="font-display font-semibold text-lg mb-2 text-[var(--accent)]">
                  {p.title}
                </h2>
                <p className="text-sm text-[var(--text-soft)] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}