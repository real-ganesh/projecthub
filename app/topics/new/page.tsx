// Save this as app/topics/new/page.tsx (create the "new" folder inside app/topics/).

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Category = { id: string; name: string }

export default function ProposeTopicPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [solution, setSolution] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: cats } = await supabase.from('topic_categories').select('id, name')
      setCategories(cats || [])
      if (cats && cats.length > 0) setCategoryId(cats[0].id)

      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      setGroupId(membership?.group_id || null)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!groupId) {
      setError('You need to be in a group before proposing a topic. Go to My Team first.')
      return
    }

    setSubmitting(true)

    // A custom topic goes straight into the approval queue — it skips
    // "available" since it was never open for other groups to browse.
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('topics').insert({
      title,
      problem_statement: problemStatement,
      solution,
      category_id: categoryId,
      is_custom: true,
      created_by: user?.id,
      status: 'pending',
      requested_at: new Date().toISOString(),
      locked_group_id: groupId,
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule">
        <span className="font-display text-lg italic">ProjectHub</span>
      </header>

      <main className="flex-1 px-6 py-12 flex justify-center">
        <form onSubmit={handleSubmit} className="ledger-card fade-rise-in max-w-xl w-full px-10 py-12">
          <h1 className="font-display italic text-2xl mb-6">Propose a Topic</h1>

          <label className="block text-sm mb-1 text-[var(--color-ink-soft)]">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input-field mb-4"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <label className="block text-sm mb-1 text-[var(--color-ink-soft)]">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--color-ink-soft)]">Problem Statement</label>
          <textarea
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            required
            rows={3}
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--color-ink-soft)]">Proposed Solution</label>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            required
            rows={3}
            className="input-field mb-6"
          />

          {error && <p className="text-[var(--color-stamp-red)] text-sm mb-4">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Submitting…' : 'Send for Approval'}
          </button>
        </form>
      </main>
    </div>
  )
}