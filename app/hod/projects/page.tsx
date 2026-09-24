'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

type Category = { id: string; name: string }
type Topic = {
  id: string
  title: string
  problem_statement: string
  category_id: string
  category_name: string
  status: string
}

const emptyForm = { title: '', problem_statement: '', category_id: '' }

export default function HodProjects() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isHod, setIsHod] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [topics, setTopics] = useState<Topic[]>([])

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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

    const { data: cats } = await supabase.from('topic_categories').select('id, name')
    setCategories(cats || [])
    if (cats && cats.length > 0 && !form.category_id) {
      setForm((f) => ({ ...f, category_id: cats[0].id }))
    }

    const { data } = await supabase
      .from('topics')
      .select('id, title, problem_statement, category_id, status, topic_categories(name)')
      .order('title')

    setTopics(
      (data || []).map((t) => ({
        id: t.id,
        title: t.title,
        problem_statement: t.problem_statement,
        category_id: t.category_id,
        category_name: (t.topic_categories as unknown as { name: string })?.name || 'Uncategorized',
        status: t.status,
      }))
    )
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(t: Topic) {
    setEditingId(t.id)
    setForm({ title: t.title, problem_statement: t.problem_statement, category_id: t.category_id })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ ...emptyForm, category_id: categories[0]?.id || '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    if (editingId) {
      const { error } = await supabase
        .from('topics')
        .update({ title: form.title, problem_statement: form.problem_statement, category_id: form.category_id })
        .eq('id', editingId)
      setSaving(false)
      if (error) {
        setMessage(error.message)
        return
      }
      setMessage('Topic updated.')
    } else {
      const { error } = await supabase.from('topics').insert({
        title: form.title,
        problem_statement: form.problem_statement,
        category_id: form.category_id,
        status: 'available',
      })
      setSaving(false)
      if (error) {
        setMessage(error.message)
        return
      }
      setMessage('Topic added.')
    }

    cancelEdit()
    load()
  }

  async function handleDelete(id: string, status: string) {
    if (status === 'locked') {
      alert('This topic is locked to a group — reject it first if you need to remove it.')
      return
    }
    if (!confirm('Delete this topic permanently?')) return
    await supabase.from('topics').delete().eq('id', id)
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
      <Header role="hod" active="/hod/projects" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display font-semibold text-3xl mb-8">Projects</h1>

          <form onSubmit={handleSubmit} className="glass-card fade-rise-in px-8 py-8 mb-8">
            <h2 className="font-display font-semibold text-lg mb-4">
              {editingId ? 'Edit Topic' : 'Add New Topic'}
            </h2>

            <label className="block text-sm mb-1 text-[var(--text-soft)]">Category</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="input-field mb-4"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label className="block text-sm mb-1 text-[var(--text-soft)]">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="input-field mb-4"
            />

            <label className="block text-sm mb-1 text-[var(--text-soft)]">Problem Statement</label>
            <textarea
              value={form.problem_statement}
              onChange={(e) => setForm({ ...form, problem_statement: e.target.value })}
              required
              rows={3}
              className="input-field mb-4"
            />

            {message && <p className="text-[var(--accent)] text-sm mb-4">{message}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editingId ? 'Update Topic' : 'Add Topic'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn-secondary">
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            {topics.map((t) => (
              <div key={t.id} className="glass-card fade-rise-in px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-[var(--text-soft)] font-mono">
                    {t.category_name} · {t.status}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(t)} className="btn-secondary text-sm py-1 px-3">Edit</button>
                  <button onClick={() => handleDelete(t.id, t.status)} className="btn-secondary text-sm py-1 px-3 text-[var(--danger)]">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}