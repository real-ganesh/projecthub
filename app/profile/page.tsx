// Replace the ENTIRE contents of app/profile/page.tsx with this.
// (Same as before — added an "Enable Notifications" button that
// triggers the real push subscription flow.)

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { subscribeToPush } from '@/lib/pushSubscribe'

const MAX_PHOTO_SIZE = 2 * 1024 * 1024

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<'student' | 'hod'>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [topicTitle, setTopicTitle] = useState<string | null>(null)
  const [completionPercent, setCompletionPercent] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [message, setMessage] = useState('')
  const [pushStatus, setPushStatus] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone, department, role, photo_url')
      .eq('id', user.id)
      .single()

    if (profile) {
      setFullName(profile.full_name || '')
      setEmail(profile.email || '')
      setPhone(profile.phone || '')
      setDepartment(profile.department || '')
      setRole(profile.role)
      setPhotoUrl(profile.photo_url || null)
    }

    if (profile?.role === 'student') {
      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', user.id)
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
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handleEnableNotifications() {
    if (!userId) return
    setPushStatus('Requesting permission…')
    const result = await subscribeToPush(userId)
    setPushStatus(result.error || 'Push notifications enabled on this device.')
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    if (file.size > MAX_PHOTO_SIZE) {
      setMessage('Photo is too large — max 2MB.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Please upload a JPG, PNG, or WebP image.')
      return
    }

    setUploadingPhoto(true)
    setMessage('')

    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })

    if (uploadError) {
      setUploadingPhoto(false)
      setMessage(uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase.from('profiles').update({ photo_url: freshUrl }).eq('id', userId)

    setUploadingPhoto(false)

    if (updateError) {
      setMessage(updateError.message)
      return
    }

    setPhotoUrl(freshUrl)
    setMessage('Photo updated.')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', userId)

    setSaving(false)
    setMessage(error ? error.message : 'Profile updated.')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header role={role} active="/profile" />

      <main className="flex-1 px-6 py-12 flex justify-center">
        <form onSubmit={handleSave} className="glass-card fade-rise-in max-w-md w-full px-10 py-12">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2"
                  style={{ borderColor: 'var(--border-strong)' }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[var(--border)] flex items-center justify-center font-display font-semibold text-3xl">
                  {fullName.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <label className="mt-3 text-sm text-[var(--accent)] cursor-pointer hover:underline">
              {uploadingPhoto ? 'Uploading…' : photoUrl ? 'Change photo' : 'Add a photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
          </div>

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field mb-4" />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Email</label>
          <input type="email" value={email} disabled className="input-field mb-4 opacity-60" />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Add a phone number"
            className="input-field mb-4"
          />

          <label className="block text-sm mb-1 text-[var(--text-soft)]">Department</label>
          <input type="text" value={department} disabled className="input-field mb-6 opacity-60" />

          {role === 'student' && (
            <div className="rounded-xl px-4 py-4 mb-6" style={{ background: 'rgba(47,111,237,0.06)', border: '1px solid var(--border)' }}>
              <p className="text-sm text-[var(--text-soft)] mb-1">Current Project</p>
              <p className="font-medium mb-2">{topicTitle || 'No topic yet'}</p>
              {topicTitle && <span className="tag tag-approved">{completionPercent}% Complete</span>}
            </div>
          )}

          <div className="rounded-xl px-4 py-4 mb-6" style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-medium mb-2">Push Notifications</p>
            <p className="text-xs text-[var(--text-soft)] mb-3">
              Get real notifications on this device — not just email. On iPhone, add ProjectHub to your
              home screen first (Share → Add to Home Screen) for this to work.
            </p>
            <button type="button" onClick={handleEnableNotifications} className="btn-secondary text-sm w-full">
              Enable Notifications on This Device
            </button>
            {pushStatus && <p className="text-xs text-[var(--accent)] mt-2">{pushStatus}</p>}
          </div>

          {message && <p className="text-[var(--accent)] text-sm mb-4">{message}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full mb-3">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={handleLogout} className="btn-secondary w-full">
            Log Out
          </button>
        </form>
      </main>
    </div>
  )
}