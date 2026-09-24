// Save this as app/components/ChatWindow.tsx

'use client'

import { useEffect, useRef, useState } from 'react'

export type ChatMessage = {
  id: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
}

export function ChatWindow({
  title,
  currentUserId,
  loadMessages,
  sendMessage,
  subscribe,
}: {
  title: string
  currentUserId: string
  loadMessages: () => Promise<ChatMessage[]>
  sendMessage: (content: string) => Promise<void>
  subscribe: (onNew: (msg: ChatMessage) => void) => () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages().then(setMessages)
    const unsubscribe = subscribe((msg) => setMessages((prev) => [...prev, msg]))
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    await sendMessage(input.trim())
    setInput('')
    setSending(false)
  }

  return (
    <div className="glass-card fade-rise-in flex flex-col h-[70vh] w-full">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h1 className="font-display font-semibold text-lg">{title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && <p className="text-sm text-[var(--text-soft)]">No messages yet — say hi.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[75%] rounded-2xl px-4 py-2 text-sm"
              style={{
                background: m.sender_id === currentUserId ? 'var(--accent)' : 'rgba(30,64,120,0.06)',
                color: m.sender_id === currentUserId ? '#fff' : 'var(--text)',
              }}
            >
              {m.sender_id !== currentUserId && (
                <p className="text-xs font-mono opacity-70 mb-0.5">{m.sender_name}</p>
              )}
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="px-6 py-4 border-t border-[var(--border)] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="input-field"
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary px-5">
          Send
        </button>
      </form>
    </div>
  )
}