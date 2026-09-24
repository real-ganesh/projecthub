// Replace the ENTIRE contents of app/hod/approvals/page.tsx with this.
// (Same approve/reject/request-changes logic as before — now shows
// the proposed solution for custom topics, fetched via the secure
// function since direct column access to it is now restricted.)

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { approveTopic, rejectTopic, requestChangesOnTopic } from '@/lib/topicActions'

type PendingTopic = {
  id: string
  title: string
  problem_statement: string
  status: string
  group_id: string
  category_id: string
  is_custom: boolean
  group_name: string
  requested_at: string
  solution?: string
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'less than an hour ago'
  if (hours === 1) return '1 hour ago'
  return `${hours} hours ago`
}

export default function ApprovalsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isHod, setIsHod] = useState(false)
  const [topics, setTopics] = useState<PendingTopic[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null)

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

    const { data } = await supabase
      .from('topics')
      .select('id, title, problem_statement, status, locked_group_id, category_id, is_custom, requested_at, groups(name)')
      .in('status', ['pending', 'pending_group_review'])
      .order('requested_at')

    setTopics(
      (data || []).map((t) => ({
        id: t.id,
        title: t.title,
        problem_statement: t.problem_statement,
        status: t.status,
        group_id: t.locked_group_id,
        category_id: t.category_id,
        is_custom: t.is_custom,
        group_name: (t.groups as unknown as { name: string } | null)?.name || 'Unknown group',
        requested_at: t.requested_at,
      }))
    )
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function toggleSolution(t: PendingTopic) {
    if (expandedSolution === t.id) {
      setExpandedSolution(null)
      return
    }
    if (!t.solution) {
      const { data } = await supabase.rpc('get_my_topic_solution', { p_topic_id: t.id })
      setTopics((prev) => prev.map((p) => (p.id === t.id ? { ...p, solution: data || 'No solution provided.' } : p)))
    }
    setExpandedSolution(t.id)
  }

  async function approve(t: PendingTopic) {
    setBusyId(t.id)
    setError('')
    const result = await approveTopic(t)
    setBusyId(null)
    if (result.error) {
      alert(result.error)
      return
    }
    load()
  }

  async function reject(t: PendingTopic) {
    setBusyId(t.id)
    await rejectTopic(t)
    setBusyId(null)
    load()
  }

  async function requestChanges(t: PendingTopic) {
    const note = window.prompt('What changes are needed?')
    if (note === null) return
    setBusyId(t.id)
    await requestChangesOnTopic(t, note)
    setBusyId(null)
    load()
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
      <Header role="hod" active="/hod/approvals" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display font-semibold text-3xl mb-8">Approvals</h1>

          {error && <p className="text-[var(--danger)] text-sm mb-4">{error}</p>}
          {topics.length === 0 && <p className="text-[var(--text-soft)]">Nothing pending right now.</p>}

          <div className="space-y-4">
            {topics.map((t) => (
              <div key={t.id} className="glass-card fade-rise-in px-8 py-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="font-display font-semibold text-xl">{t.title}</h2>
                  <div className="flex items-center gap-2">
                    {t.is_custom && <span className="tag tag-locked">Custom</span>}
                    <span className="tag tag-pending">
                      {t.status === 'pending_group_review' ? 'Awaiting Group' : 'Pending'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-soft)] mb-1 font-mono">
                  Requested by {t.group_name} — {timeAgo(t.requested_at)}
                </p>
                <p className="text-[var(--text-soft)] mb-3">{t.problem_statement}</p>

                {t.is_custom && (
                  <div className="mb-5">
                    <button onClick={() => toggleSolution(t)} className="text-sm text-[var(--accent)] underline">
                      {expandedSolution === t.id ? 'Hide proposed solution' : 'View proposed solution'}
                    </button>
                    {expandedSolution === t.id && (
                      <p className="text-sm text-[var(--text-soft)] mt-2 rounded-xl px-4 py-3" style={{ background: 'rgba(30,64,120,0.03)', border: '1px solid var(--border)' }}>
                        {t.solution}
                      </p>
                    )}
                  </div>
                )}

                {t.status === 'pending' && (
                  <div className="flex gap-3">
                    <button onClick={() => approve(t)} disabled={busyId === t.id} className="btn-primary text-sm py-2 px-4">Approve</button>
                    <button onClick={() => reject(t)} disabled={busyId === t.id} className="btn-secondary text-sm py-2 px-4">Reject</button>
                    <button onClick={() => requestChanges(t)} disabled={busyId === t.id} className="btn-secondary text-sm py-2 px-4">Request Changes</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}