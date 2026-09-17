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

export default function StudentLogin() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/home')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/check-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const check = await res.json()

    if (!check.allowed) {
      setLoading(false)
      setError(`Please use your institutional email (@${check.allowedDomain})`)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        email,
        role: 'student',
        department,
      })
      if (profileError) {
        setLoading(false)
        setError(profileError.message)
        return
      }
    }

    setLoading(false)
    router.push('/home')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="ledger-card fade-rise-in w-full max-w-sm px-8 py-10">
        <Seal />
        <h1 className="font-display italic text-2xl mb-1 text-center">
          Student {mode === 'login' ? 'Login' : 'Sign Up'}
        </h1>
        <p className="text-sm text-[var(--color-ink-soft)] text-center mb-6">
          {mode === 'login' ? 'Welcome back.' : 'Register with your institutional email.'}
        </p>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {mode === 'signup' && (
            <>
              <input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="input-field"
              />
              <input
                type="text"
                placeholder="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="input-field"
              />
            </>
          )}

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
            minLength={6}
            className="input-field"
          />

          {error && <p className="text-[var(--color-stamp-red)] text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-[var(--color-ink-soft)]">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="underline text-[var(--color-ink)]"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}