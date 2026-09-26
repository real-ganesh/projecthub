// Replace the ENTIRE contents of app/chat/group/page.tsx with this.
// (Same chat logic as before — now notifies other members on send,
// and marks this thread's notifications read on open.)

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { ChatWindow, ChatMessage } from '@/app/components/ChatWindow'
import { notifyChatMessage } from '@/lib/notifications'

export default function GroupChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUserId(user.id)

      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id, groups(name)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      const gId = membership?.group_id || null
      setGroupId(gId)
      setGroupName((membership?.groups as unknown as { name: string })?.name || '')

      // Mark this thread's unread notifications as read now that it's open.
      if (gId) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('type', 'new_group_message')
          .eq('related_id', gId)
          .eq('is_read', false)
      }

      setLoading(false)
    }
    load()
  }, [router])

  async function loadMessages(): Promise<ChatMessage[]> {
    if (!groupId) return []
    const { data } = await supabase
      .from('group_messages')
      .select('id, sender_id, content, created_at, profiles(full_name)')
      .eq('group_id', groupId)
      .order('created_at')

    return (data || []).map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: (m.profiles as unknown as { full_name: string })?.full_name || 'Unknown',
      content: m.content,
      created_at: m.created_at,
    }))
  }

  async function sendMessage(content: string) {
    if (!groupId || !userId) return
    await supabase.from('group_messages').insert({ group_id: groupId, sender_id: userId, content })

    const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('id', userId).single()
    const { data: members } = await supabase
      .from('group_members')
      .select('student_id')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .neq('student_id', userId)

    for (const m of members || []) {
      await notifyChatMessage(
        m.student_id,
        'new_group_message',
        `${senderProfile?.full_name || 'Someone'} in ${groupName}: ${content.slice(0, 60)}`,
        groupId
      )
    }
  }

  function subscribe(onNew: (msg: ChatMessage) => void) {
    if (!groupId) return () => {}
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payload.new.sender_id)
            .single()
          onNew({
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            sender_name: sender?.full_name || 'Unknown',
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
      <Header role="student" active="/chat/group" />
      <main className="flex-1 px-6 py-12 flex justify-center">
        {!groupId ? (
          <div className="glass-card fade-rise-in px-8 py-10 text-center max-w-md">
            <p className="text-[var(--text-soft)]">You need to be in a group first — head to My Team.</p>
          </div>
        ) : (
          <div className="max-w-xl w-full">
            <ChatWindow
              title={`${groupName} — Group Chat`}
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