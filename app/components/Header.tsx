// Replace the ENTIRE contents of app/components/Header.tsx with this.
// (Same bell/avatar logic as before — added chat links to both navs.)

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { acceptGroupInvite, declineGroupInvite } from '@/lib/inviteActions'
import { approveTopic, rejectTopic, requestChangesOnTopic } from '@/lib/topicActions'

export function HubMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="hubGradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2f6fed" />
          <stop offset="100%" stopColor="#ff6b35" />
        </linearGradient>
      </defs>
      <path
        d="M16 2 L28 9 V23 L16 30 L4 23 V9 Z"
        stroke="url(#hubGradient)"
        strokeWidth="1.6"
        fill="rgba(47,111,237,0.06)"
      />
      <circle cx="16" cy="16" r="3.4" fill="url(#hubGradient)" />
      <line x1="16" y1="12.5" x2="16" y2="6" stroke="url(#hubGradient)" strokeWidth="1.3" />
      <line x1="18.8" y1="17.7" x2="24.5" y2="21" stroke="url(#hubGradient)" strokeWidth="1.3" />
      <line x1="13.2" y1="17.7" x2="7.5" y2="21" stroke="url(#hubGradient)" strokeWidth="1.3" />
      <circle cx="16" cy="6" r="1.8" fill="#2f6fed" />
      <circle cx="24.5" cy="21" r="1.8" fill="#ff6b35" />
      <circle cx="7.5" cy="21" r="1.8" fill="#ff6b35" />
    </svg>
  )
}

const studentLinks = [
  { href: '/home', label: 'Home' },
  { href: '/team', label: 'My Team' },
  { href: '/topics', label: 'Select a Project' },
  { href: '/project', label: 'My Project' },
  { href: '/submission', label: 'Submission' },
  { href: '/chat/group', label: 'Group Chat' },
  { href: '/chat/hod', label: 'HoD Chat' },
]

const hodLinks = [
  { href: '/hod/dashboard', label: 'Dashboard' },
  { href: '/hod/projects', label: 'Projects' },
  { href: '/hod/groups', label: 'Groups' },
  { href: '/hod/approvals', label: 'Approvals' },
  { href: '/hod/announcements', label: 'Announcements' },
  { href: '/hod/messages', label: 'Messages' },
  { href: '/hod/settings', label: 'Settings' },
]

type Notification = {
  id: string
  type: string
  content: string
  is_read: boolean
  created_at: string
  related_id: string | null
}

