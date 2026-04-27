import { useState, useEffect, useCallback } from 'react'
import type { SavedCourse } from '../hooks/useMySchedule'
import type { ScheduleProposal } from '../lib/schedule'
import { buildCalendarBlocks, detectConflicts, assignColors } from '../lib/schedule'
import { WeeklyCalendar } from './WeeklyCalendar'
import { socSearchUrl, capeUrl, rmpUrl, courseCodeToSubject } from '../lib/links'
import { downloadICS } from '../lib/icsExport'

interface MyScheduleProps {
  schedule: SavedCourse[]
  proposal: ScheduleProposal
  term: string
  onRemove: (courseCode: string) => void
  onRemoveSection: (courseCode: string, sectionCode: string, sectionType: string) => void
  onClear: () => void
}

const GCAL_EMAIL = 'joshhatzer@gmail.com'

type GCalStatus = { configured: boolean; connected: boolean; email: string }

export function MySchedule({ schedule, proposal, term, onRemove, onRemoveSection, onClear }: MyScheduleProps) {
  const blocks = buildCalendarBlocks(proposal)
  const colors = assignColors(proposal.courses)
  const conflicts = detectConflicts(blocks)
  const [gcalStatus, setGcalStatus] = useState<GCalStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Check gcal status on mount
  useEffect(() => {
    fetch('/api/gcal/status').then((r) => r.json()).then(setGcalStatus).catch(() => {})
  }, [])

  // Check for OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      fetch('/api/gcal/status').then((r) => r.json()).then((s) => {
        setGcalStatus(s)
        if (s.connected) setSyncMsg('Google Calendar connected!')
      }).catch(() => {})
    }
  }, [])

  const handleGCalConnect = useCallback(async () => {
    try {
      const res = await fetch('/api/gcal/auth')
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      } else if (data.error) {
        setSyncMsg(data.error)
      }
    } catch {
      setSyncMsg('Failed to start authorization')
    }
  }, [])

  const handleGCalSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/gcal/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, courses: schedule }),
      })
      const data = await res.json()
      if (data.success) {
        setSyncMsg(`Synced ${data.events_created} events to "${data.calendar}"`)
      } else {
        setSyncMsg(data.error || 'Sync failed')
      }
    } catch {
      setSyncMsg('Failed to sync')
    } finally {
      setSyncing(false)
    }
  }, [term, schedule])

  // Auto-sync when schedule changes (if connected)
  const scheduleHash = JSON.stringify(schedule.map((c) => c.course_code + c.sections.length))
  useEffect(() => {
    if (!gcalStatus?.connected || schedule.length === 0) return
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
    downloadICS(schedule, term, GCAL_EMAIL)
  }

  if (schedule.length === 0) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-green/12 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" fill="none" stroke="#3dd68c" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-text mb-2">My Schedule is Empty</h2>
          <p className="text-[13px] text-muted leading-relaxed mb-1">
            <b className="text-text">{proposal.quarter}</b>
          </p>
          <p className="text-[14px] text-muted leading-relaxed">
            Add courses from the <b className="text-text">Browse</b> tab using the "+ Add" button,
            or ask the <b className="text-accent2">AI Planner</b> to build you a schedule.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">My Schedule</h2>
            <div className="flex gap-4 mt-1 text-[11px] text-muted">
              <span className="text-accent">{proposal.quarter}</span>
              <span><b className="text-text">{proposal.total_units}</b> units</span>
              <span><b className="text-text">{schedule.length}</b> {schedule.length === 1 ? 'course' : 'courses'}</span>
              <span><b className="text-text">{schedule.reduce((s, c) => s + c.sections.length, 0)}</b> {schedule.reduce((s, c) => s + c.sections.length, 0) === 1 ? 'section' : 'sections'}</span>
              {conflicts.length > 0 && (
                <span className="text-red"><b>{conflicts.length}</b> conflict{conflicts.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {/* Google Calendar sync */}
            {gcalStatus?.connected ? (
              <button
                onClick={handleGCalSync}
                disabled={syncing}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium
                  bg-green/10 text-green border border-green/20
                  hover:bg-green/20 transition-all cursor-pointer flex items-center gap-1.5
                  disabled:opacity-50"
                title={`Sync to Google Calendar (${GCAL_EMAIL})`}
              >
                {syncing ? (
                  <span className="w-3 h-3 border-2 border-green/30 border-t-green rounded-full animate-spin" />
                ) : (
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                )}
                {syncing ? 'Syncing...' : 'Sync Calendar'}
              </button>
            ) : gcalStatus?.configured ? (
              <button
                onClick={handleGCalConnect}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium
                  bg-green/10 text-green border border-green/20
                  hover:bg-green/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.688a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                </svg>
                Connect Google Calendar
              </button>
            ) : (
              <button
                onClick={handleGoogleCalendarICS}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium
                  bg-green/10 text-green border border-green/20
                  hover:bg-green/20 transition-all cursor-pointer flex items-center gap-1.5"
                title={`Download .ics for Google Calendar (${GCAL_EMAIL})`}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Export .ics
              </button>
            )}
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium
                bg-accent2/10 text-accent2 border border-accent2/20
                hover:bg-accent2/20 transition-all cursor-pointer"
            >
              Export Report
            </button>
            <button
              onClick={onClear}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium
                bg-red/10 text-red border border-red/20
                hover:bg-red/20 transition-all cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Calendar */}
        <WeeklyCalendar blocks={blocks} />

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
                    {course.sections.map((s, i) => (
                      <tr key={i} className="border-t border-border/50">
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
                        <td className={`px-2 py-1.5 font-mono ${s.available > 0 ? 'text-green' : 'text-red'}`}>{s.available}/{s.limit}</td>
                      </tr>
                    ))}
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
            ? `Auto-syncing to Google Calendar (${GCAL_EMAIL}) · Each term gets its own calendar`
            : gcalStatus?.configured
              ? `Connect Google Calendar to auto-sync · ${GCAL_EMAIL}`
              : `Export .ics to import into Google Calendar · ${GCAL_EMAIL}`}
        </div>
      </div>
    </div>
  )
}

