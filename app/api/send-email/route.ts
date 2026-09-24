import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { to, subject, text } = await req.json()

  if (!to || !subject || !text) {
    return NextResponse.json({ error: 'Missing to/subject/text' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'ProjectHub <onboarding@resend.dev>',
      to,
      subject,
      text,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}