import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'college.edu.in'

  const allowed = typeof email === 'string' && email.toLowerCase().endsWith('@' + allowedDomain)

  return NextResponse.json({ allowed, allowedDomain })
}