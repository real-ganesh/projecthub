// Save this as app/chat/hod/page.tsx (create "hod" folder inside app/chat/).

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { ChatWindow, ChatMessage } from '@/app/components/ChatWindow'

export default function HodChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [hodId, setHodId] = useState<string | null>(null)
  const [hodName, setHodName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUserId(user.id)

      // This assumes a single-department setup with one HoD account.
      const { data: hod } = await supabase.from('profiles').select('id, full_name').eq('role', 'hod').limit(1).single()
      setHodId(hod?.id || null)
      setHodName(hod?.full_name || 'HoD')
      setLoading(false)
    }
    load()
  }, [router])

  async function loadMessages(): Promise<ChatMessage[]> {
    if (!userId || !hodId) return []
    const { data } = await supabase
      .from('direct_messages')
      .select('id, sender_id, content, created_at')
      .eq('student_id', userId)
      .eq('hod_id', hodId)
      .order('created_at')

    return (data || []).map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_id === hodId ? hodName : 'You',
      content: m.content,
      created_at: m.created_at,
    }))
  }

  async function sendMessage(content: string) {
    if (!userId || !hodId) return
    await supabase.from('direct_messages').insert({ student_id: userId, hod_id: hodId, sender_id: userId, content })
  }

  function subscribe(onNew: (msg: ChatMessage) => void) {
    if (!userId) return () => {}
    const channel = supabase
      .channel(`hod-dm-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `student_id=eq.${userId}` },
        (payload) => {
          onNew({
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            sender_name: payload.new.sender_id === hodId ? hodName : 'You',
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
      <Header role="student" active="/chat/hod" />
      <main className="flex-1 px-6 py-12 flex justify-center">
        {!hodId ? (
          <div className="glass-card fade-rise-in px-8 py-10 text-center max-w-md">
            <p className="text-[var(--text-soft)]">No HoD account found yet.</p>
          </div>
        ) : (
          <div className="max-w-xl w-full">
            <ChatWindow
              title={`Chat with ${hodName}`}
              currentUserId={userId!}
              loadMessages={loadMessages}
              sendMessage={sendMessage}
              subscribe={subscribe}
            />
          </div>
        )}
      </main>
    </div>
  )
}