function generateMyScheduleHtml(proposal: ScheduleProposal, schedule: SavedCourse[]): string {
  const colors = assignColors(proposal.courses)
  const rows = schedule.map((c) => {
    const color = colors.get(c.course_code)
    const secs = c.sections.map((s) =>
      `<tr><td>${s.type}</td><td>${s.section}</td><td>${s.days}</td><td>${s.time}</td><td>${s.building} ${s.room}</td><td>${s.instructor}</td><td style="color:${s.available > 0 ? '#3dd68c' : '#f25f5c'}">${s.available}/${s.limit}</td></tr>`
    ).join('')
    return `<div class="course"><div class="course-header"><span class="badge" style="background:${color?.bg};color:${color?.text};border-left:3px solid ${color?.border}">${c.course_code}</span><span class="title">${c.title}</span><span class="units">${c.units} units</span></div><table><thead><tr><th>Type</th><th>Section</th><th>Days</th><th>Time</th><th>Location</th><th>Instructor</th><th>Seats</th></tr></thead><tbody>${secs}</tbody></table></div>`
  }).join('\n')

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>My UCSD Schedule - ${proposal.quarter}</title><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0c10;color:#e8ecf4;font-family:'Instrument Sans',sans-serif;padding:2rem;max-width:900px;margin:0 auto}h1{font-family:'DM Mono',monospace;font-size:18px;color:#3dd68c;margin-bottom:4px}.stats{display:flex;gap:1.5rem;font-family:'DM Mono',monospace;font-size:11px;color:#7a82a0;margin-bottom:1.5rem}.stats b{color:#e8ecf4}.course{background:#181c26;border:1px solid #252a38;border-radius:10px;margin-bottom:12px;overflow:hidden}.course-header{padding:12px 14px;display:flex;align-items:center;gap:10px}.badge{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;padding:3px 8px;border-radius:5px}.title{font-size:13px;font-weight:500}.units{font-family:'DM Mono',monospace;font-size:10px;color:#f5c842}table{width:100%;border-collapse:collapse;font-size:11px}th{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;color:#7a82a0;text-align:left;padding:6px 10px;background:#12151c;font-weight:500}td{padding:6px 10px;border-top:1px solid #252a38;font-family:'DM Mono',monospace}.footer{margin-top:2rem;font-family:'DM Mono',monospace;font-size:10px;color:#3d4460;text-align:center}</style></head><body><h1>My UCSD Schedule — ${proposal.quarter}</h1><div class="stats"><span><b>${proposal.total_units}</b> units</span><span><b>${schedule.length}</b> courses</span></div>${rows}<div class="footer">Generated by Trittton &middot; ${new Date().toLocaleDateString()}</div></body></html>`
}
