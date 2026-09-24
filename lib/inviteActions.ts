// Save this as lib/inviteActions.ts

import { supabase } from './supabase'
import { createNotification } from './notifications'

export async function acceptGroupInvite(inviteId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: invite } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_by, groups(name), profiles!group_invites_invited_by_fkey(full_name)')
    .eq('id', inviteId)
    .single()

  if (!invite) return { error: 'Invite not found — it may have already been handled.' }

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: invite.group_id, student_id: user.id, status: 'active' })

  if (memberError) return { error: memberError.message }

  await supabase.from('group_invites').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', inviteId)

  const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const groupName = (invite.groups as unknown as { name: string })?.name || 'the group'

  await createNotification(
    invite.invited_by,
    'invite_accepted',
    `${myProfile?.full_name || 'A student'} accepted your invite to ${groupName}`,
    invite.group_id
  )

  return {}
}

export async function declineGroupInvite(inviteId: string): Promise<{ error?: string }> {
  const { data: invite } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_by, groups(name)')
    .eq('id', inviteId)
    .single()

  if (!invite) return { error: 'Invite not found — it may have already been handled.' }

  await supabase.from('group_invites').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', inviteId)

  const groupName = (invite.groups as unknown as { name: string })?.name || 'the group'
  await createNotification(invite.invited_by, 'invite_declined', `A student declined your invite to ${groupName}`, invite.group_id)

  return {}
}