// Save this as app/hod/messages/page.tsx (create "messages" folder inside app/hod/).

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { ChatWindow, ChatMessage } from '@/app/components/ChatWindow'

type Student = { id: string; full_name: string }

export default function HodMessagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hodId, setHodId] = useState<string | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<Student | null>(null)

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

      const { data: studentList } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        .order('full_name')
      setStudents(studentList || [])
      setLoading(false)
    }
    load()
  }, [router])

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
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    background: selected?.id === s.id ? 'rgba(47,111,237,0.1)' : 'transparent',
                    color: selected?.id === s.id ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  {s.full_name}
                </button>
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