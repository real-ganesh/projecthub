// Replace the ENTIRE contents of app/topics/page.tsx with this.
// (Same logic as before — restyled, uses the shared Header.)

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

type Topic = {
  id: string
  title: string
  status: string
  category_name: string
  locked_group_name: string | null
}

function statusTagClass(status: string) {
  if (status === 'locked') return 'tag-locked'
  if (status === 'pending' || status === 'pending_group_review') return 'tag-pending'
  if (status === 'rejected') return 'tag-rejected'
  return 'tag-approved'
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
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  const categories = Array.from(new Set(topics.map((t) => t.category_name)))

  return (
    <div className="min-h-screen flex flex-col">
      <Header role="student" active="/topics" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display font-semibold text-3xl">Browse Topics</h1>
            <a href="/topics/new" className="btn-secondary text-sm">Propose your own topic</a>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="mb-10">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-soft)] mb-3">
                {cat}
              </h2>
              <div className="space-y-3">
                {topics
                  .filter((t) => t.category_name === cat)
                  .map((t) => (
                    <a
                      key={t.id}
                      href={`/topics/${t.id}`}
                      className="glass-card flex items-center justify-between px-6 py-4"
                    >
                      <span>{t.title}</span>
                      <div className="flex items-center gap-3">
                        {t.locked_group_name && (
                          <span className="text-sm text-[var(--text-soft)] font-mono">
                            {t.locked_group_name}
                          </span>
                        )}
                        <span className={`tag ${statusTagClass(t.status)}`}>{statusLabel(t.status)}</span>
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