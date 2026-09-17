'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  full_name: string
  role: 'student' | 'hod'
  department: string
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
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
      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-ink-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule flex items-center justify-between">
        <span className="font-display text-lg italic">ProjectHub</span>
        <div className="flex items-center gap-6">
          {profile?.role === 'student' && (
  <nav className="flex gap-6 text-sm">
    <a href="/home" className="underline font-medium">Home</a>
    <a href="/team" className="hover:underline">My Team</a>
    <a href="/topics" className="hover:underline">Select a Project</a>
  </nav>
)}
{profile?.role === 'hod' && (
  <nav className="flex gap-6 text-sm">
    <a href="/home" className="underline font-medium">Home</a>
    <a href="/hod/approvals" className="hover:underline">Approvals</a>
  </nav>
)}
          <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">
            Log Out
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="ledger-card fade-rise-in max-w-md w-full px-10 py-12 text-center">
          <h1 className="font-display italic text-3xl mb-2">
            Welcome, {profile?.full_name}
          </h1>
          <p className="text-[var(--color-ink-soft)] mb-1">{profile?.department}</p>
          <span className={`stamp ${profile?.role === 'hod' ? 'stamp-locked' : 'stamp-approved'} mt-3`}>
            {profile?.role === 'hod' ? 'HoD' : 'Student'}
          </span>
        </div>
      </main>
    </div>
  )
}