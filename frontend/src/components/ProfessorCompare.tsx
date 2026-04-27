import { useState, useEffect } from 'react'
import type { Section } from '../types'
import { capeInstructorUrl } from '../lib/links'

interface RmpData {
  name: string
  rating: number
  difficulty: number
  wouldTakeAgain: number
  numRatings: number
  rmpUrl: string
}

interface ProfessorCompareProps {
  courseCode: string
  sections: Section[]
  onClose: () => void
}

export function ProfessorCompare({ courseCode, sections, onClose }: ProfessorCompareProps) {
  const [ratings, setRatings] = useState<Record<string, RmpData | null>>({})
  const [loading, setLoading] = useState(true)

  // Get unique instructors from sections
  const instructors = [...new Set(
    sections
      .map(s => s.instructor)
      .filter(name => name && name !== 'TBA' && name !== 'Staff')
  )]

  useEffect(() => {
    if (instructors.length === 0) { setLoading(false); return }

    fetch('/api/rmp/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructors }),
    })
      .then(r => r.json())
      .then(data => setRatings(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (instructors.length < 2) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <p className="text-muted">This course only has one instructor. Nothing to compare.</p>
          <button onClick={onClose} className="mt-4 px-5 py-2 rounded-xl bg-accent text-white font-semibold cursor-pointer">Close</button>
        </div>
      </div>
    )
  }

  // Get section details per instructor
  const instructorSections = (name: string) =>
    sections.filter(s => s.instructor === name)

  const ratingColor = (val: number, high: boolean = true) => {
    if (high) return val >= 4 ? 'text-green' : val >= 3 ? 'text-gold' : 'text-red'
    return val <= 2.5 ? 'text-green' : val <= 3.5 ? 'text-gold' : 'text-red'
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header with prominent back button */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center gap-4 rounded-t-2xl z-10">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-sm font-semibold text-text hover:bg-card hover:border-border2 cursor-pointer transition-all shrink-0"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Course
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-text">Compare Professors</h2>
            <p className="text-sm text-muted mt-0.5">{courseCode} &middot; {instructors.length} professors</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-dim hover:text-text hover:bg-surface cursor-pointer" title="Close">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-6">
            <div className={`grid gap-4 ${instructors.length === 2 ? 'grid-cols-2' : instructors.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {instructors.map(name => {
                const rmp = ratings[name]
                const secs = instructorSections(name)
                const totalSeats = secs.reduce((s, sec) => s + (parseInt(sec.available) || 0), 0)
                const totalLimit = secs.reduce((s, sec) => s + (parseInt(sec.limit) || 0), 0)

                return (
                  <div key={name} className="bg-surface/50 border border-border rounded-2xl p-5 space-y-4">
                    {/* Name + links */}
                    <div>
                      <h3 className="text-base font-bold text-text">{name}</h3>
                      <div className="flex gap-2 mt-1.5">
                        {rmp?.rmpUrl && (
                          <a href={rmp.rmpUrl} target="_blank" rel="noopener"
                            className="text-xs px-2 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20">
                            RateMyProfessor
                          </a>
                        )}
                        <a href={capeInstructorUrl(name)} target="_blank" rel="noopener"
                          className="text-xs px-2 py-1 rounded-lg bg-accent2/10 text-accent2 hover:bg-accent2/20">
                          CAPEs
                        </a>
                      </div>
                    </div>

                    {/* Rating cards */}
                    {rmp ? (
                      <div className="grid grid-cols-2 gap-2">
                        <StatCard label="Rating" value={rmp.rating.toFixed(1)} sub="/5.0" colorClass={ratingColor(rmp.rating)} />
                        <StatCard label="Difficulty" value={rmp.difficulty.toFixed(1)} sub="/5.0" colorClass={ratingColor(rmp.difficulty, false)} />
                        <StatCard label="Would Retake" value={`${Math.round(rmp.wouldTakeAgain)}%`} sub="" colorClass={rmp.wouldTakeAgain >= 70 ? 'text-green' : rmp.wouldTakeAgain >= 40 ? 'text-gold' : 'text-red'} />
                        <StatCard label="Reviews" value={String(rmp.numRatings)} sub="" colorClass="text-muted" />
                      </div>
                    ) : (
                      <div className="text-sm text-dim text-center py-4 bg-surface rounded-xl">
                        No RMP data available
                      </div>
                    )}

                    {/* Star visualization */}
                    {rmp && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} width="18" height="18" viewBox="0 0 20 20" fill={star <= Math.round(rmp.rating) ? '#f5c842' : '#3d4460'}>
                            <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.69l5.34-.78L10 1z" />
                          </svg>
                        ))}
                      </div>
                    )}

                    {/* Sections taught */}
                    <div>
                      <div className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Sections</div>
                      <div className="space-y-1">
                        {secs.map((sec, i) => {
                          const avail = parseInt(sec.available) || 0
                          return (
                            <div key={i} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-card">
                              <span className="text-text">{sec.type} {sec.section}</span>
                              <span className="text-muted">{sec.days} {sec.time}</span>
                              <span className={avail > 0 ? 'text-green font-bold' : 'text-red'}>{avail > 0 ? `${avail} open` : 'full'}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Seat summary */}
                    <div className="text-xs text-muted">
                      {totalSeats}/{totalLimit} seats available across {secs.length} section{secs.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, colorClass }: { label: string; value: string; sub: string; colorClass: string }) {
  return (
    <div className="bg-card rounded-xl p-3 text-center">
      <div className="text-[11px] text-muted mb-1">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>
        {value}<span className="text-xs text-dim">{sub}</span>
      </div>
    </div>
  )
}
