'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { acceptGroupInvite, declineGroupInvite } from '@/lib/inviteActions'
import {
  approveTopic,
  rejectTopic,
  requestChangesOnTopic,
  type ActionableTopic,
} from '@/lib/topicActions'

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

/* -------------------------------------------------------------------------- */
/* Navigation types                                                           */
/* -------------------------------------------------------------------------- */

type NavLink = {
  href: string
  label: string
  badgeKey?: 'group' | 'hod'
}

type ChatBadges = {
  group: number
  hod: number
}

/* -------------------------------------------------------------------------- */
/* Navigation links                                                           */
/* -------------------------------------------------------------------------- */

const studentLinks: NavLink[] = [
  { href: '/home', label: 'Home' },
  { href: '/team', label: 'My Team' },
  { href: '/topics', label: 'Select a Project' },
  { href: '/project', label: 'My Project' },
  { href: '/submission', label: 'Submission' },
  { href: '/chat/group', label: 'Group Chat', badgeKey: 'group' },
  { href: '/chat/hod', label: 'HoD Chat', badgeKey: 'hod' },
]

const hodLinks: NavLink[] = [
  { href: '/hod/dashboard', label: 'Dashboard' },
  { href: '/hod/projects', label: 'Projects' },
  { href: '/hod/groups', label: 'Groups' },
  { href: '/hod/approvals', label: 'Approvals' },
  { href: '/hod/announcements', label: 'Announcements' },
  { href: '/hod/messages', label: 'Messages' },
  { href: '/hod/settings', label: 'Settings' },
]

/* -------------------------------------------------------------------------- */
/* Hamburger navigation                                                       */
/* -------------------------------------------------------------------------- */

