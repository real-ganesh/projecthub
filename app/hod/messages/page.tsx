// Replace the ENTIRE contents of app/hod/messages/page.tsx with this.
// (Student names are now clickable links to their profile page.
// Row changed from <button> to <div> since a link can't live inside
// a button — clicking the row still selects the student to chat with,
// clicking the name specifically goes to their profile instead.)

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { ChatWindow, ChatMessage } from '@/app/components/ChatWindow'
import { notifyChatMessage } from '@/lib/notifications'

type Student = { id: string; full_name: string; unread: number; lastActivity: number }

export default function HodMessagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hodId, setHodId] = useState<string | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<Student | null>(null)

  const loadStudents = useCallback(async (currentHodId: string) => {
    const { data: studentList } = await supabase.from('profiles').select('id, full_name').eq('role', 'student')
    const { data: unreadRows } = await supabase
      .from('notifications')
      .select('related_id')
      .eq('user_id', currentHodId)
      .eq('type', 'new_dm_message')
      .eq('is_read', false)
    const { data: lastMessages } = await supabase
      .from('direct_messages')
      .select('student_id, created_at')
      .eq('hod_id', currentHodId)
      .order('created_at', { ascending: false })

    const unreadCounts: Record<string, number> = {}
    for (const row of unreadRows || []) {
      if (row.related_id) unreadCounts[row.related_id] = (unreadCounts[row.related_id] || 0) + 1
    }

    const lastActivity: Record<string, number> = {}
    for (const row of lastMessages || []) {
      if (!lastActivity[row.student_id]) lastActivity[row.student_id] = new Date(row.created_at).getTime()
    }

    const withMeta: Student[] = (studentList || []).map((s) => ({
      id: s.id,
      full_name: s.full_name,
      unread: unreadCounts[s.id] || 0,
      lastActivity: lastActivity[s.id] || 0,
    }))

    withMeta.sort((a, b) => b.lastActivity - a.lastActivity || a.full_name.localeCompare(b.full_name))
    setStudents(withMeta)
  }, [])

  useEffect(() => {
    async function load() {
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
      setHodId(user.id)
      await loadStudents(user.id)
      setLoading(false)
    }
    load()
  }, [router, loadStudents])

  async function selectStudent(s: Student) {
    setSelected(s)
    if (!hodId) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', hodId)
      .eq('type', 'new_dm_message')
      .eq('related_id', s.id)
      .eq('is_read', false)
    setStudents((prev) => prev.map((p) => (p.id === s.id ? { ...p, unread: 0 } : p)))
  }

  async function loadMessages(): Promise<ChatMessage[]> {
    if (!hodId || !selected) return []
    const { data } = await supabase
      .from('direct_messages')
      .select('id, sender_id, content, created_at')
      .eq('student_id', selected.id)
      .eq('hod_id', hodId)
      .order('created_at')

    return (data || []).map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_id === hodId ? 'You' : selected.full_name,
      content: m.content,
      created_at: m.created_at,
    }))
  }

  async function sendMessage(content: string) {
    if (!hodId || !selected) return
    await supabase.from('direct_messages').insert({ student_id: selected.id, hod_id: hodId, sender_id: hodId, content })
    // From HoD -> student: related_id = hodId, so the student's single thread lookup works.
    await notifyChatMessage(selected.id, 'new_dm_message', `${selected.full_name === 'You' ? 'HoD' : 'HoD'}: ${content.slice(0, 60)}`, hodId)
  }

  function subscribe(onNew: (msg: ChatMessage) => void) {
    if (!hodId || !selected) return () => {}
    const channel = supabase
      .channel(`hod-dm-${selected.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `student_id=eq.${selected.id}` },
        (payload) => {
          onNew({
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            sender_name: payload.new.sender_id === hodId ? 'You' : selected.full_name,
            content: payload.new.content,
            created_at: payload.new.created_at,
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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
      <Header role="hod" active="/hod/messages" />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-5">
          <div className="glass-card fade-rise-in px-4 py-4 md:w-64 shrink-0 md:h-[70vh] overflow-y-auto">
            <h2 className="font-display font-semibold text-sm mb-3 px-2">Students</h2>
            {students.length === 0 && <p className="text-sm text-[var(--text-soft)] px-2">No students yet.</p>}
            <div className="space-y-1">
              {students.map((s) => (
                <div
                  key={s.id}
                  onClick={() => selectStudent(s)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between cursor-pointer"
                  style={{
                    background: selected?.id === s.id ? 'rgba(47,111,237,0.1)' : 'transparent',
                    color: selected?.id === s.id ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  <Link
                    href={`/profile/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {s.full_name}
                  </Link>
                  {s.unread > 0 && (
                    <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-mono" style={{ background: 'var(--danger)' }}>
                      {s.unread > 9 ? '9+' : s.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {selected ? (
              <ChatWindow
                key={selected.id}
                title={selected.full_name}
                currentUserId={hodId!}
                loadMessages={loadMessages}
                sendMessage={sendMessage}
                subscribe={subscribe}
              />
            ) : (
              <div className="glass-card fade-rise-in px-8 py-10 text-center h-[70vh] flex items-center justify-center">
                <p className="text-[var(--text-soft)]">Select a student to start chatting.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}