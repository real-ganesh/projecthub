// Replace the ENTIRE contents of app/project/page.tsx with this.
// (Same logic as before — added a full celebration state at 100%:
// confetti, a "Congratulations" message, and a glowing progress bar.)

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/app/components/Header'

type Milestone = { id: string; milestone_name: string; weight_percent: number; completed: boolean }

const AUTO_MILESTONES = ['Synopsis', 'Final Submission']
const CONFETTI_COLORS = ['#2f6fed', '#ff6b35', '#16a34a', '#5b8def', '#ffb347']

function getEncouragement(percent: number) {
  if (percent >= 75 && percent < 100) return { emoji: '🚀', message: 'Almost there — just one milestone left.' }
  if (percent >= 50) return { emoji: '💪', message: 'Halfway there — keep the momentum going.' }
  if (percent >= 25) return { emoji: '🌱', message: 'Good start — one milestone down.' }
  return { emoji: '👋', message: "Let's get started on your first milestone." }
}

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${Math.random() * 0.6}s`,
  }))
  return (
    <div className="absolute inset-x-0 top-0 h-40 overflow-hidden pointer-events-none">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: p.left, background: p.color, animationDelay: p.delay }}
        />
      ))}
    </div>
  )
}

export default function ProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [topicTitle, setTopicTitle] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      setLoading(false)
      return
    }
    setGroupId(membership.group_id)

    const { data: topic } = await supabase
      .from('topics')
      .select('title')
      .eq('locked_group_id', membership.group_id)
      .eq('status', 'locked')
      .maybeSingle()
    setTopicTitle(topic?.title || null)

    const { data: progress } = await supabase
      .from('group_progress')
      .select('id, milestone_name, weight_percent, completed')
      .eq('group_id', membership.group_id)

    setMilestones(progress || [])
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function toggleMilestone(m: Milestone) {
    if (AUTO_MILESTONES.includes(m.milestone_name)) return
    await supabase
      .from('group_progress')
      .update({ completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : null })
      .eq('id', m.id)
    load()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-soft)]">Loading…</p>
      </div>
    )
  }

  const totalPercent = milestones.reduce((sum, m) => sum + (m.completed ? m.weight_percent : 0), 0)
  const isComplete = totalPercent === 100
  const encouragement = getEncouragement(totalPercent)

  return (
    <div className="min-h-screen flex flex-col">
      <Header role="student" active="/project" />

      <main className="flex-1 px-6 py-12 flex justify-center">
        <div className="w-full max-w-xl">
          {!groupId ? (
            <div className="glass-card fade-rise-in px-8 py-10 text-center">
              <p className="text-[var(--text-soft)]">You need to be in a group first — head to My Team.</p>
            </div>
          ) : !topicTitle ? (
            <div className="glass-card fade-rise-in px-8 py-10 text-center">
              <p className="text-[var(--text-soft)]">
                No approved topic yet — progress tracking starts once your topic is locked.
              </p>
            </div>
          ) : (
            <div className="glass-card fade-rise-in px-8 py-10 relative overflow-hidden">
              {isComplete && <Confetti />}

              {isComplete ? (
                <div className="text-center mb-8">
                  <div className="text-5xl mb-3">🎉</div>
                  <h1 className="font-display font-semibold text-3xl mb-2">
                    Congratulations!
                  </h1>
                  <p className="text-[var(--text-soft)]">
                    You&apos;ve completed <span className="font-medium text-[var(--text)]">{topicTitle}</span> —
                    your final year project is done. Well earned.
                  </p>
                </div>
              ) : (
                <>
                  <h1 className="font-display font-semibold text-2xl mb-1">{topicTitle}</h1>
                  <p className="text-sm text-[var(--text-soft)] font-mono mb-4">{totalPercent}% COMPLETE</p>
                </>
              )}

              <div className={`w-full h-3 rounded-full bg-[var(--border)] overflow-hidden mb-4 ${isComplete ? 'progress-complete' : ''}`}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${totalPercent}%`,
                    background: isComplete
                      ? 'linear-gradient(90deg, var(--accent), var(--accent-2), var(--success))'
                      : 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>

              {isComplete && (
                <p className="text-center text-sm font-mono text-[var(--accent-2)] mb-8">100% COMPLETE</p>
              )}

              {!isComplete && (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-3 mb-8 text-sm"
                  style={{ background: 'rgba(47,111,237,0.06)', border: '1px solid var(--border)' }}
                >
                  <span className="text-lg">{encouragement.emoji}</span>
                  <span className="text-[var(--text-soft)]">{encouragement.message}</span>
                </div>
              )}

              <ul className="space-y-3">
                {milestones.map((m) => {
                  const auto = AUTO_MILESTONES.includes(m.milestone_name)
                  return (
                    <li key={m.id} className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <div>
                        <span className={m.completed ? 'line-through text-[var(--text-soft)]' : ''}>
                          {m.milestone_name}
                        </span>
                        <span className="text-xs text-[var(--text-soft)] font-mono ml-2">
                          {m.weight_percent}%
                        </span>
                      </div>
                      {auto ? (
                        <span className={`tag ${m.completed ? 'tag-approved' : 'tag-pending'}`}>
                          {m.completed ? 'Submitted' : 'Awaiting Submission'}
                        </span>
                      ) : (
                        <button
                          onClick={() => toggleMilestone(m)}
                          className={m.completed ? 'btn-secondary text-sm py-1 px-3' : 'btn-primary text-sm py-1 px-3'}
                        >
                          {m.completed ? 'Undo' : 'Mark Done'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}