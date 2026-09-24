// Replace the ENTIRE contents of app/topics/[id]/page.tsx with this.
// (Same logic as before — solution is now fetched via the
// get_my_topic_solution() function instead of a direct column
// select, matching the new column-level privacy restriction.)

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HubMark } from '@/app/components/Header'
import { notifyHodOfNewRequest } from '@/lib/topicActions'

type Topic = {
  id: string
  title: string
  problem_statement: string
  status: string
  is_custom: boolean
  locked_group_id: string | null
}

export default function TopicDetailPage() {
  const params = useParams()
  const router = useRouter()
  const topicId = params.id as string

  const [topic, setTopic] = useState<Topic | null>(null)
  const [myGroupId, setMyGroupId] = useState<string | null>(null)
  const [myGroupName, setMyGroupName] = useState<string>('')
  const [changeNote, setChangeNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')

  const [editTitle, setEditTitle] = useState('')
  const [editProblemStatement, setEditProblemStatement] = useState('')
  const [editSolution, setEditSolution] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: t } = await supabase
      .from('topics')
      .select('id, title, problem_statement, status, is_custom, locked_group_id')
      .eq('id', topicId)
      .single()
    setTopic(t)
    if (t) {
      setEditTitle(t.title)
      setEditProblemStatement(t.problem_statement)
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, groups(name)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    setMyGroupId(membership?.group_id || null)
    setMyGroupName((membership?.groups as unknown as { name: string })?.name || '')

    const isOwning = membership?.group_id && t?.locked_group_id === membership.group_id

    if (t?.status === 'pending_group_review') {
      const { data: history } = await supabase
        .from('topic_status_history')
        .select('note')
        .eq('topic_id', topicId)
        .eq('new_status', 'pending_group_review')
        .order('changed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setChangeNote(history?.note || null)

      // Only fetch the solution when it's actually needed for editing —
      // this goes through the secure function, not a direct column read.
      if (t.is_custom && isOwning) {
        const { data: solutionText } = await supabase.rpc('get_my_topic_solution', { p_topic_id: topicId })
        setEditSolution(solutionText || '')
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId])

  async function requestApproval() {
    if (!myGroupId) {
      setMessage('You need to be in a group before requesting a topic. Go to My Team first.')
      return
    }

    setRequesting(true)
    setMessage('')

    const { data, error } = await supabase
      .from('topics')
      .update({ status: 'pending', requested_at: new Date().toISOString(), locked_group_id: myGroupId })
      .eq('id', topicId)
      .eq('status', 'available')
      .select()

    setRequesting(false)

    if (error) {
      setMessage(error.message)
      return
    }
    if (!data || data.length === 0) {
      setMessage('Someone just took this topic — please pick another.')
      return
    }

    if (topic) {
      await notifyHodOfNewRequest(topic.title, myGroupName, topicId)
    }

    router.push('/topics')
  }

  async function resubmitAfterChanges() {
    if (!topic) return
    setRequesting(true)
    setMessage('')

    const updates: { title?: string; problem_statement?: string; solution?: string; status: string; requested_at: string } = {
      status: 'pending',
      requested_at: new Date().toISOString(),
    }

    if (topic.is_custom) {
      updates.title = editTitle
      updates.problem_statement = editProblemStatement
      updates.solution = editSolution
    }

    const { error } = await supabase.from('topics').update(updates).eq('id', topicId)

    if (error) {
      setRequesting(false)
      setMessage(error.message)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('topic_status_history').insert({
      topic_id: topicId,
      changed_by: user?.id,
      old_status: 'pending_group_review',
      new_status: 'pending',
      note: null,
    })

    await notifyHodOfNewRequest(updates.title || topic.title, myGroupName, topicId)

    setRequesting(false)
    router.push('/topics')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Topic not found.</p>
      </div>
    )
  }

  const isOwningGroup = myGroupId && topic.locked_group_id === myGroupId

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule flex items-center justify-center gap-2">
        <HubMark />
        <span className="font-display font-semibold text-lg tracking-wide">ProjectHub</span>
      </header>

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="glass-card fade-rise-in max-w-xl w-full px-10 py-12">
          {topic.status === 'pending_group_review' && isOwningGroup ? (
            <>
              <h1 className="font-display font-semibold text-2xl mb-4">{topic.title}</h1>

              <div className="rounded-xl px-4 py-4 mb-6" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid var(--warning)' }}>
                <p className="text-xs font-mono uppercase text-[var(--warning)] mb-1">HoD Requested Changes</p>
                <p className="text-sm">{changeNote || 'No note was left.'}</p>
              </div>

              {topic.is_custom ? (
                <>
                  <label className="block text-sm mb-1 text-[var(--text-soft)]">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-field mb-4"
                  />
                  <label className="block text-sm mb-1 text-[var(--text-soft)]">Problem Statement</label>
                  <textarea
                    value={editProblemStatement}
                    onChange={(e) => setEditProblemStatement(e.target.value)}
                    rows={3}
                    className="input-field mb-4"
                  />
                  <label className="block text-sm mb-1 text-[var(--text-soft)]">Proposed Solution</label>
                  <textarea
                    value={editSolution}
                    onChange={(e) => setEditSolution(e.target.value)}
                    rows={3}
                    className="input-field mb-6"
                  />
                </>
              ) : (
                <p className="text-[var(--text-soft)] leading-relaxed mb-6">{topic.problem_statement}</p>
              )}

              {message && <p className="text-[var(--danger)] text-sm mb-4">{message}</p>}

              <button onClick={resubmitAfterChanges} disabled={requesting} className="btn-primary w-full">
                {requesting ? 'Resubmitting…' : 'Resubmit for Approval'}
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display font-semibold text-2xl mb-4">{topic.title}</h1>
              <p className="text-[var(--text-soft)] leading-relaxed mb-8">{topic.problem_statement}</p>

              {message && <p className="text-[var(--danger)] text-sm mb-4">{message}</p>}

              {topic.status === 'available' ? (
                <button onClick={requestApproval} disabled={requesting} className="btn-primary w-full">
                  {requesting ? 'Requesting…' : 'Send for Approval'}
                </button>
              ) : (
                <span className="tag tag-pending">This topic is no longer available</span>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}