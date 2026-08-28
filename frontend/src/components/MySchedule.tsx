import { useState, useEffect, useCallback, useRef } from 'react'
import type { SavedCourse } from '../hooks/useMySchedule'
import type { ScheduleProposal } from '../lib/schedule'
import { buildCalendarBlocks, detectConflicts, assignColors, getUntimedSections } from '../lib/schedule'
import { WeeklyCalendar } from './WeeklyCalendar'
import { socSearchUrl, capeUrl, rmpUrl, courseCodeToSubject } from '../lib/links'
import { downloadICS } from '../lib/icsExport'
import { TssHandoff } from './TssHandoff'
import { isWaitlistOnlySection, sectionAvailStatus } from '../lib/availability'

interface MyScheduleProps {
  schedule: SavedCourse[]
  proposal: ScheduleProposal
  term: string
  onRemove: (courseCode: string) => void
  onRemoveSection: (courseCode: string, sectionCode: string, sectionType: string) => void
  onClear: () => void
  // Term switching support — when provided, an inline term picker is shown.
  termOptions?: { value: string; label: string }[]
  onTermChange?: (term: string) => void
  allSchedules?: Record<string, SavedCourse[]>
  // Firebase uid of the signed-in user. Required for per-user GCal sync.
  uid: string
}

// Email fetched dynamically from /api/gcal/status

type GCalStatus = { configured: boolean; connected: boolean; email: string }

// Full-time / overload thresholds used by UCSD undergrad advising.
const MIN_FULL_TIME_UNITS = 12
const MAX_NORMAL_UNITS = 18  // Above this requires Dean/college approval

