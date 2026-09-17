// Save this as lib/supabase-admin.ts
// This client uses the SERVICE ROLE key, which bypasses RLS entirely —
// never import this into any page or component that runs in the
// browser. It's only for server-side code like API routes/cron jobs.

import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)