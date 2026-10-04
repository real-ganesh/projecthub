// Replace the ENTIRE contents of lib/topicActions.ts with this.
// (approveTopic now re-checks the topic's live status before approving,
// closing the gap where two different buttons — Approvals page and the
// notification bell — could both approve the same request and double-insert
// milestone rows into group_progress.)

import { supabase } from './supabase'
import { notifyGroupMembers, notifyHods } from './notifications'

export type ActionableTopic = {
  id: string
  title: string
  status: string
  group_id: string
  category_id: string
}

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

export async function approveTopic(t: ActionableTopic): Promise<{ error?: string }> {
  // Re-check the topic's actual current status right before acting.
  // This closes a race condition where two different buttons (the
  // Approvals page and the notification bell) could both call this
  // function for the same request, which was double-inserting
  // milestone rows into group_progress.
  const { data: currentTopic } = await supabase
    .from('topics')
    .select('status')
    .eq('id', t.id)
    .single()

  if (!currentTopic || currentTopic.status !== 'pending') {
    return { error: 'This request has already been handled.' }
  }

  const { data: existingLocked } = await supabase
    .from('topics')
    .select('id')
    .eq('locked_group_id', t.group_id)
    .eq('status', 'locked')
    .maybeSingle()

  if (existingLocked) {
    return { error: 'This group already has a locked topic. Reject or reassign their existing one first.' }
  }

  const { error: updateError } = await supabase
    .from('topics')
    .update({ status: 'locked' })
    .eq('id', t.id)
    .eq('status', 'pending')

  if (updateError) {
    return { error: updateError.message }
  }

  await supabase.from('groups').update({ roster_frozen: true }).eq('id', t.group_id)

  const { data: category } = await supabase
    .from('topic_categories')
    .select('milestones')
    .eq('id', t.category_id)
    .single()

  const milestones = (category?.milestones || []) as { name: string; weight: number }[]
  if (milestones.length > 0) {
    await supabase.from('group_progress').insert(
      milestones.map((m) => ({ group_id: t.group_id, milestone_name: m.name, weight_percent: m.weight }))
    )
  }

  await logHistory(t.id, t.status, 'locked', null)
  await notifyGroupMembers(t.group_id, 'topic_approved', `Your topic "${t.title}" has been approved!`, t.id)
  return {}
}

export async function rejectTopic(t: ActionableTopic): Promise<{ error?: string }> {
  await supabase.from('topics').update({ status: 'available', locked_group_id: null, requested_at: null }).eq('id', t.id)
  await logHistory(t.id, t.status, 'rejected', null)
  await notifyGroupMembers(t.group_id, 'topic_rejected', `Your request for "${t.title}" was rejected.`, t.id)
  return {}
}

export async function requestChangesOnTopic(t: ActionableTopic, note: string): Promise<{ error?: string }> {
  await supabase.from('topics').update({ status: 'pending_group_review' }).eq('id', t.id)
  await logHistory(t.id, t.status, 'pending_group_review', note)
  await notifyGroupMembers(t.group_id, 'changes_requested', `HoD requested changes on "${t.title}": ${note}`, t.id)
  return {}
}

// Called when a group requests or proposes a topic, so HoD gets
// notified there's something to review.
export async function notifyHodOfNewRequest(topicTitle: string, groupName: string, topicId: string) {
  await notifyHods('topic_requested', `${groupName} requested the topic "${topicTitle}"`, topicId)
}