function HamburgerNav({
  role,
  active,
}: {
  role: 'student' | 'hod'
  active: string
}) {
  const [open, setOpen] = useState(false)
  const [isSolo, setIsSolo] = useState(false)

  const [chatBadges, setChatBadges] = useState<ChatBadges>({
    group: 0,
    hod: 0,
  })

  // Solo students have no group chat, so that link is hidden for them.
  const links = (role === 'hod' ? hodLinks : studentLinks).filter(
    (l) => !(isSolo && l.href === '/chat/group')
  )

  useEffect(() => {
    if (role !== 'student') return

    async function loadBadges() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id, groups(is_solo)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      const solo = !!(membership?.groups as unknown as { is_solo: boolean } | null)?.is_solo
      setIsSolo(solo)

      let groupUnread = 0

      if (membership?.group_id && !solo) {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('type', 'new_group_message')
          .eq('related_id', membership.group_id)
          .eq('is_read', false)

        groupUnread = count || 0
      }

      const { data: hod } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'hod')
        .limit(1)
        .single()

      let hodUnread = 0

      if (hod?.id) {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('type', 'new_dm_message')
          .eq('related_id', hod.id)
          .eq('is_read', false)

        hodUnread = count || 0
      }

      setChatBadges({
        group: groupUnread,
        hod: hodUnread,
      })
    }

    loadBadges()

    const interval = setInterval(loadBadges, 30000)

    return () => clearInterval(interval)
  }, [role])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-[rgba(30,64,120,0.06)]"
        aria-label="Open menu"
      >
        <span className="block w-5 h-[2px]" style={{ background: 'var(--text)' }} />
        <span className="block w-5 h-[2px]" style={{ background: 'var(--text)' }} />
        <span className="block w-5 h-[2px]" style={{ background: 'var(--text)' }} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-72 max-w-[85vw] h-full glass-card rounded-none px-5 py-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <HubMark size={24} />
                <span className="font-display font-semibold">ProjectHub</span>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="text-2xl leading-none px-2"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {links.map((l) => {
                const badge = l.badgeKey ? chatBadges[l.badgeKey] : 0

                return (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors"
                    style={{
                      background:
                        l.href === active ? 'rgba(47,111,237,0.1)' : 'transparent',
                      color: l.href === active ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    <span>{l.label}</span>

                    {badge > 0 && (
                      <span
                        className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center text-white font-mono"
                        style={{ background: 'var(--danger)' }}
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </a>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

type Notification = {
  id: string
  type: string
  content: string
  is_read: boolean
  created_at: string
  related_id: string | null
  action_taken: boolean
}

function NotificationBell({ role }: { role: 'student' | 'hod' }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string>('')
  const busyRef = useRef(false)

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setUserId(user.id)

    const { data } = await supabase
      .from('notifications')
      .select('id, type, content, is_read, created_at, related_id, action_taken')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const rows = (data || []) as Notification[]

    // Backup safety net: a "topic requested" notification whose topic is no
    // longer pending is treated as handled, even if the saved flag is missing.
    const topicIds = rows
      .filter((n) => n.type === 'topic_requested' && !n.action_taken && n.related_id)
      .map((n) => n.related_id as string)

    let closedIds = new Set<string>()

    if (topicIds.length > 0) {
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('id, status')
        .in('id', topicIds)

      if (!topicsError && topics) {
        const pendingIds = new Set(
          topics.filter((t) => t.status === 'pending').map((t) => t.id as string)
        )
        closedIds = new Set(topicIds.filter((id) => !pendingIds.has(id)))
      }
    }

    setNotifications(
      rows.map((n) =>
        n.type === 'topic_requested' && n.related_id && closedIds.has(n.related_id)
          ? { ...n, action_taken: true }
          : n
      )
    )
  }

  useEffect(() => {
    load()

    const interval = setInterval(load, 30000)

    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // A notification "needs action" while it still shows Approve/Reject style buttons.
  function needsAction(n: Notification) {
    if (n.action_taken) return false
    if (role === 'student') return n.type === 'invite_received' && !!n.related_id
    return n.type === 'topic_requested' && !!n.related_id
  }

  const clearable = notifications.filter((n) => !needsAction(n))

  async function handleOpen() {
    setOpen(!open)

    if (!open && unreadCount > 0 && userId) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .not('type', 'in', '("new_dm_message","new_group_message")')

      setNotifications((prev) =>
        prev.map((n) =>
          n.type === 'new_dm_message' || n.type === 'new_group_message'
            ? n
            : { ...n, is_read: true }
        )
      )
    }
  }

  async function markActionTaken(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ action_taken: true })
      .eq('id', notificationId)
      .select('id')

    if (error || !data || data.length === 0) {
      setActionError(
        'Done, but the "handled" state could not be saved: ' +
          (error?.message || 'no row was updated (check notification update permission).')
      )
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, action_taken: true } : n))
    )
  }

  async function clearIds(ids: string[]) {
    if (ids.length === 0) return
    setActionError('')

    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids)
      .select('id')

    if (error) {
      setActionError(`Could not clear: ${error.message}`)
      return
    }

    if (!data || data.length === 0) {
      setActionError(
        'Could not clear: the database did not allow the delete (the delete permission for notifications is probably missing).'
      )
      return
    }

    const deleted = new Set(data.map((d) => d.id as string))
    setNotifications((prev) => prev.filter((n) => !deleted.has(n.id)))
  }

  async function runInviteAction(
    n: Notification,
    action: (inviteId: string) => Promise<{ error?: string }>
  ) {
    if (!n.related_id || busyRef.current) return

    busyRef.current = true
    setBusyId(n.id)
    setActionError('')

    const result = await action(n.related_id)

    if (result.error) {
      setActionError(result.error)
    } else {
      await markActionTaken(n.id)
    }

    busyRef.current = false
    setBusyId(null)
  }

  async function fetchActionableTopic(topicId: string): Promise<ActionableTopic | null> {
    const { data } = await supabase
      .from('topics')
      .select('id, title, status, locked_group_id, category_id')
      .eq('id', topicId)
      .single()

    if (!data) return null

    return {
      id: data.id,
      title: data.title,
      status: data.status,
      group_id: data.locked_group_id,
      category_id: data.category_id,
    }
  }

  async function runTopicAction(
    n: Notification,
    action: (topic: ActionableTopic) => Promise<{ error?: string }>
  ) {
    if (!n.related_id || busyRef.current) return

    busyRef.current = true
    setBusyId(n.id)
    setActionError('')

    const topic = await fetchActionableTopic(n.related_id)

    if (!topic) {
      setActionError('This topic request no longer exists.')
    } else {
      const result = await action(topic)

      if (result.error) {
        setActionError(result.error)
      } else {
        await markActionTaken(n.id)
      }
    }

    busyRef.current = false
    setBusyId(null)
    await load()
  }

  function handleRequestChangesOnTopic(n: Notification) {
    const note = window.prompt('What changes are needed?')
    if (note === null) return
    runTopicAction(n, (topic) => requestChangesOnTopic(topic, note))
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-[rgba(30,64,120,0.06)] transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.5L4 16h16l-2-3.5V9a6 6 0 0 0-6-6z"
            stroke="var(--text-soft)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          <path
            d="M9.5 19a2.5 2.5 0 0 0 5 0"
            stroke="var(--text-soft)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>

        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white font-mono"
            style={{ background: 'var(--danger)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 sm:w-96 glass-card px-4 py-4 z-50 max-h-[28rem] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-sm">Notifications</h3>

            {clearable.length > 0 && (
              <button
                onClick={() => clearIds(clearable.map((n) => n.id))}
                className="text-xs text-[var(--accent)] underline"
              >
                Clear all
              </button>
            )}
          </div>

          {actionError && (
            <p className="text-xs text-[var(--danger)] mb-3">{actionError}</p>
          )}

          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">Nothing yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => {
                const isHandled = n.action_taken
                const isBusy = busyId === n.id

                return (
                  <div
                    key={n.id}
                    className="text-sm border-b border-[var(--border)] pb-3 last:border-0"
                  >
                    <p className="text-[var(--text)]">{n.content}</p>

                    <div className="flex items-center justify-between mt-0.5 mb-2">
                      <p className="text-xs text-[var(--text-soft)] font-mono">
                        {new Date(n.created_at).toLocaleString()}
                      </p>

                      {!needsAction(n) && (
                        <button
                          onClick={() => clearIds([n.id])}
                          className="text-xs text-[var(--text-soft)] underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {!isHandled &&
                      role === 'student' &&
                      n.type === 'invite_received' &&
                      n.related_id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => runInviteAction(n, acceptGroupInvite)}
                            disabled={isBusy}
                            className="btn-primary text-xs py-1 px-3"
                          >
                            {isBusy ? '…' : 'Accept'}
                          </button>

                          <button
                            onClick={() => runInviteAction(n, declineGroupInvite)}
                            disabled={isBusy}
                            className="btn-secondary text-xs py-1 px-3"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                    {!isHandled &&
                      role === 'hod' &&
                      n.type === 'topic_requested' &&
                      n.related_id && (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => runTopicAction(n, approveTopic)}
                            disabled={isBusy}
                            className="btn-primary text-xs py-1 px-3"
                          >
                            {isBusy ? '…' : 'Approve'}
                          </button>

                          <button
                            onClick={() => runTopicAction(n, rejectTopic)}
                            disabled={isBusy}
                            className="btn-secondary text-xs py-1 px-3"
                          >
                            Reject
                          </button>

                          <button
                            onClick={() => handleRequestChangesOnTopic(n)}
                            disabled={isBusy}
                            className="btn-secondary text-xs py-1 px-3"
                          >
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

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

function AvatarLink({ active }: { active: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const [initial, setInitial] = useState('?')

  useEffect(() => {
    async function loadAvatar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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
      className="block w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-mono text-xs font-semibold transition-all shrink-0"
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

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export function Header({
  role,
  active,
}: {
  role: 'student' | 'hod'
  active: string
}) {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="px-4 sm:px-8 py-4 rule grid grid-cols-3 items-center relative z-10">
      <div className="flex items-center">
        <HamburgerNav role={role} active={active} />
      </div>

      <div className="flex items-center justify-center gap-2 min-w-0">
        <HubMark />

        <span className="font-display font-semibold tracking-wide truncate">
          ProjectHub
        </span>
      </div>

      <div className="flex justify-end items-center gap-2 sm:gap-3">
        <NotificationBell role={role} />

        <AvatarLink active={active} />

        <button
          onClick={handleLogout}
          className="btn-secondary text-xs sm:text-sm py-1.5 px-2 sm:px-4 whitespace-nowrap"
        >
          Log Out
        </button>
      </div>
    </header>
  )
}