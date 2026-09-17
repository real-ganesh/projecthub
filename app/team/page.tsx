'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = { id: string; full_name: string; email: string; department: string }
type Member = { student_id: string; full_name: string }
type Invite = { id: string; group_id: string; group_name: string; invited_by_name: string }

export default function TeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Profile | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [isLeader, setIsLeader] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [maxGroupSize, setMaxGroupSize] = useState(4)
  const [incomingInvites, setIncomingInvites] = useState<Invite[]>([])

  const [newGroupName, setNewGroupName] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [error, setError] = useState('')

  const loadEverything = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, department')
      .eq('id', user.id)
      .single()
    setMe(profile)

    const { data: settings } = await supabase
      .from('settings')
      .select('max_group_size')
      .eq('is_active', true)
      .single()
    if (settings) setMaxGroupSize(settings.max_group_size)

    const { data: myMembership } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, leader_id)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (myMembership && myMembership.groups) {
      const g = myMembership.groups as unknown as { id: string; name: string; leader_id: string }
      setGroupId(g.id)
      setGroupName(g.name)
      setIsLeader(g.leader_id === user.id)

      const { data: memberRows } = await supabase
        .from('group_members')
        .select('student_id, profiles(full_name)')
        .eq('group_id', g.id)
        .eq('status', 'active')

      setMembers(
        (memberRows || []).map((m) => ({
          student_id: m.student_id,
          full_name: (m.profiles as unknown as { full_name: string })?.full_name || 'Unknown',
        }))
      )
    } else {
      setGroupId(null)
      const { data: invites } = await supabase
        .from('group_invites')
        .select('id, group_id, groups(name), profiles!group_invites_invited_by_fkey(full_name)')
        .eq('invited_student_id', user.id)
        .eq('status', 'pending')

      setIncomingInvites(
        (invites || []).map((i) => ({
          id: i.id,
          group_id: i.group_id,
          group_name: (i.groups as unknown as { name: string })?.name || 'Unknown group',
          invited_by_name: (i.profiles as unknown as { full_name: string })?.full_name || 'Someone',
        }))
      )
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    loadEverything()
  }, [loadEverything])

  async function createGroup(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  if (!me || groupId) return  // guard against double-submit or already having a group

    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert({ name: newGroupName, leader_id: me.id, department: me.department })
      .select()
      .single()

    if (groupError || !newGroup) {
      setError(groupError?.message || 'Could not create group.')
      return
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: newGroup.id, student_id: me.id, status: 'active' })

    if (memberError) {
      setError(memberError.message)
      return
    }

    await loadEverything()
  }

  async function runSearch() {
    if (!me || !search.trim()) {
      setSearchResults([])
      return
    }

    const { data: activeMembers } = await supabase
      .from('group_members')
      .select('student_id')
      .eq('status', 'active')

    const excludedIds = (activeMembers || []).map((m) => m.student_id)
    excludedIds.push(me.id)

    const { data: results } = await supabase
      .from('profiles')
      .select('id, full_name, email, department')
      .eq('department', me.department)
      .eq('role', 'student')
      .ilike('full_name', `%${search}%`)
      .not('id', 'in', `(${excludedIds.join(',')})`)
      .limit(10)

    setSearchResults(results || [])
  }

  async function sendInvite(studentId: string) {
    if (!groupId || !me) return
    setError('')

    if (members.length >= maxGroupSize) {
      setError(`Group is already at the maximum size (${maxGroupSize}).`)
      return
    }

    const { error: inviteError } = await supabase
      .from('group_invites')
      .insert({ group_id: groupId, invited_by: me.id, invited_student_id: studentId })

    if (inviteError) {
      setError(inviteError.message)
      return
    }

    setSearch('')
    setSearchResults([])
  }

  async function acceptInvite(invite: Invite) {
    if (!me) return
    setError('')

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: invite.group_id, student_id: me.id, status: 'active' })

    if (memberError) {
      setError(memberError.message)
      return
    }

    await supabase.from('group_invites').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', invite.id)
    await loadEverything()
  }

  async function declineInvite(inviteId: string) {
    await supabase.from('group_invites').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', inviteId)
    await loadEverything()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--color-ink-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6 rule flex items-center justify-between">
        <span className="font-display text-lg italic">ProjectHub</span>
        <nav className="flex gap-6 text-sm">
          <a href="/home" className="hover:underline">Home</a>
          <a href="/team" className="underline font-medium">My Team</a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="w-full max-w-xl">
          {error && (
            <p className="text-[var(--color-stamp-red)] text-sm mb-4 text-center">{error}</p>
          )}

          {groupId ? (
            <div className="ledger-card fade-rise-in px-8 py-10">
              <h1 className="font-display italic text-2xl mb-1">{groupName}</h1>
              <p className="text-sm text-[var(--color-ink-soft)] mb-6">
                {members.length} / {maxGroupSize} members
              </p>

              <ul className="space-y-2 mb-8">
                {members.map((m) => (
                  <li key={m.student_id} className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                    <span>{m.full_name}</span>
                    {isLeader && m.student_id === me?.id && (
                      <span className="stamp stamp-locked">Leader</span>
                    )}
                  </li>
                ))}
              </ul>

              {isLeader && members.length < maxGroupSize && (
                <div>
                  <h2 className="font-medium mb-2 text-sm">Invite a member</h2>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Search by name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                      className="input-field"
                    />
                    <button onClick={runSearch} className="btn-secondary whitespace-nowrap">
                      Search
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {searchResults.map((s) => (
                      <li key={s.id} className="flex items-center justify-between">
                        <span className="text-sm">{s.full_name} — {s.email}</span>
                        <button onClick={() => sendInvite(s.id)} className="btn-primary text-sm py-1 px-3">
                          Invite
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <form onSubmit={createGroup} className="ledger-card fade-rise-in px-8 py-10 mb-8">
                <h1 className="font-display italic text-2xl mb-4">Create a Group</h1>
                <input
                  type="text"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  className="input-field mb-4"
                />
                <button type="submit" disabled={!!groupId} className="btn-primary w-full">Create</button>
              </form>

              {incomingInvites.length > 0 && (
                <div className="ledger-card fade-rise-in px-8 py-8">
                  <h2 className="font-display italic text-xl mb-4">Invitations</h2>
                  <ul className="space-y-3">
                    {incomingInvites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between">
                        <span className="text-sm">
                          <strong>{inv.invited_by_name}</strong> invited you to {inv.group_name}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => acceptInvite(inv)} className="btn-primary text-sm py-1 px-3">
                            Accept
                          </button>
                          <button onClick={() => declineInvite(inv.id)} className="btn-secondary text-sm py-1 px-3">
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}