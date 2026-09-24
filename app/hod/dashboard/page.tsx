// Save this as app/hod/dashboard/page.tsx (create the "dashboard" folder inside app/hod/).

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

type Stats = {
  total: number
  available: number
  locked: number
  pending: number
  completed: number
  rejected: number
  pendingGroupReview: number
}

export default function HodDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isHod, setIsHod] = useState(false)
  const [stats, setStats] = useState<Stats>({
    total: 0, available: 0, locked: 0, pending: 0, completed: 0, rejected: 0, pendingGroupReview: 0,
  })

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

    const [
      { count: total },
      { count: available },
      { count: locked },
      { count: pending },
      { count: pendingGroupReview },
      { count: rejected },
      { data: lockedTopics },
    ] = await Promise.all([
      supabase.from('topics').select('*', { count: 'exact', head: true }),
      supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'locked'),
      supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'pending_group_review'),
      supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('topics').select('locked_group_id').eq('status', 'locked'),
    ])

    let completed = 0
    const lockedGroupIds = (lockedTopics || []).map((t) => t.locked_group_id).filter(Boolean)
    if (lockedGroupIds.length > 0) {
      const { count } = await supabase
        .from('group_progress')
        .select('*', { count: 'exact', head: true })
        .eq('milestone_name', 'Final Submission')
        .eq('completed', true)
        .in('group_id', lockedGroupIds)
      completed = count || 0
    }

    setStats({
      total: total || 0,
      available: available || 0,
      locked: locked || 0,
      pending: pending || 0,
      pendingGroupReview: pendingGroupReview || 0,
      rejected: rejected || 0,
      completed,
    })
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !isHod) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  const cards = [
    { label: 'Total Projects', value: stats.total, tone: 'text-[var(--text)]' },
    { label: 'Available Topics', value: stats.available, tone: 'text-[var(--success)]' },
    { label: 'Selected Topics', value: stats.locked, tone: 'text-[var(--accent)]' },
    { label: 'Pending Approvals', value: stats.pending + stats.pendingGroupReview, tone: 'text-[var(--warning)]' },
    { label: 'Completed Projects', value: stats.completed, tone: 'text-[var(--accent-2)]' },
  ]

  const breakdown = [
    { label: 'Available', value: stats.available, color: 'var(--success)' },
    { label: 'Pending', value: stats.pending, color: 'var(--warning)' },
    { label: 'Awaiting Group', value: stats.pendingGroupReview, color: 'var(--warning)' },
    { label: 'Locked', value: stats.locked, color: 'var(--accent)' },
    { label: 'Rejected', value: stats.rejected, color: 'var(--danger)' },
  ]
  const maxBreakdown = Math.max(...breakdown.map((b) => b.value), 1)

  return (
    <div className="min-h-screen flex flex-col">
      <Header role="hod" active="/hod/dashboard" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display font-semibold text-3xl mb-8">Dashboard</h1>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
            {cards.map((c) => (
              <div key={c.label} className="glass-card fade-rise-in px-4 py-6 text-center">
                <div className={`font-display font-semibold text-3xl ${c.tone}`}>{c.value}</div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-soft)] font-mono mt-1">
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card fade-rise-in px-8 py-8">
            <h2 className="font-display font-semibold text-xl mb-6">Project Status Overview</h2>
            <div className="space-y-4">
              {breakdown.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--text-soft)]">{b.label}</span>
                    <span className="font-mono">{b.value}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.value / maxBreakdown) * 100}%`,
                        background: b.color,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}