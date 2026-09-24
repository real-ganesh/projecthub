// Replace the ENTIRE contents of app/hod/announcements/page.tsx with this.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { notifyAllStudents } from '@/lib/notifications'

type Announcement = { id: string; title: string; body: string; created_at: string }

export default function HodAnnouncements() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isHod, setIsHod] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
      .from('announcements')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false })

    setAnnouncements(data || [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  function startEdit(a: Announcement) {
    setEditingId(a.id)
    setTitle(a.title)
    setBody(a.body)
  }

  function cancelEdit() {
    setEditingId(null)
    setTitle('')
    setBody('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const isNew = !editingId

    if (editingId) {
      await supabase.from('announcements').update({ title, body }).eq('id', editingId)
    } else {
      await supabase.from('announcements').insert({ title, body, hod_id: user?.id })
    }

    if (isNew) {
      await notifyAllStudents('announcement', `New announcement: ${title}`)
    }

    setSaving(false)
    cancelEdit()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
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
      <Header role="hod" active="/hod/announcements" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display font-semibold text-3xl mb-8">Announcements</h1>

          <form onSubmit={handleSubmit} className="glass-card fade-rise-in px-8 py-8 mb-8">
            <h2 className="font-display font-semibold text-lg mb-4">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input-field mb-4"
            />
            <textarea
              placeholder="Message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
              className="input-field mb-4"
            />
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editingId ? 'Update' : 'Post Announcement'}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="glass-card fade-rise-in px-6 py-5">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-display font-semibold">{a.title}</h3>
                  <span className="text-xs text-[var(--text-soft)] font-mono">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-soft)] mb-3">{a.body}</p>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(a)} className="btn-secondary text-sm py-1 px-3">Edit</button>
                  <button onClick={() => handleDelete(a.id)} className="btn-secondary text-sm py-1 px-3 text-[var(--danger)]">
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