export function MySchedule({ schedule, proposal, term, onRemove, onRemoveSection, onClear, termOptions, onTermChange, allSchedules, uid }: MyScheduleProps) {
  const blocks = buildCalendarBlocks(proposal)
  const colors = assignColors(proposal.courses)
  const conflicts = detectConflicts(blocks)
  const untimedSections = getUntimedSections(proposal)
  const transitions = findTightTransitions(blocks)
  const [gcalStatus, setGcalStatus] = useState<GCalStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // The uid is required to scope all GCal API calls to this user.
  const uidQuery = uid ? `?uid=${encodeURIComponent(uid)}` : ''

  // Check gcal status on mount (re-runs if uid changes — e.g. after sign-in)
  useEffect(() => {
    fetch(`/api/gcal/status${uidQuery}`).then((r) => r.json()).then(setGcalStatus).catch(() => {})
  }, [uidQuery])

  // Check for OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      fetch(`/api/gcal/status${uidQuery}`).then((r) => r.json()).then((s) => {
        setGcalStatus(s)
        if (s.connected) setSyncMsg('Google Calendar connected!')
      }).catch(() => {})
    }
  }, [uidQuery])

  const handleGCalConnect = useCallback(async () => {
    try {
      const res = await fetch(`/api/gcal/auth${uidQuery}`)
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      } else if (data.error) {
        setSyncMsg(data.error)
      }
    } catch {
      setSyncMsg('Failed to start authorization')
    }
  }, [uidQuery])

  const handleGCalDisconnect = useCallback(async () => {
    if (!uid) return
    try {
      await fetch('/api/gcal/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      })
      setGcalStatus((prev) => prev ? { ...prev, connected: false } : prev)
      setSyncMsg('Disconnected from Google Calendar')
    } catch {
      setSyncMsg('Failed to disconnect')
    }
  }, [uid])

  const handleGCalSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/gcal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, courses: schedule, uid }),
      })
      const data = await res.json()
      if (data.success) {
        const parts: string[] = []
        if (data.events_created > 0) parts.push(`added ${data.events_created}`)
        if (data.events_deleted > 0) parts.push(`removed ${data.events_deleted}`)
        if (data.legacy_cleared > 0) parts.push(`cleaned ${data.legacy_cleared} legacy`)
        const change = parts.length > 0 ? parts.join(', ') : 'no changes'
        setSyncMsg(`Synced "${data.calendar}" — ${change} (${data.events_total} total)`)
      } else {
        setSyncMsg(data.error || 'Sync failed')
      }
    } catch {
      setSyncMsg('Failed to sync')
    } finally {
      setSyncing(false)
    }
  }, [term, schedule, uid])

  // Auto-sync when schedule changes (if connected).
  // We INTENTIONALLY no longer bail when schedule.length === 0 — an empty schedule
  // still needs a sync call so the server can delete the events that used to be there.
  //
  // The hash captures every (course_code, type, section letter) tuple so that swapping
  // a section (e.g. A01 → A02) actually triggers a resync. The old version only hashed
  // course_code + sections.length, which silently desynced GCal on any section swap.
  const scheduleHash = JSON.stringify(
    schedule
      .map((c) => `${c.course_code}|` + c.sections.map((s) => `${s.type}:${s.section}`).sort().join(','))
      .sort(),
  )
  const initialHashRef = useRef(scheduleHash)
  useEffect(() => {
    if (!gcalStatus?.connected) return
    // Skip the very first effect run after mount — that's the initial render, not a user change.
    if (scheduleHash === initialHashRef.current) return
    // Debounce: sync 2s after last change
    const timer = setTimeout(() => {
      handleGCalSync()
    }, 2000)
    return () => clearTimeout(timer)
  }, [scheduleHash, gcalStatus?.connected]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    const html = generateMyScheduleHtml(proposal, schedule)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-ucsd-schedule.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleGoogleCalendarICS = () => {
    downloadICS(schedule, term, gcalStatus?.email || '')
  }

  if (schedule.length === 0) {
    return (
      <div className="h-[calc(100vh-64px)] overflow-y-auto">
        <div className="max-w-5xl mx-auto px-3 sm:px-8 py-4 sm:py-8">
          {termOptions && onTermChange && (
            <TermSwitcher
              term={term}
              termOptions={termOptions}
              allSchedules={allSchedules}
              onTermChange={onTermChange}
            />
          )}
          <div className="text-center max-w-md mx-auto mt-12">
            <div className="w-16 h-16 rounded-2xl bg-green/12 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" fill="none" stroke="#3dd68c" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-text mb-2">No courses in {proposal.quarter}</h2>
            <p className="text-[14px] text-muted leading-relaxed">
              Plan courses from the <b className="text-text">Browse</b> tab using the "+ Plan" button,
              or ask the <b className="text-accent2">AI Planner</b> to build you a schedule.
            </p>
            {allSchedules && Object.entries(allSchedules).some(([t, list]) => t !== term && list.length > 0) && (
              <p className="text-[12px] text-dim mt-4">
                You have courses saved in other terms — switch above to view them.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Load warnings — overload above 18 units; under-full-time below 12 units
  const totalUnits = proposal.total_units
  const loadWarning: { tone: 'red' | 'gold'; text: string } | null =
    totalUnits >= MAX_NORMAL_UNITS + 1
      ? { tone: 'red', text: `${totalUnits} units — overload, needs college approval` }
      : totalUnits === MAX_NORMAL_UNITS
      ? { tone: 'gold', text: `${totalUnits} units — at max normal load` }
      : totalUnits > 0 && totalUnits < MIN_FULL_TIME_UNITS
      ? { tone: 'gold', text: `${totalUnits} units — below ${MIN_FULL_TIME_UNITS} unit full-time threshold` }
      : null

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Term switcher — inline so user doesn't have to leave the page */}
        {termOptions && onTermChange && (
          <TermSwitcher
            term={term}
            termOptions={termOptions}
            allSchedules={allSchedules}
            onTermChange={onTermChange}
          />
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">My Schedule</h2>
            <div className="flex gap-x-4 gap-y-1 mt-1 text-[11px] text-muted flex-wrap">
              <span className="text-accent">{proposal.quarter}</span>
              <span><b className="text-text">{totalUnits}</b> units</span>
              <span><b className="text-text">{schedule.length}</b> {schedule.length === 1 ? 'course' : 'courses'}</span>
              <span><b className="text-text">{schedule.reduce((s, c) => s + c.sections.length, 0)}</b> {schedule.reduce((s, c) => s + c.sections.length, 0) === 1 ? 'section' : 'sections'}</span>
              {conflicts.length > 0 && (
                <span className="text-red"><b>{conflicts.length}</b> conflict{conflicts.length !== 1 ? 's' : ''}</span>
              )}
              {transitions.length > 0 && (
                <span className="text-gold"><b>{transitions.length}</b> tight transition{transitions.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {loadWarning && (
              <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium ${
                loadWarning.tone === 'red'
                  ? 'bg-red/10 text-red border-red/20'
                  : 'bg-gold/10 text-gold border-gold/20'
              }`}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.732 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {loadWarning.text}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <TssHandoff term={term} schedule={schedule} />
            <div className="relative">
              <button onClick={() => setShowExportMenu((current) => !current)} className="rounded-xl border border-border bg-card px-3.5 py-2 text-[11px] font-semibold text-muted hover:border-border2 hover:text-text">
                Export & sync <span className="ml-1 text-dim">▾</span>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-[0_18px_55px_rgba(0,0,0,0.4)]">
                  {gcalStatus?.connected ? (
                    <>
                      <button onClick={() => { handleGCalSync(); setShowExportMenu(false) }} disabled={syncing} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-green hover:bg-green/10 disabled:opacity-50">{syncing ? 'Syncing…' : 'Sync Google Calendar'}</button>
                      <button onClick={() => { handleGCalDisconnect(); setShowExportMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] text-muted hover:bg-red/10 hover:text-red">Disconnect Google Calendar</button>
                    </>
                  ) : gcalStatus?.configured ? (
                    <button onClick={() => { handleGCalConnect(); setShowExportMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-green hover:bg-green/10">Connect Google Calendar</button>
                  ) : null}
                  <div className="my-1 h-px bg-border" />
                  <button onClick={() => { handleGoogleCalendarICS(); setShowExportMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] text-muted hover:bg-surface hover:text-text">Download calendar (.ics)</button>
                  <button onClick={() => { handleExport(); setShowExportMenu(false) }} className="w-full rounded-lg px-3 py-2 text-left text-[11px] text-muted hover:bg-surface hover:text-text">Export schedule report</button>
                </div>
              )}
            </div>
            <button
              onClick={() => { if (confirm(`Clear all ${schedule.length} courses from your schedule?`)) onClear() }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium
                bg-red/10 text-red border border-red/20
                hover:bg-red/20 transition-all cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Calendar */}
        <WeeklyCalendar blocks={blocks} untimedSections={untimedSections} />

        {/* Tight transition warnings */}
        {transitions.length > 0 && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
            <div className="flex items-center gap-2 mb-2 text-gold font-mono text-[11px] font-medium uppercase tracking-wide">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
              </svg>
              Tight Transitions ({transitions.length})
            </div>
            <div className="space-y-1">
              {transitions.map((t, i) => (
                <div key={i} className="text-[12px] text-text">
                  <span className="font-mono text-muted">{t.day}</span>{' '}
                  <b className="text-accent">{t.fromCode}</b>{' '}<span className="text-muted">({t.fromBuilding})</span>
                  <span className="text-dim mx-1.5">→</span>
                  <b className="text-accent">{t.toCode}</b>{' '}<span className="text-muted">({t.toBuilding})</span>
                  <span className="text-dim ml-2">·</span>{' '}
                  <span className="text-gold font-mono">{t.gapMinutes} min gap</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course cards */}
        <div className="space-y-2">
          {schedule.map((course) => {
            const color = colors.get(course.course_code)
            const subject = courseCodeToSubject(course.course_code)
            return (
              <div key={course.course_code} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="font-mono text-[12px] font-medium px-2.5 py-1 rounded-md"
                    style={{ background: color?.bg, color: color?.text, borderLeft: `3px solid ${color?.border}` }}
                  >
                    {course.course_code}
                  </span>
                  <span className="text-[13px] font-medium text-text">{course.title}</span>
                  <span className="text-[11px] text-gold">{course.units} units</span>
                  <div className="ml-auto flex items-center gap-2">
                    <a href={socSearchUrl(subject)} target="_blank" rel="noopener" className="text-[11px] text-accent hover:underline">SoC</a>
                    <a href={capeUrl(course.course_code)} target="_blank" rel="noopener" className="text-[11px] text-accent2 hover:underline">CAPEs</a>
                    <button
                      onClick={() => onRemove(course.course_code)}
                      className="text-[11px] px-2 py-1 rounded-md bg-red/10 text-red border border-red/20 hover:bg-red/20 transition-all cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="text-muted">
                      {['', 'Type', 'Section', 'Days', 'Time', 'Location', 'Instructor', 'Seats'].map((h) => (
                        <th key={h || 'rm'} className="text-[11px] uppercase text-left px-2 py-1 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                      {course.sections.map((s, i) => {
                        const availability = sectionAvailStatus(s)
                        return <tr key={i} className="border-t border-border/50">
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => onRemoveSection(course.course_code, s.section, s.type)}
                            className="text-[11px] px-1 py-0.5 rounded text-red/60 hover:text-red hover:bg-red/10 transition-all cursor-pointer"
                            title={`Remove ${s.type} ${s.section}`}
                          >
                            &times;
                          </button>
                        </td>
                        <td className="px-2 py-1.5 font-mono">{s.type}</td>
                        <td className="px-2 py-1.5 font-mono text-muted">{s.section}</td>
                        <td className="px-2 py-1.5">{s.days}</td>
                        <td className="px-2 py-1.5 font-mono">{s.time}</td>
                        <td className="px-2 py-1.5">{s.building} {s.room}</td>
                        <td className="px-2 py-1.5">
                          {s.instructor && s.instructor !== 'TBA' ? (
                            <a href={rmpUrl(s.instructor)} target="_blank" rel="noopener" className="hover:text-accent hover:underline">{s.instructor}</a>
                          ) : 'TBA'}
                        </td>
                        <td className={`px-2 py-1.5 font-mono ${availability.status === 'open' ? 'text-green' : availability.status === 'waitlist' ? 'text-gold' : 'text-red'}`}>
                          {isWaitlistOnlySection(s) ? 'Waitlist only' : `${availability.seats}/${s.limit}`}
                        </td>
                      </tr>
                      })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>

        {/* Sync status */}
        {syncMsg && (
          <div className={`text-[11px] text-center py-2 px-3 rounded-lg ${
            syncMsg.includes('Synced') || syncMsg.includes('connected') ? 'text-green bg-green/5' : 'text-red bg-red/5'
          }`}>
            {syncMsg}
          </div>
        )}

        <div className="text-[11px] text-dim text-center pb-4">
          {gcalStatus?.connected
            ? `Auto-syncing to Google Calendar (${gcalStatus?.email || 'your Google Calendar'}) · Each term gets its own calendar`
            : gcalStatus?.configured
              ? `Connect Google Calendar to auto-sync · ${gcalStatus?.email || 'your Google Calendar'}`
              : `Export .ics to import into Google Calendar · ${gcalStatus?.email || 'your Google Calendar'}`}
        </div>
      </div>
    </div>
  )
}

// ── TermSwitcher ──
//
// Renders a compact row of term chips at the top of My Schedule. The current term is highlighted;
// any term that already has saved courses gets a small dot so users can find them at a glance.
function TermSwitcher({
  term,
  termOptions,
  allSchedules,
  onTermChange,
}: {
  term: string
  termOptions: { value: string; label: string }[]
  allSchedules?: Record<string, SavedCourse[]>
  onTermChange: (term: string) => void
}) {
  const savedCount = allSchedules?.[term]?.length ?? 0
  return (
    <div className="-mt-1 flex items-center gap-2">
      <label htmlFor="schedule-term" className="text-[10px] font-bold uppercase tracking-wider text-dim">Term</label>
      <select id="schedule-term" value={term} onChange={(event) => onTermChange(event.target.value)} className="h-9 rounded-xl border border-border bg-card px-3 text-[11px] font-semibold text-text outline-none hover:border-border2 focus:border-accent">
        {termOptions.map((option) => {
          const count = allSchedules?.[option.value]?.length ?? 0
          return <option key={option.value} value={option.value}>{option.label}{count > 0 ? ` · ${count} saved` : ''}</option>
        })}
      </select>
      {savedCount > 0 && <span className="rounded-full bg-accent/12 px-2 py-1 text-[9px] font-bold text-accent">{savedCount} planned</span>}
    </div>
  )
}

// ── Transition detection ──
//
// Finds pairs of calendar blocks on the same day where the gap between end-of-one and
// start-of-the-next is less than 15 minutes AND the buildings differ. UCSD's campus is large enough
// that ferrying between Warren and Revelle in 10 minutes is realistic only if you sprint.
interface TightTransition {
  day: string
  fromCode: string
  fromBuilding: string
  toCode: string
  toBuilding: string
  gapMinutes: number
}

function findTightTransitions(blocks: import('../lib/schedule').CalendarBlock[]): TightTransition[] {
  const result: TightTransition[] = []
  // Group by day
  const byDay = new Map<string, typeof blocks>()
  for (const b of blocks) {
    if (!byDay.has(b.day)) byDay.set(b.day, [])
    byDay.get(b.day)!.push(b)
  }
  for (const [day, dayBlocks] of byDay) {
    const sorted = [...dayBlocks].sort((a, b) => a.startHour - b.startHour)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const gapHours = b.startHour - a.endHour
      if (gapHours < 0) continue // overlap (already shown as a conflict)
      const gapMinutes = Math.round(gapHours * 60)
      if (gapMinutes >= 15) continue
      const fromBuilding = (a.building || '').trim()
      const toBuilding = (b.building || '').trim()
      if (!fromBuilding || !toBuilding || fromBuilding === toBuilding) continue
      // Skip TBA placeholders
      if (fromBuilding === 'TBA' || toBuilding === 'TBA') continue
      result.push({
        day,
        fromCode: a.courseCode,
        fromBuilding,
        toCode: b.courseCode,
        toBuilding,
        gapMinutes,
      })
    }
  }
  return result
}

function generateMyScheduleHtml(proposal: ScheduleProposal, schedule: SavedCourse[]): string {
  const colors = assignColors(proposal.courses)
  const rows = schedule.map((c) => {
    const color = colors.get(c.course_code)
    const secs = c.sections.map((s) => {
      const availability = sectionAvailStatus(s)
      const color = availability.status === 'open' ? '#3dd68c' : availability.status === 'waitlist' ? '#f5c842' : '#f25f5c'
      const label = isWaitlistOnlySection(s) ? 'Waitlist only' : `${availability.seats}/${s.limit}`
      return `<tr><td>${s.type}</td><td>${s.section}</td><td>${s.days}</td><td>${s.time}</td><td>${s.building} ${s.room}</td><td>${s.instructor}</td><td style="color:${color}">${label}</td></tr>`
    }).join('')
    return `<div class="course"><div class="course-header"><span class="badge" style="background:${color?.bg};color:${color?.text};border-left:3px solid ${color?.border}">${c.course_code}</span><span class="title">${c.title}</span><span class="units">${c.units} units</span></div><table><thead><tr><th>Type</th><th>Section</th><th>Days</th><th>Time</th><th>Location</th><th>Instructor</th><th>Seats</th></tr></thead><tbody>${secs}</tbody></table></div>`
  }).join('\n')

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>My UCSD Schedule - ${proposal.quarter}</title><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0c10;color:#e8ecf4;font-family:'Instrument Sans',sans-serif;padding:2rem;max-width:900px;margin:0 auto}h1{font-family:'DM Mono',monospace;font-size:18px;color:#3dd68c;margin-bottom:4px}.stats{display:flex;gap:1.5rem;font-family:'DM Mono',monospace;font-size:11px;color:#7a82a0;margin-bottom:1.5rem}.stats b{color:#e8ecf4}.course{background:#181c26;border:1px solid #252a38;border-radius:10px;margin-bottom:12px;overflow:hidden}.course-header{padding:12px 14px;display:flex;align-items:center;gap:10px}.badge{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;padding:3px 8px;border-radius:5px}.title{font-size:13px;font-weight:500}.units{font-family:'DM Mono',monospace;font-size:10px;color:#f5c842}table{width:100%;border-collapse:collapse;font-size:11px}th{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;color:#7a82a0;text-align:left;padding:6px 10px;background:#12151c;font-weight:500}td{padding:6px 10px;border-top:1px solid #252a38;font-family:'DM Mono',monospace}.footer{margin-top:2rem;font-family:'DM Mono',monospace;font-size:10px;color:#3d4460;text-align:center}</style></head><body><h1>My UCSD Schedule — ${proposal.quarter}</h1><div class="stats"><span><b>${proposal.total_units}</b> units</span><span><b>${schedule.length}</b> courses</span></div>${rows}<div class="footer">Generated by Trittton &middot; ${new Date().toLocaleDateString()}</div></body></html>`
}
