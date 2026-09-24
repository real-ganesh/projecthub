// Replace the ENTIRE contents of app/topics/new/page.tsx with this.
// (Same submit logic as before — now checks existing active topics
// for an exact or similar title before allowing submission. An
// exact match blocks outright; a similar one requires a second
// "Submit Anyway" click.)

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HubMark } from '@/app/components/Header'
import { notifyHodOfNewRequest } from '@/lib/topicActions'

type Category = { id: string; name: string }

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

function wordOverlapRatio(a: string, b: string) {
  const wordsA = new Set(normalize(a).split(' ').filter((w) => w.length > 2))
  const wordsB = new Set(normalize(b).split(' ').filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let common = 0
  wordsA.forEach((w) => { if (wordsB.has(w)) common++ })
  return common / Math.min(wordsA.size, wordsB.size)
}

export default function ProposeTopicPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [solution, setSolution] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')
  const [similarTitles, setSimilarTitles] = useState<string[]>([])
  const [confirmedAnyway, setConfirmedAnyway] = useState(false)
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
        .select('group_id, groups(name)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      setGroupId(membership?.group_id || null)
      setGroupName((membership?.groups as unknown as { name: string })?.name || '')
      setLoading(false)
    }
    load()
  }, [router])

  async function checkForDuplicates(): Promise<'exact' | 'similar' | 'clear'> {
    const { data: existing } = await supabase
      .from('topics')
      .select('title')
      .in('status', ['available', 'pending', 'pending_group_review', 'locked'])

    if (!existing) return 'clear'

    const exact = existing.find((t) => normalize(t.title) === normalize(title))
    if (exact) {
      setError(`A topic with this exact title already exists: "${exact.title}". Please choose a different title or browse existing topics.`)
      return 'exact'
    }

    const similar = existing.filter((t) => wordOverlapRatio(t.title, title) > 0.6).map((t) => t.title)
    if (similar.length > 0) {
      setSimilarTitles(similar)
      return 'similar'
    }

    return 'clear'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!groupId) {
      setError('You need to be in a group before proposing a topic. Go to My Team first.')
      return
    }

    if (!confirmedAnyway) {
      const result = await checkForDuplicates()
      if (result === 'exact') return
      if (result === 'similar') return // shows the warning, waits for a second click
    }

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newTopic, error: insertError } = await supabase
      .from('topics')
      .insert({
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
      .select()
      .single()
    setSubmitting(false)

    if (insertError || !newTopic) {
      setError(insertError?.message || 'Something went wrong.')
      return
    }

    await notifyHodOfNewRequest(title, groupName, newTopic.id)
    router.push('/topics')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule flex items-center justify-center gap-2">
        <HubMark />
        <span className="font-display font-semibold text-lg tracking-wide">ProjectHub</span>
      </header>

      <main className="flex-1 px-6 py-12 flex justify-center">
        <form onSubmit={handleSubmit} className="glass-card fade-rise-in max-w-xl w-full px-10 py-12">
          <h1 className="font-display font-semibold text-2xl mb-6">Propose a Topic</h1>

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input-field mb-4"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setConfirmedAnyway(false); setSimilarTitles([]) }}
            required
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Problem Statement</label>
          <textarea
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            required
            rows={3}
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Proposed Solution</label>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            required
            rows={3}
            className="input-field mb-6"
          />

          {error && <p className="text-[var(--danger)] text-sm mb-4">{error}</p>}

          {similarTitles.length > 0 && !confirmedAnyway && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid var(--warning)' }}>
              <p className="mb-2">Similar topics already exist:</p>
              <ul className="list-disc list-inside text-[var(--text-soft)] mb-2">
                {similarTitles.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p>You can still submit if yours is genuinely different.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
            onClick={() => { if (similarTitles.length > 0) setConfirmedAnyway(true) }}
          >
            {submitting ? 'Submitting…' : similarTitles.length > 0 && !confirmedAnyway ? 'Submit Anyway' : 'Send for Approval'}
          </button>
        </form>
      </main>
    </div>
  )
}