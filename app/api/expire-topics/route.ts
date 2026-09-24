// Replace the ENTIRE contents of app/api/expire-topics/route.ts with this.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyUsersServer, getActiveGroupMemberIds } from '@/lib/serverNotify'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const eighteenHoursAgo = new Date(now - 18 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // --- WARN: pending 18h+, not yet expired, not already warned ---
  const { data: toWarn } = await supabaseAdmin
    .from('topics')
    .select('id, title, locked_group_id')
    .eq('status', 'pending')
    .eq('expiry_warned', false)
    .lt('requested_at', eighteenHoursAgo)
    .gt('requested_at', twentyFourHoursAgo)

  let warnedCount = 0
  for (const t of toWarn || []) {
    const memberIds = await getActiveGroupMemberIds(t.locked_group_id)
    await notifyUsersServer(
      memberIds,
      'expiry_warning',
      `Your request for "${t.title}" will expire soon if HoD doesn't act — under 6 hours left.`,
      t.id
    )
    await supabaseAdmin.from('topics').update({ expiry_warned: true }).eq('id', t.id)
    warnedCount++
  }

  // --- EXPIRE: pending 24h+ ---
  const { data: toExpire } = await supabaseAdmin
    .from('topics')
    .select('id, title, locked_group_id')
    .eq('status', 'pending')
    .lt('requested_at', twentyFourHoursAgo)

  let expiredCount = 0
  for (const t of toExpire || []) {
    const memberIds = await getActiveGroupMemberIds(t.locked_group_id)
    await supabaseAdmin
      .from('topics')
      .update({ status: 'available', locked_group_id: null, requested_at: null, expiry_warned: false })
      .eq('id', t.id)
    await notifyUsersServer(
      memberIds,
      'topic_expired',
      `Your request for "${t.title}" expired after 24 hours with no HoD action — it's open again for anyone to request.`,
      t.id
    )
    expiredCount++
  }

  return NextResponse.json({ warned: warnedCount, expired: expiredCount })
}