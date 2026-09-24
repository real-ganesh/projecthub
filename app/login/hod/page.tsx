// Replace the ENTIRE contents of app/login/hod/page.tsx with this.
// (Same logic as before — only the styling changed.)

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HubMark } from '@/app/components/Header'

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
    router.push('/hod/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card fade-rise-in w-full max-w-sm px-8 py-10">
        <div className="flex justify-center mb-3"><HubMark /></div>
        <h1 className="font-display font-semibold text-2xl mb-1 text-center">HoD Login</h1>
        <p className="text-sm text-[var(--text-soft)] text-center mb-6">
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

          {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait…' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}