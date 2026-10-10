// Replace the ENTIRE contents of lib/inviteActions.ts with this.

import { supabase } from './supabase'
import { createNotification } from './notifications'

const ALREADY_HANDLED = 'This invite has already been handled.'

// Marks the invitee's "invite received" notification for this invite as
// handled, so the Accept/Decline buttons never come back, no matter where
// the invite was answered from.
async function markInviteNotificationsHandled(inviteId: string) {
  await supabase
    .from('notifications')
    .update({ action_taken: true })
    .eq('type', 'invite_received')
    .eq('related_id', inviteId)
}

function isAnswered(status: string | null | undefined) {
  return status === 'accepted' || status === 'declined'
}

export async function acceptGroupInvite(inviteId: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const { data: invite } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_by, status, groups(name)')
    .eq('id', inviteId)
    .single()

  if (!invite) return { error: 'Invite not found — it may have already been handled.' }

  if (isAnswered(invite.status)) {
    await markInviteNotificationsHandled(inviteId)
    return { error: ALREADY_HANDLED }
  }

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: invite.group_id, student_id: user.id, status: 'active' })

  if (memberError) {
    if (memberError.message.includes('one_active_group_per_student')) {
      return { error: 'You are already in a group, so you cannot accept this invite.' }
    }
    return { error: memberError.message }
  }

  const { error: statusError } = await supabase
    .from('group_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', inviteId)

  await markInviteNotificationsHandled(inviteId)

  const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const groupName = (invite.groups as unknown as { name: string })?.name || 'the group'

  await createNotification(
    invite.invited_by,
    'invite_accepted',
    `${myProfile?.full_name || 'A student'} accepted your invite to ${groupName}`,
    invite.group_id
  )

  if (statusError) {
    return { error: `You joined the group, but the invite status could not be saved: ${statusError.message}` }
  }

  return {}
}

export async function declineGroupInvite(inviteId: string): Promise<{ error?: string }> {
  const { data: invite } = await supabase
    .from('group_invites')
    .select('id, group_id, invited_by, status, groups(name)')
    .eq('id', inviteId)
    .single()

  if (!invite) return { error: 'Invite not found — it may have already been handled.' }

  if (isAnswered(invite.status)) {
    await markInviteNotificationsHandled(inviteId)
    return { error: ALREADY_HANDLED }
  }

  const { error: statusError } = await supabase
    .from('group_invites')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', inviteId)

  if (statusError) return { error: statusError.message }

  await markInviteNotificationsHandled(inviteId)

  const groupName = (invite.groups as unknown as { name: string })?.name || 'the group'
  await createNotification(invite.invited_by, 'invite_declined', `A student declined your invite to ${groupName}`, invite.group_id)

  return {}
}