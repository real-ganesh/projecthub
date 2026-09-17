'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Topic = {
  id: string
  title: string
  problem_statement: string
  status: string
}

export default function TopicDetailPage() {
  const params = useParams()
  const router = useRouter()
  const topicId = params.id as string

  const [topic, setTopic] = useState<Topic | null>(null)
  const [myGroupId, setMyGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: t } = await supabase
        .from('topics')
        .select('id, title, problem_statement, status')
        .eq('id', topicId)
        .single()
      setTopic(t)

      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      setMyGroupId(membership?.group_id || null)

      setLoading(false)
    }
    load()
  }, [topicId, router])

  async function requestApproval() {
    if (!myGroupId) {
      setMessage('You need to be in a group before requesting a topic. Go to My Team first.')
      return
    }

    setRequesting(true)
    setMessage('')

    const { data, error } = await supabase
      .from('topics')
      .update({
        status: 'pending',
        requested_at: new Date().toISOString(),
        locked_group_id: myGroupId,
      })
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

    router.push('/topics')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-ink-soft)]">Loading…</p>
      </div>
    )
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-ink-soft)]">Topic not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule">
        <span className="font-display text-lg italic">ProjectHub</span>
      </header>

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="ledger-card fade-rise-in max-w-xl w-full px-10 py-12">
          <h1 className="font-display italic text-2xl mb-4">{topic.title}</h1>
          <p className="text-[var(--color-ink-soft)] leading-relaxed mb-8">
            {topic.problem_statement}
          </p>

          {message && (
            <p className="text-[var(--color-stamp-red)] text-sm mb-4">{message}</p>
          )}

          {topic.status === 'available' ? (
            <button onClick={requestApproval} disabled={requesting} className="btn-primary w-full">
              {requesting ? 'Requesting…' : 'Send for Approval'}
            </button>
          ) : (
            <span className="stamp stamp-pending">This topic is no longer available</span>
          )}
        </div>
      </main>
    </div>
  )
}