// Replace the ENTIRE contents of app/submission/page.tsx with this.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { notifyHods } from '@/lib/notifications'

const MAX_FILE_SIZE = 10 * 1024 * 1024

type PastSubmission = {
  id: string
  type: string
  file_url: string | null
  github_url: string | null
  submitted_at: string
  feedback: string | null
  is_late: boolean
}

export default function SubmissionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [hasTopic, setHasTopic] = useState(false)
  const [pastSubmissions, setPastSubmissions] = useState<PastSubmission[]>([])
  const [deadline, setDeadline] = useState<string | null>(null)

  const [synopsisFile, setSynopsisFile] = useState<File | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [deployedUrl, setDeployedUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [message, setMessage] = useState('')
  const [submittingSynopsis, setSubmittingSynopsis] = useState(false)
  const [submittingFinal, setSubmittingFinal] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, groups(name)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      setLoading(false)
      return
    }
    setGroupId(membership.group_id)
    setGroupName((membership.groups as unknown as { name: string })?.name || '')

    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('locked_group_id', membership.group_id)
      .eq('status', 'locked')
      .maybeSingle()
    setHasTopic(!!topic)

    const { data: settings } = await supabase
      .from('settings')
      .select('project_deadline')
      .eq('is_active', true)
      .single()
    setDeadline(settings?.project_deadline || null)

    const { data: subs } = await supabase
      .from('submissions')
      .select('id, type, file_url, github_url, submitted_at, feedback, is_late')
      .eq('group_id', membership.group_id)
      .order('submitted_at', { ascending: false })
    setPastSubmissions(subs || [])

    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const isPastDeadline = deadline ? new Date() > new Date(deadline) : false

  async function markMilestoneComplete(milestoneName: string, submissionId: string) {
    if (!groupId) return
    await supabase
      .from('group_progress')
      .update({ completed: true, completed_at: new Date().toISOString(), submission_id: submissionId })
      .eq('group_id', groupId)
      .eq('milestone_name', milestoneName)
  }

  async function submitSynopsis(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId || !synopsisFile) return

    if (synopsisFile.size > MAX_FILE_SIZE) {
      setMessage('File is too large — max 10MB.')
      return
    }
    if (synopsisFile.type !== 'application/pdf') {
      setMessage('Please upload a PDF file.')
      return
    }

    setMessage('')
    setSubmittingSynopsis(true)

    const path = `${groupId}/${Date.now()}-${synopsisFile.name}`
    const { error: uploadError } = await supabase.storage.from('synopsis').upload(path, synopsisFile)

    if (uploadError) {
      setSubmittingSynopsis(false)
      setMessage(uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from('synopsis').getPublicUrl(path)

    const { data, error } = await supabase
      .from('submissions')
      .insert({ group_id: groupId, type: 'synopsis', file_url: urlData.publicUrl, is_late: isPastDeadline })
      .select()
      .single()

    setSubmittingSynopsis(false)

    if (error || !data) {
      setMessage(error?.message || 'Something went wrong.')
      return
    }

    await markMilestoneComplete('Synopsis', data.id)
    await notifyHods('submission_received', `${groupName} submitted their synopsis`, data.id)
    setMessage(isPastDeadline ? 'Synopsis uploaded — marked late.' : 'Synopsis uploaded.')
    setSynopsisFile(null)
    load()
  }

  async function submitFinal(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId) return
    setMessage('')
    setSubmittingFinal(true)

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        group_id: groupId,
        type: 'final',
        github_url: githubUrl,
        deployed_url: deployedUrl,
        demo_video_url: videoUrl || null,
        is_late: isPastDeadline,
      })
      .select()
      .single()

    setSubmittingFinal(false)

    if (error || !data) {
      setMessage(error?.message || 'Something went wrong.')
      return
    }

    await markMilestoneComplete('Final Submission', data.id)
    await notifyHods('submission_received', `${groupName} submitted their final project`, data.id)
    setMessage(isPastDeadline ? 'Final project submitted — marked late.' : 'Final project submitted.')
    setGithubUrl('')
    setDeployedUrl('')
    setVideoUrl('')
    load()
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
      <Header role="student" active="/submission" />

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="w-full max-w-xl space-y-8">
          {!groupId ? (
            <div className="glass-card fade-rise-in px-8 py-10 text-center">
              <p className="text-[var(--text-soft)]">You need to be in a group first — head to My Team.</p>
            </div>
          ) : !hasTopic ? (
            <div className="glass-card fade-rise-in px-8 py-10 text-center">
              <p className="text-[var(--text-soft)]">
                Submissions open once your topic is approved and locked.
              </p>
            </div>
          ) : (
            <>
              {isPastDeadline && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                  The project deadline ({new Date(deadline!).toLocaleDateString()}) has passed.
                  You can still submit, but it will be marked late.
                </div>
              )}

              {message && <p className="text-[var(--accent)] text-sm">{message}</p>}

              {pastSubmissions.some((s) => s.feedback) && (
                <div className="glass-card fade-rise-in px-8 py-8">
                  <h2 className="font-display font-semibold text-lg mb-4">Feedback</h2>
                  <div className="space-y-4">
                    {pastSubmissions.filter((s) => s.feedback).map((s) => (
                      <div key={s.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-mono text-[var(--text-soft)] uppercase">
                            {s.type === 'synopsis' ? 'Synopsis' : 'Final Project'}
                          </p>
                          {s.is_late && <span className="tag tag-rejected">Late</span>}
                        </div>
                        <p className="text-sm">{s.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={submitSynopsis} className="glass-card fade-rise-in px-8 py-10">
                <h1 className="font-display font-semibold text-xl mb-4">Synopsis</h1>
                <label className="block text-sm mb-1 text-[var(--text-soft)]">
                  Upload PDF (max 10MB)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSynopsisFile(e.target.files?.[0] || null)}
                  required
                  className="input-field mb-4"
                />
                <button type="submit" disabled={submittingSynopsis} className="btn-primary w-full">
                  {submittingSynopsis ? 'Uploading…' : 'Submit Synopsis'}
                </button>
              </form>

              <form onSubmit={submitFinal} className="glass-card fade-rise-in px-8 py-10">
                <h1 className="font-display font-semibold text-xl mb-4">Final Project</h1>
                <label className="block text-sm mb-1 text-[var(--text-soft)]">GitHub repository</label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  required
                  placeholder="https://github.com/..."
                  className="input-field mb-4"
                />
                <label className="block text-sm mb-1 text-[var(--text-soft)]">Deployed app URL</label>
                <input
                  type="url"
                  value={deployedUrl}
                  onChange={(e) => setDeployedUrl(e.target.value)}
                  required
                  placeholder="https://your-app.vercel.app"
                  className="input-field mb-4"
                />
                <label className="block text-sm mb-1 text-[var(--text-soft)]">Demo video link (optional)</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/... or Drive link"
                  className="input-field mb-6"
                />
                <button type="submit" disabled={submittingFinal} className="btn-primary w-full">
                  {submittingFinal ? 'Submitting…' : 'Submit Final Project'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}