function NotificationBell({ role }: { role: 'student' | 'hod' }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string>('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase
      .from('notifications')
      .select('id, type, content, is_read, created_at, related_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleOpen() {
    setOpen(!open)
    if (!open && unreadCount > 0 && userId) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }

  async function handleAcceptInvite(n: Notification) {
    if (!n.related_id) return
    setBusyId(n.id)
    setActionError('')
    const result = await acceptGroupInvite(n.related_id)
    setBusyId(null)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setHandledIds((prev) => new Set(prev).add(n.id))
  }

  async function handleDeclineInvite(n: Notification) {
    if (!n.related_id) return
    setBusyId(n.id)
    setActionError('')
    const result = await declineGroupInvite(n.related_id)
    setBusyId(null)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setHandledIds((prev) => new Set(prev).add(n.id))
  }

  async function fetchActionableTopic(topicId: string) {
    const { data } = await supabase
      .from('topics')
      .select('id, title, status, locked_group_id, category_id')
      .eq('id', topicId)
      .single()
    if (!data) return null
    return { id: data.id, title: data.title, status: data.status, group_id: data.locked_group_id, category_id: data.category_id }
  }

  async function handleApproveTopic(n: Notification) {
    if (!n.related_id) return
    setBusyId(n.id)
    setActionError('')
    const topic = await fetchActionableTopic(n.related_id)
    if (!topic) {
      setBusyId(null)
      setActionError('This topic request no longer exists.')
      return
    }
    const result = await approveTopic(topic)
    setBusyId(null)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setHandledIds((prev) => new Set(prev).add(n.id))
  }

  async function handleRejectTopic(n: Notification) {
    if (!n.related_id) return
    setBusyId(n.id)
    setActionError('')
    const topic = await fetchActionableTopic(n.related_id)
    if (!topic) {
      setBusyId(null)
      setActionError('This topic request no longer exists.')
      return
    }
    await rejectTopic(topic)
    setBusyId(null)
    setHandledIds((prev) => new Set(prev).add(n.id))
  }

  async function handleRequestChangesOnTopic(n: Notification) {
    if (!n.related_id) return
    const note = window.prompt('What changes are needed?')
    if (note === null) return
    setBusyId(n.id)
    setActionError('')
    const topic = await fetchActionableTopic(n.related_id)
    if (!topic) {
      setBusyId(null)
      setActionError('This topic request no longer exists.')
      return
    }
    await requestChangesOnTopic(topic, note)
    setBusyId(null)
    setHandledIds((prev) => new Set(prev).add(n.id))
  }

  return (
    <div className="relative">
      <button onClick={handleOpen} className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-[rgba(30,64,120,0.06)] transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 3a6 6 0 0 0-6 6v3.5L4 16h16l-2-3.5V9a6 6 0 0 0-6-6z" stroke="var(--text-soft)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="var(--text-soft)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white font-mono" style={{ background: 'var(--danger)' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-96 glass-card px-4 py-4 z-50 max-h-[28rem] overflow-y-auto">
          <h3 className="font-display font-semibold text-sm mb-3">Notifications</h3>
          {actionError && <p className="text-xs text-[var(--danger)] mb-3">{actionError}</p>}
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">Nothing yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => {
                const isHandled = handledIds.has(n.id)
                const isBusy = busyId === n.id
                return (
                  <div key={n.id} className="text-sm border-b border-[var(--border)] pb-3 last:border-0">
                    <p className="text-[var(--text)]">{n.content}</p>
                    <p className="text-xs text-[var(--text-soft)] font-mono mt-0.5 mb-2">
                      {new Date(n.created_at).toLocaleString()}
                    </p>

                    {!isHandled && role === 'student' && n.type === 'invite_received' && n.related_id && (
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptInvite(n)} disabled={isBusy} className="btn-primary text-xs py-1 px-3">
                          {isBusy ? '…' : 'Accept'}
                        </button>
                        <button onClick={() => handleDeclineInvite(n)} disabled={isBusy} className="btn-secondary text-xs py-1 px-3">
                          Decline
                        </button>
                      </div>
                    )}

                    {!isHandled && role === 'hod' && n.type === 'topic_requested' && n.related_id && (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => handleApproveTopic(n)} disabled={isBusy} className="btn-primary text-xs py-1 px-3">
                          {isBusy ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => handleRejectTopic(n)} disabled={isBusy} className="btn-secondary text-xs py-1 px-3">
                          Reject
                        </button>
                        <button onClick={() => handleRequestChangesOnTopic(n)} disabled={isBusy} className="btn-secondary text-xs py-1 px-3">
                          Request Changes
                        </button>
                      </div>
                    )}

                    {isHandled && <span className="tag tag-approved">Handled</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AvatarLink({ active }: { active: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [initial, setInitial] = useState('?')

  useEffect(() => {
    async function loadAvatar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, photo_url')
        .eq('id', user.id)
        .single()
      if (data) {
        setInitial((data.full_name || '?').charAt(0).toUpperCase())
        setPhotoUrl(data.photo_url || null)
      }
    }
    loadAvatar()
  }, [])

  const isActive = active === '/profile'

  return (
    <a
      href="/profile"
      className="block w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-mono text-xs font-semibold transition-all"
      style={{
        border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: photoUrl ? 'transparent' : 'var(--border)',
      }}
      title="Profile"
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </a>
  )
}

export function Header({ role, active }: { role: 'student' | 'hod'; active: string }) {
  const router = useRouter()
  const links = role === 'hod' ? hodLinks : studentLinks

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="px-8 py-5 rule grid grid-cols-3 items-center relative z-10">
      <nav className="flex gap-3 text-sm flex-wrap">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={
              l.href === active
                ? 'text-[var(--accent)] font-medium'
                : 'text-[var(--text-soft)] hover:text-[var(--text)] transition-colors'
            }
          >
            {l.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center justify-center gap-2">
        <HubMark />
        <span className="font-display font-semibold tracking-wide">ProjectHub</span>
      </div>

      <div className="flex justify-end items-center gap-3">
        <NotificationBell role={role} />
        <AvatarLink active={active} />
        <button onClick={handleLogout} className="btn-secondary text-sm py-1.5 px-4">
          Log Out
        </button>
      </div>
    </header>
  )
}