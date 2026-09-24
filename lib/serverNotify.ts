// Save this as lib/serverNotify.ts
// This is for SERVER-SIDE code only (like cron jobs) — it talks to
// Resend and web-push directly instead of going through your own API
// routes, since a relative fetch('/api/...') doesn't work from
// server code the way it does from a browser.

import { supabaseAdmin } from './supabase-admin'
import { Resend } from 'resend'
import webpush from 'web-push'

const resend = new Resend(process.env.RESEND_API_KEY)

webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function notifyUsersServer(
  userIds: string[],
  type: string,
  content: string,
  relatedId?: string
) {
  if (userIds.length === 0) return

  await supabaseAdmin.from('notifications').insert(
    userIds.map((id) => ({ user_id: id, type, content, related_id: relatedId || null }))
  )

  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email').in('id', userIds)
  for (const p of profiles || []) {
    if (p.email) {
      try {
        await resend.emails.send({
          from: 'ProjectHub <onboarding@resend.dev>',
          to: p.email,
          subject: 'ProjectHub Notification',
          text: content,
        })
      } catch (e) {
        console.error('Server email send failed:', e)
      }
    }
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: 'ProjectHub', body: content })
      )
    } catch {
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }
}

export async function getActiveGroupMemberIds(groupId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
  return (data || []).map((m) => m.student_id)
}