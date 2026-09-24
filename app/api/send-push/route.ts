// Save this as app/api/send-push/route.ts
// (create "send-push" folder inside app/api/)

import webpush from 'web-push'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId, title, body } = await req.json()

  if (!userId || !title) {
    return NextResponse.json({ error: 'Missing userId/title' }, { status: 400 })
  }

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      )
      sent++
    } catch {
      // Subscription likely expired/revoked — remove it so we stop
      // retrying a dead endpoint on every future notification.
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }

  return NextResponse.json({ sent })
}