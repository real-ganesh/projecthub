// Replace the ENTIRE contents of lib/notifications.ts with this.
// (Same email + in-app logic as before — every function now also
// triggers a real push notification via /api/send-push.)

import { supabase } from './supabase'

async function sendEmail(to: string, subject: string, text: string) {
  try {
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text }),
    })
  } catch (e) {
    console.error('Email send failed:', e)
  }
}

async function sendPush(userId: string, title: string, body: string) {
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body }),
    })
  } catch (e) {
    console.error('Push send failed:', e)
  }
}

export async function createNotification(
  userId: string,
  type: string,
  content: string,
  relatedId?: string
) {
  const { data } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, content, related_id: relatedId || null })
    .select()
    .single()

  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single()
  if (profile?.email) {
    await sendEmail(profile.email, 'ProjectHub Notification', content)
  }
  await sendPush(userId, 'ProjectHub', content)

  return data
}

export async function notifyGroupMembers(
  groupId: string,
  type: string,
  content: string,
  relatedId?: string
) {
  const { data: members } = await supabase
    .from('group_members')
    .select('student_id, profiles(email)')
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (members && members.length > 0) {
    await supabase.from('notifications').insert(
      members.map((m) => ({ user_id: m.student_id, type, content, related_id: relatedId || null }))
    )

    for (const m of members) {
      const email = (m.profiles as unknown as { email: string } | null)?.email
      if (email) await sendEmail(email, 'ProjectHub Notification', content)
      await sendPush(m.student_id, 'ProjectHub', content)
    }
  }
}

export async function notifyAllStudents(type: string, content: string) {
  const { data: students } = await supabase.from('profiles').select('id, email').eq('role', 'student')

  if (students && students.length > 0) {
    await supabase.from('notifications').insert(
      students.map((s) => ({ user_id: s.id, type, content }))
    )

    for (const s of students) {
      if (s.email) await sendEmail(s.email, 'ProjectHub Notification', content)
      await sendPush(s.id, 'ProjectHub', content)
    }
  }
}

export async function notifyHods(type: string, content: string, relatedId?: string) {
  const { data: hods } = await supabase.from('profiles').select('id, email').eq('role', 'hod')

  if (hods && hods.length > 0) {
    await supabase.from('notifications').insert(
      hods.map((h) => ({ user_id: h.id, type, content, related_id: relatedId || null }))
    )

    for (const h of hods) {
      if (h.email) await sendEmail(h.email, 'ProjectHub Notification', content)
      await sendPush(h.id, 'ProjectHub', content)
    }
  }
}