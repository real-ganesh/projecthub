// Save this as app/api/expire-topics/route.ts
// (create "api" if it doesn't exist yet, then "expire-topics" inside it)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  // Simple protection so random people on the internet can't trigger
  // this — Vercel Cron sends this exact header automatically.
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('topics')
    .update({ status: 'available', locked_group_id: null, requested_at: null })
    .eq('status', 'pending')
    .lt('requested_at', cutoff)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expired_count: data?.length || 0 })
}