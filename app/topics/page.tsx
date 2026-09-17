'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Topic = {
  id: string
  title: string
  status: string
  category_name: string
  locked_group_name: string | null
}

function statusStampClass(status: string) {
  if (status === 'locked') return 'stamp-locked'
  if (status === 'pending' || status === 'pending_group_review') return 'stamp-pending'
  if (status === 'rejected') return 'stamp-rejected'
  return 'stamp-approved'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    available: 'Available',
    pending: 'Pending',
    pending_group_review: 'Changes Requested',
    locked: 'Locked',
    rejected: 'Rejected',
  }
  return map[status] || status
}

export default function TopicsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<Topic[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data } = await supabase
        .from('topics')
        .select('id, title, status, topic_categories(name), groups(name)')
        .order('title')

      setTopics(
        (data || []).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          category_name: (t.topic_categories as unknown as { name: string })?.name || 'Uncategorized',
          locked_group_name: (t.groups as unknown as { name: string } | null)?.name || null,
        }))
      )
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-ink-soft)]">Loading…</p>
      </div>
    )
  }

  const categories = Array.from(new Set(topics.map((t) => t.category_name)))

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule flex items-center justify-between">
        <span className="font-display text-lg italic">ProjectHub</span>
        <nav className="flex gap-6 text-sm">
          <a href="/home" className="hover:underline">Home</a>
          <a href="/team" className="hover:underline">My Team</a>
          <a href="/topics" className="underline font-medium">Select a Project</a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display italic text-3xl">Browse Topics</h1>
            <a href="/topics/new" className="btn-secondary text-sm">Propose your own topic</a>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="mb-10">
              <h2 className="font-medium text-sm uppercase tracking-wide text-[var(--color-ink-soft)] mb-3">
                {cat}
              </h2>
              <div className="space-y-3">
                {topics
                  .filter((t) => t.category_name === cat)
                  .map((t) => (
                    <a
                      key={t.id}
                      href={`/topics/${t.id}`}
                      className="ledger-card flex items-center justify-between px-6 py-4 hover:opacity-90"
                    >
                      <span>{t.title}</span>
                      <div className="flex items-center gap-3">
                        {t.locked_group_name && (
                          <span className="text-sm text-[var(--color-ink-soft)]">
                            {t.locked_group_name}
                          </span>
                        )}
                        <span className={`stamp ${statusStampClass(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </div>
                    </a>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}