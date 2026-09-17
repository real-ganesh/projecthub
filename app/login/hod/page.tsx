'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Seal() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3 text-[var(--color-ink)]">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 10h7l3 3v9H11V10z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M18 10v3h3" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <line x1="13" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="13" y1="19" x2="19" y2="19" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export default function HodLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError || profile?.role !== 'hod') {
      await supabase.auth.signOut()
      setLoading(false)
      setError('This login is for HoD accounts only.')
      return
    }

    setLoading(false)
    router.push('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="ledger-card fade-rise-in w-full max-w-sm px-8 py-10">
        <Seal />
        <h1 className="font-display italic text-2xl mb-1 text-center">HoD Login</h1>
        <p className="text-sm text-[var(--color-ink-soft)] text-center mb-6">
          Sign in with your department account.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Institutional email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
          />

          {error && <p className="text-[var(--color-stamp-red)] text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait…' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}