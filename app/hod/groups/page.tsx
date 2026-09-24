// Replace the ENTIRE contents of app/hod/groups/page.tsx with this.

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'
import { notifyGroupMembers } from '@/lib/notifications'

type GroupRow = {
  id: string
  name: string
  department: string
  roster_frozen: boolean
  leaderName: string
  members: string[]
  topicTitle: string | null
  progressPercent: number
}

type Submission = {
  id: string
  group_id: string
  type: string
  file_url: string | null
  github_url: string | null
  deployed_url: string | null
  demo_video_url: string | null
  feedback: string | null
  submitted_at: string
  is_late: boolean
}

export default function HodGroups() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isHod, setIsHod] = useState(false)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'hod') {
      router.push('/home')
      return
    }
    setIsHod(true)

    const [{ data: allGroups }, { data: allMembers }, { data: lockedTopics }, { data: allProgress }] =
      await Promise.all([
        supabase.from('groups').select('id, name, department, leader_id, roster_frozen'),
        supabase.from('group_members').select('group_id, student_id, profiles(full_name)').eq('status', 'active'),
        supabase.from('topics').select('title, locked_group_id').eq('status', 'locked'),
        supabase.from('group_progress').select('group_id, weight_percent, completed'),
      ])

    const rows: GroupRow[] = (allGroups || []).map((g) => {
      const members = (allMembers || []).filter((m) => m.group_id === g.id)
      const leader = members.find((m) => m.student_id === g.leader_id)
      const topic = (lockedTopics || []).find((t) => t.locked_group_id === g.id)
      const progressRows = (allProgress || []).filter((p) => p.group_id === g.id)
      const percent = progressRows.reduce((sum, p) => sum + (p.completed ? p.weight_percent : 0), 0)

      return {
        id: g.id,
        name: g.name,
        department: g.department,
        roster_frozen: g.roster_frozen,
        leaderName: (leader?.profiles as unknown as { full_name: string })?.full_name || 'Unknown',
        members: members.map((m) => (m.profiles as unknown as { full_name: string })?.full_name || 'Unknown'),
        topicTitle: topic?.title || null,
        progressPercent: percent,
      }
    })

    setGroups(rows)
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function loadSubmissions(groupId: string) {
    const { data } = await supabase
      .from('submissions')
      .select('id, group_id, type, file_url, github_url, deployed_url, demo_video_url, feedback, submitted_at, is_late')
      .eq('group_id', groupId)
      .order('submitted_at', { ascending: false })
    setSubmissions(data || [])
    const drafts: Record<string, string> = {}
    ;(data || []).forEach((s) => { drafts[s.id] = s.feedback || '' })
    setFeedbackDrafts(drafts)
  }

  function toggleExpand(groupId: string) {
    if (expanded === groupId) {
      setExpanded(null)
      setSubmissions([])
    } else {
      setExpanded(groupId)
      loadSubmissions(groupId)
    }
  }

  async function saveFeedback(submission: Submission) {
    setSavingId(submission.id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('submissions')
      .update({ feedback: feedbackDrafts[submission.id], feedback_by: user?.id })
      .eq('id', submission.id)

    await notifyGroupMembers(
      submission.group_id,
      'feedback_received',
      `New feedback on your ${submission.type === 'synopsis' ? 'synopsis' : 'final project'} submission`,
      submission.id
    )

    setSavingId(null)
  }

  if (loading || !isHod) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header role="hod" active="/hod/groups" />

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display font-semibold text-3xl mb-8">Groups</h1>

          {groups.length === 0 && <p className="text-[var(--text-soft)]">No groups formed yet.</p>}

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="glass-card fade-rise-in px-6 py-5">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(g.id)}
                >
                  <div>
                    <div className="font-display font-semibold text-lg">{g.name}</div>
                    <div className="text-xs text-[var(--text-soft)] font-mono">
                      {g.department} · Leader: {g.leaderName} · {g.members.length} members
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {g.topicTitle ? (
                      <span className="tag tag-locked">{g.topicTitle}</span>
                    ) : (
                      <span className="tag tag-pending">No Topic Yet</span>
                    )}
                    <span className="text-sm font-mono text-[var(--accent)]">{g.progressPercent}%</span>
                  </div>
                </div>

                {expanded === g.id && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-6">
                    <div>
                      <p className="text-sm text-[var(--text-soft)] mb-2">
                        Roster: {g.roster_frozen ? 'Frozen (topic locked)' : 'Open'}
                      </p>
                      <ul className="text-sm space-y-1">
                        {g.members.map((m, i) => (
                          <li key={i}>{m}{m === g.leaderName ? ' (Leader)' : ''}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-medium text-sm mb-3">Submissions</h3>
                      {submissions.length === 0 && (
                        <p className="text-sm text-[var(--text-soft)]">No submissions yet.</p>
                      )}
                      <div className="space-y-4">
                        {submissions.map((s) => (
                          <div key={s.id} className="rounded-xl px-4 py-4" style={{ background: 'rgba(30,64,120,0.03)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="tag tag-approved">
                                  {s.type === 'synopsis' ? 'Synopsis' : 'Final Project'}
                                </span>
                                {s.is_late && <span className="tag tag-rejected">Late</span>}
                              </div>
                              <span className="text-xs text-[var(--text-soft)] font-mono">
                                {new Date(s.submitted_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm space-y-1 mb-3">
                              {s.file_url && <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline block">View Synopsis PDF</a>}
                              {s.github_url && <a href={s.github_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline block">GitHub Repository</a>}
                              {s.deployed_url && <a href={s.deployed_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline block">Deployed App</a>}
                              {s.demo_video_url && <a href={s.demo_video_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline block">Demo Video</a>}
                            </div>
                            <textarea
                              value={feedbackDrafts[s.id] || ''}
                              onChange={(e) => setFeedbackDrafts({ ...feedbackDrafts, [s.id]: e.target.value })}
                              placeholder="Leave feedback for the group…"
                              rows={2}
                              className="input-field mb-2 text-sm"
                            />
                            <button
                              onClick={() => saveFeedback(s)}
                              disabled={savingId === s.id}
                              className="btn-secondary text-sm py-1 px-3"
                            >
                              {savingId === s.id ? 'Saving…' : 'Save Feedback'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}