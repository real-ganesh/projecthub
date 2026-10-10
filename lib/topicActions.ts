// Replace the ENTIRE contents of lib/topicActions.ts with this.

import { supabase } from './supabase'
import { notifyGroupMembers, notifyHods } from './notifications'

export type ActionableTopic = {
  id: string
  title: string
  status: string
  group_id: string
  category_id: string
}

const ALREADY_HANDLED = 'This request has already been handled.'

async function logHistory(topicId: string, oldStatus: string, newStatus: string, note: string | null) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('topic_status_history').insert({
    topic_id: topicId,
    changed_by: user?.id,
    old_status: oldStatus,
    new_status: newStatus,
    note,
  })
}

// Marks the HoD's "topic requested" notifications for this topic as handled,
// so the Approve/Reject buttons disappear no matter where the HoD acted
// (Approvals page or notification bell).
async function markRequestNotificationsHandled(topicId: string) {
  await supabase
    .from('notifications')
    .update({ action_taken: true })
    .eq('type', 'topic_requested')
    .eq('related_id', topicId)
}

export async function approveTopic(t: ActionableTopic): Promise<{ error?: string }> {
  // A group can only have one locked topic (ignoring this same topic).
  const { data: existingLocked } = await supabase
    .from('topics')
    .select('id')
    .eq('locked_group_id', t.group_id)
    .eq('status', 'locked')
    .neq('id', t.id)
    .limit(1)
    .maybeSingle()

  if (existingLocked) {
    return { error: 'This group already has a locked topic. Reject or reassign their existing one first.' }
  }

  // Atomic claim: the update only succeeds if the topic is STILL pending,
  // and we check that a row was really changed. Only one caller can win.
  const { data: claimed, error: claimError } = await supabase
    .from('topics')
    .update({ status: 'locked' })
    .eq('id', t.id)
    .eq('status', 'pending')
    .select('id')

  if (claimError) {
    return { error: claimError.message }
  }
  if (!claimed || claimed.length === 0) {
    await markRequestNotificationsHandled(t.id)
    return { error: ALREADY_HANDLED }
  }

  await supabase.from('groups').update({ roster_frozen: true }).eq('id', t.group_id)

  const { data: category } = await supabase
    .from('topic_categories')
    .select('milestones')
    .eq('id', t.category_id)
    .single()

  const milestones = (category?.milestones || []) as { name: string; weight: number }[]

  // Only insert milestones this group does not already have,
  // so approving again can never create duplicates.
  const { data: existingRows } = await supabase
    .from('group_progress')
    .select('milestone_name')
    .eq('group_id', t.group_id)

  const alreadyHave = new Set((existingRows || []).map((r) => r.milestone_name))
  const toInsert = milestones.filter((m) => !alreadyHave.has(m.name))

  let milestoneError = ''
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('group_progress').insert(
      toInsert.map((m) => ({ group_id: t.group_id, milestone_name: m.name, weight_percent: m.weight }))
    )
    if (insertError) milestoneError = insertError.message
  }

  await logHistory(t.id, t.status, 'locked', null)
  await notifyGroupMembers(t.group_id, 'topic_approved', `Your topic "${t.title}" has been approved!`, t.id)
  await markRequestNotificationsHandled(t.id)

  if (milestoneError) {
    return { error: `Topic approved, but milestones could not be created: ${milestoneError}` }
  }
  return {}
}

export async function rejectTopic(t: ActionableTopic): Promise<{ error?: string }> {
  // Only a topic that is still pending can be rejected.
  // This stops a late Reject from undoing an Approve.
  const { data: updated, error } = await supabase
    .from('topics')
    .update({ status: 'available', locked_group_id: null, requested_at: null })
    .eq('id', t.id)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    return { error: error.message }
  }
  if (!updated || updated.length === 0) {
    await markRequestNotificationsHandled(t.id)
    return { error: ALREADY_HANDLED }
  }

  await logHistory(t.id, t.status, 'rejected', null)
  await notifyGroupMembers(t.group_id, 'topic_rejected', `Your request for "${t.title}" was rejected.`, t.id)
  await markRequestNotificationsHandled(t.id)
  return {}
}

export async function requestChangesOnTopic(t: ActionableTopic, note: string): Promise<{ error?: string }> {
  // Same protection: only works while the topic is still pending.
  const { data: updated, error } = await supabase
    .from('topics')
    .update({ status: 'pending_group_review' })
    .eq('id', t.id)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    return { error: error.message }
  }
  if (!updated || updated.length === 0) {
    await markRequestNotificationsHandled(t.id)
    return { error: ALREADY_HANDLED }
  }

  await logHistory(t.id, t.status, 'pending_group_review', note)
  await notifyGroupMembers(t.group_id, 'changes_requested', `HoD requested changes on "${t.title}": ${note}`, t.id)
  await markRequestNotificationsHandled(t.id)
  return {}
}

// Called when a group requests or proposes a topic, so HoD gets
// notified there's something to review.
export async function notifyHodOfNewRequest(topicTitle: string, groupName: string, topicId: string) {
  await notifyHods('topic_requested', `${groupName} requested the topic "${topicTitle}"`, topicId)
}