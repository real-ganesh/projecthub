// Save this as app/hod/settings/page.tsx (create the "settings" folder inside app/hod/).

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

export default function HodSettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isHod, setIsHod] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  const [academicYear, setAcademicYear] = useState('')
  const [maxGroupSize, setMaxGroupSize] = useState(4)
  const [deadline, setDeadline] = useState('')
  const [rules, setRules] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'hod') {
      router.push('/home')
      return
    }
    setIsHod(true)

    const { data: settings } = await supabase
      .from('settings')
      .select('id, academic_year, max_group_size, project_deadline, selection_rules')
      .eq('is_active', true)
      .single()

    if (settings) {
      setSettingsId(settings.id)
      setAcademicYear(settings.academic_year || '')
      setMaxGroupSize(settings.max_group_size || 4)
      setDeadline(settings.project_deadline ? settings.project_deadline.slice(0, 10) : '')
      setRules(settings.selection_rules || '')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settingsId) return
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('settings')
      .update({
        academic_year: academicYear,
        max_group_size: maxGroupSize,
        project_deadline: deadline ? new Date(deadline).toISOString() : null,
        selection_rules: rules,
      })
      .eq('id', settingsId)

    setSaving(false)
    setMessage(error ? error.message : 'Settings saved.')
  }

  if (loading || !isHod) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header role="hod" active="/hod/settings" />

      <main className="flex-1 px-6 py-12 flex justify-center">
        <form onSubmit={handleSave} className="glass-card fade-rise-in max-w-xl w-full px-10 py-12">
          <h1 className="font-display font-semibold text-2xl mb-6">Settings</h1>

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Academic Year</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026-27"
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Maximum Group Size</label>
          <input
            type="number"
            min={1}
            max={10}
            value={maxGroupSize}
            onChange={(e) => setMaxGroupSize(Number(e.target.value))}
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Project Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Project Selection Rules</label>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={4}
            className="input-field mb-6"
          />

          {message && <p className="text-[var(--accent)] text-sm mb-4">{message}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </main>
    </div>
  )
}