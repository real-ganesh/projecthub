// This is a NEW file: app/profile/[id]/page.tsx
// Read-only profile viewer — lets anyone (HoD or group members) view
// another user's profile by clicking their name. No editing controls,
// no push notification section — those only belong on your own /profile.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

export default function ViewProfilePage() {
  const router = useRouter()
  const params = useParams()
  const targetId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [viewerRole, setViewerRole] = useState<'student' | 'hod'>('student')
  const [notFound, setNotFound] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [targetRole, setTargetRole] = useState<'student' | 'hod'>('student')
  const [topicTitle, setTopicTitle] = useState<string | null>(null)
  const [completionPercent, setCompletionPercent] = useState(0)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (viewerProfile) setViewerRole(viewerProfile.role)

    const { data: target } = await supabase
      .from('profiles')
      .select('full_name, email, phone, department, role, photo_url')
      .eq('id', targetId)
      .single()

    if (!target) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setFullName(target.full_name || '')
    setEmail(target.email || '')
    setPhone(target.phone || '')
    setDepartment(target.department || '')
    setPhotoUrl(target.photo_url || null)
    setTargetRole(target.role)

    if (target.role === 'student') {
      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', targetId)
        .eq('status', 'active')
        .maybeSingle()

      if (membership) {
        const { data: topic } = await supabase
          .from('topics')
          .select('title')
          .eq('locked_group_id', membership.group_id)
          .eq('status', 'locked')
          .maybeSingle()
        setTopicTitle(topic?.title || null)

        const { data: progress } = await supabase
          .from('group_progress')
          .select('weight_percent, completed')
          .eq('group_id', membership.group_id)
        const percent = (progress || []).reduce((sum, p) => sum + (p.completed ? p.weight_percent : 0), 0)
        setCompletionPercent(percent)
      }
    }

    setLoading(false)
  }, [router, targetId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header role={viewerRole} active="" />
        <main className="flex-1 px-6 py-12 flex justify-center items-center">
          <p className="text-[var(--text-soft)]">Profile not found.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header role={viewerRole} active="" />

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="glass-card fade-rise-in max-w-md w-full px-10 py-12">
          <button onClick={() => router.back()} className="text-sm text-[var(--accent)] mb-6 hover:underline">
            ← Back
          </button>

          <div className="flex flex-col items-center mb-6">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={fullName}
                className="w-24 h-24 rounded-full object-cover border-2"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--border)] flex items-center justify-center font-display font-semibold text-3xl">
                {fullName.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <h1 className="font-display font-semibold text-2xl mt-4">{fullName}</h1>
            <span className="tag tag-approved mt-2">{targetRole === 'hod' ? 'HoD' : 'Student'}</span>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <p className="text-sm text-[var(--text-soft)]">Email</p>
              <p className="font-medium">{email}</p>
            </div>
            {phone && (
              <div>
                <p className="text-sm text-[var(--text-soft)]">Phone</p>
                <p className="font-medium">{phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-[var(--text-soft)]">Department</p>
              <p className="font-medium">{department}</p>
            </div>
          </div>

          {targetRole === 'student' && (
            <div className="rounded-xl px-4 py-4" style={{ background: 'rgba(47,111,237,0.06)', border: '1px solid var(--border)' }}>
              <p className="text-sm text-[var(--text-soft)] mb-1">Current Project</p>
              <p className="font-medium mb-2">{topicTitle || 'No topic yet'}</p>
              {topicTitle && <span className="tag tag-approved">{completionPercent}% Complete</span>}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}