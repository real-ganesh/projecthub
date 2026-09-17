// Save this as app/hod/approvals/page.tsx
// (create the "hod" folder, then "approvals" folder inside app/).

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type PendingTopic = {
  id: string
  title: string
  problem_statement: string
  status: string
  group_id: string
  group_name: string
  requested_at: string
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

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'hod') {
      router.push('/home')
      return
    }
    setIsHod(true)

    const { data } = await supabase
      .from('topics')
      .select('id, title, problem_statement, status, locked_group_id, requested_at, groups(name)')
      .in('status', ['pending', 'pending_group_review'])
      .order('requested_at')

    setTopics(
      (data || []).map((t) => ({
        id: t.id,
        title: t.title,
        problem_statement: t.problem_statement,
        status: t.status,
        group_id: t.locked_group_id,
        group_name: (t.groups as unknown as { name: string } | null)?.name || 'Unknown group',
        requested_at: t.requested_at,
      }))
    )
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function logHistory(topicId: string, oldStatus: string, newStatus: string, note: string | null) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('topic_status_history').insert({
      topic_id: topicId,
      changed_by: user?.id,
      old_status: oldStatus,
      new_status: newStatus,
      note,
    })
  }

  async function approve(t: PendingTopic) {
    setBusyId(t.id)
    await supabase.from('topics').update({ status: 'locked' }).eq('id', t.id)
    await supabase.from('groups').update({ roster_frozen: true }).eq('id', t.group_id)
    await logHistory(t.id, t.status, 'locked', null)
    setBusyId(null)
    load()
  }

  async function reject(t: PendingTopic) {
    setBusyId(t.id)
    await supabase
      .from('topics')
      .update({ status: 'available', locked_group_id: null, requested_at: null })
      .eq('id', t.id)
    await logHistory(t.id, t.status, 'rejected', null)
    setBusyId(null)
    load()
  }

  async function requestChanges(t: PendingTopic) {
    const note = window.prompt('What changes are needed?')
    if (note === null) return // cancelled

    setBusyId(t.id)
    await supabase.from('topics').update({ status: 'pending_group_review' }).eq('id', t.id)
    await logHistory(t.id, t.status, 'pending_group_review', note)
    setBusyId(null)
    load()
  }

  if (loading || !isHod) {
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
        <nav className="flex gap-6 text-sm">
          <a href="/home" className="hover:underline">Dashboard</a>
          <a href="/hod/approvals" className="underline font-medium">Approvals</a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display italic text-3xl mb-8">Approvals</h1>

          {topics.length === 0 && (
            <p className="text-[var(--color-ink-soft)]">Nothing pending right now.</p>
          )}

          <div className="space-y-4">
            {topics.map((t) => (
              <div key={t.id} className="ledger-card fade-rise-in px-8 py-6">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="font-display italic text-xl">{t.title}</h2>
                  <span className="stamp stamp-pending">
                    {t.status === 'pending_group_review' ? 'Awaiting Group' : 'Pending'}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-ink-soft)] mb-1">
                  Requested by <strong>{t.group_name}</strong> — {timeAgo(t.requested_at)}
                </p>
                <p className="text-[var(--color-ink-soft)] mb-5">{t.problem_statement}</p>

                {t.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => approve(t)}
                      disabled={busyId === t.id}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reject(t)}
                      disabled={busyId === t.id}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => requestChanges(t)}
                      disabled={busyId === t.id}
                      className="btn-secondary text-sm py-2 px-4"
                    >
                      Request Changes
                    </button>
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