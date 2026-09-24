// Replace the ENTIRE contents of app/team/page.tsx with this.
// (Same as before — added remove-member and transfer-leadership
// controls, visible to the leader only, and only before the roster
// freezes.)

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { createNotification } from '@/lib/notifications'
import { acceptGroupInvite, declineGroupInvite } from '@/lib/inviteActions'

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
  const [rosterFrozen, setRosterFrozen] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [maxGroupSize, setMaxGroupSize] = useState(4)
  const [incomingInvites, setIncomingInvites] = useState<Invite[]>([])

  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)

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
      .select('group_id, groups(id, name, leader_id, roster_frozen)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (myMembership && myMembership.groups) {
      const g = myMembership.groups as unknown as {
        id: string; name: string; leader_id: string; roster_frozen: boolean
      }
      setGroupId(g.id)
      setGroupName(g.name)
      setIsLeader(g.leader_id === user.id)
      setRosterFrozen(g.roster_frozen)

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
    if (!me || groupId || creatingGroup) return
    setCreatingGroup(true)

    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert({ name: newGroupName, leader_id: me.id, department: me.department })
      .select()
      .single()

    if (groupError || !newGroup) {
      setCreatingGroup(false)
      setError(groupError?.message || 'Could not create group.')
      return
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: newGroup.id, student_id: me.id, status: 'active' })

    setCreatingGroup(false)

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

    if (rosterFrozen) {
      setError('Your roster is locked — your topic has already been approved.')
      return
    }
    if (members.length >= maxGroupSize) {
      setError(`Group is already at the maximum size (${maxGroupSize}).`)
      return
    }

    const { data: newInvite, error: inviteError } = await supabase
      .from('group_invites')
      .insert({ group_id: groupId, invited_by: me.id, invited_student_id: studentId })
      .select()
      .single()

    if (inviteError || !newInvite) {
      setError(inviteError?.message || 'Could not send invite.')
      return
    }

    await createNotification(studentId, 'invite_received', `${me.full_name} invited you to join ${groupName}`, newInvite.id)

    setSearch('')
    setSearchResults([])
  }

  async function handleAccept(invite: Invite) {
    setError('')
    const result = await acceptGroupInvite(invite.id)
    if (result.error) {
      setError(result.error)
      return
    }
    await loadEverything()
  }

  async function handleDecline(invite: Invite) {
    setError('')
    const result = await declineGroupInvite(invite.id)
    if (result.error) {
      setError(result.error)
      return
    }
    await loadEverything()
  }

  async function removeMember(member: Member) {
    if (!confirm(`Remove ${member.full_name} from the group?`)) return
    setBusyMemberId(member.student_id)
    setError('')

    const { error: removeError } = await supabase
      .from('group_members')
      .update({ status: 'removed' })
      .eq('group_id', groupId)
      .eq('student_id', member.student_id)

    setBusyMemberId(null)

    if (removeError) {
      setError(removeError.message)
      return
    }

    await createNotification(member.student_id, 'removed_from_group', `You were removed from ${groupName}.`, groupId || undefined)
    await loadEverything()
  }

  async function transferLeadership(member: Member) {
    if (!confirm(`Make ${member.full_name} the new group leader? You'll no longer be able to manage the roster.`)) return
    setBusyMemberId(member.student_id)
    setError('')

    const { error: transferError } = await supabase
      .from('groups')
      .update({ leader_id: member.student_id })
      .eq('id', groupId)

    setBusyMemberId(null)

    if (transferError) {
      setError(transferError.message)
      return
    }

    await createNotification(member.student_id, 'made_leader', `You are now the leader of ${groupName}.`, groupId || undefined)
    await loadEverything()
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
      <Header role="student" active="/team" />

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="w-full max-w-xl">
          {error && <p className="text-[var(--danger)] text-sm mb-4 text-center">{error}</p>}

          {groupId ? (
            <div className="glass-card fade-rise-in px-8 py-10">
              <div className="flex items-center justify-between mb-1">
                <h1 className="font-display font-semibold text-2xl">{groupName}</h1>
                {rosterFrozen && <span className="tag tag-locked">Roster Locked</span>}
              </div>
              <p className="text-sm text-[var(--text-soft)] mb-6 font-mono">
                {members.length} / {maxGroupSize} MEMBERS
              </p>

              <ul className="space-y-2 mb-8">
                {members.map((m) => {
                  const isSelf = m.student_id === me?.id
                  const showLeaderControls = isLeader && !rosterFrozen && !isSelf
                  return (
                    <li key={m.student_id} className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span>{m.full_name}</span>
                      <div className="flex items-center gap-2">
                        {isLeader && isSelf && <span className="tag tag-locked">Leader</span>}
                        {showLeaderControls && (
                          <>
                            <button
                              onClick={() => transferLeadership(m)}
                              disabled={busyMemberId === m.student_id}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              Make Leader
                            </button>
                            <button
                              onClick={() => removeMember(m)}
                              disabled={busyMemberId === m.student_id}
                              className="btn-secondary text-xs py-1 px-2 text-[var(--danger)]"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {rosterFrozen ? (
                <p className="text-sm text-[var(--text-soft)] rounded-xl px-4 py-3" style={{ background: 'rgba(30,64,120,0.04)', border: '1px solid var(--border)' }}>
                  Your topic has been approved, so the roster is locked — no new members can be invited or removed.
                </p>
              ) : (
                isLeader && members.length < maxGroupSize && (
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
                      <button onClick={runSearch} className="btn-secondary whitespace-nowrap">Search</button>
                    </div>
                    <ul className="space-y-2">
                      {searchResults.map((s) => (
                        <li key={s.id} className="flex items-center justify-between">
                          <span className="text-sm">{s.full_name} — {s.email}</span>
                          <button onClick={() => sendInvite(s.id)} className="btn-primary text-sm py-1 px-3">Invite</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          ) : (
            <>
              <form onSubmit={createGroup} className="glass-card fade-rise-in px-8 py-10 mb-8">
                <h1 className="font-display font-semibold text-2xl mb-4">Create a Group</h1>
                <input
                  type="text"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  className="input-field mb-4"
                />
                <button type="submit" disabled={creatingGroup} className="btn-primary w-full">
                  {creatingGroup ? 'Creating…' : 'Create'}
                </button>
              </form>

              {incomingInvites.length > 0 && (
                <div className="glass-card fade-rise-in px-8 py-8">
                  <h2 className="font-display font-semibold text-xl mb-4">Invitations</h2>
                  <ul className="space-y-3">
                    {incomingInvites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between">
                        <span className="text-sm">
                          <strong>{inv.invited_by_name}</strong> invited you to {inv.group_name}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => handleAccept(inv)} className="btn-primary text-sm py-1 px-3">Accept</button>
                          <button onClick={() => handleDecline(inv)} className="btn-secondary text-sm py-1 px-3">Decline</button>
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