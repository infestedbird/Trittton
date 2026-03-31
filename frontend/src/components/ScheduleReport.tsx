import { useState } from 'react'
import type { ScheduleProposal } from '../lib/schedule'
import { buildCalendarBlocks, assignColors, detectConflicts } from '../lib/schedule'
import { WeeklyCalendar } from './WeeklyCalendar'
import { capeUrl, socSearchUrl, courseCodeToSubject } from '../lib/links'

interface ScheduleReportProps {
  proposal: ScheduleProposal
  onAddToSchedule?: (proposal: ScheduleProposal) => void
}

export function ScheduleReport({ proposal, onAddToSchedule }: ScheduleReportProps) {
  const blocks = buildCalendarBlocks(proposal)
  const colors = assignColors(proposal.courses)
  const conflicts = detectConflicts(blocks)
  const totalSections = proposal.courses.reduce((s, c) => s + c.sections.length, 0)
  const [showPicker, setShowPicker] = useState(false)
  const [checkedCourses, setCheckedCourses] = useState<Set<string>>(
    () => new Set(proposal.courses.map((c) => c.course_code))
  )

  const handleExport = () => {
    const html = generateReportHtml(proposal)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-${proposal.quarter.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 my-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] font-medium text-accent2">
            Proposed Schedule — {proposal.quarter}
          </div>
          <div className="flex gap-3 mt-1 font-mono text-[10px] text-muted">
            <span><b className="text-text">{proposal.total_units}</b> units</span>
            <span><b className="text-text">{proposal.courses.length}</b> courses</span>
            <span><b className="text-text">{totalSections}</b> sections</span>
            {conflicts.length > 0 && (
              <span className="text-red"><b>{conflicts.length}</b> conflict{conflicts.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {onAddToSchedule && (
            <button
              onClick={() => setShowPicker(!showPicker)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer
                ${showPicker
                  ? 'bg-green/20 text-green border border-green/30'
                  : 'bg-green/10 text-green border border-green/20 hover:bg-green/20'
                }`}
            >
              {showPicker ? 'Cancel' : '+ Add to My Schedule'}
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium
              bg-accent2/10 text-accent2 border border-accent2/20
              hover:bg-accent2/20 transition-all cursor-pointer"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Course picker */}
      {showPicker && onAddToSchedule && (
        <div className="rounded-xl border border-green/20 bg-green/5 p-3 space-y-2">
          <div className="font-mono text-[11px] text-green font-medium">
            Select courses to add to My Schedule:
          </div>
          {proposal.courses.map((c) => {
            const checked = checkedCourses.has(c.course_code)
            const color = colors.get(c.course_code)
            return (
              <button
                key={c.course_code}
                onClick={() => {
                  setCheckedCourses((prev) => {
                    const next = new Set(prev)
                    if (next.has(c.course_code)) next.delete(c.course_code)
                    else next.add(c.course_code)
                    return next
                  })
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all cursor-pointer
                  ${checked
                    ? 'bg-green/10 border border-green/20'
                    : 'bg-surface/50 border border-transparent hover:border-border'
                  }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                  ${checked ? 'bg-green border-green' : 'border-dim'}`}>
                  {checked && <span className="text-white text-[10px]">&#10003;</span>}
                </div>
                <span
                  className="font-mono text-[11px] font-medium px-2 py-0.5 rounded"
                  style={{ background: color?.bg, color: color?.text }}
                >
                  {c.course_code}
                </span>
                <span className="text-[12px] text-text">{c.title}</span>
                <span className="font-mono text-[10px] text-gold ml-auto">{c.units} units</span>
                <span className="font-mono text-[10px] text-muted">{c.sections.length} sections</span>
              </button>
            )
          })}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowPicker(false)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono text-muted hover:text-text
                bg-surface border border-border transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const filtered = {
                  ...proposal,
                  courses: proposal.courses.filter((c) => checkedCourses.has(c.course_code)),
                  total_units: proposal.courses
                    .filter((c) => checkedCourses.has(c.course_code))
                    .reduce((s, c) => s + c.units, 0),
                }
                onAddToSchedule(filtered)
                setShowPicker(false)
              }}
              disabled={checkedCourses.size === 0}
              className="px-4 py-1.5 rounded-lg text-[11px] font-mono font-medium
                bg-green/15 text-green border border-green/20 hover:bg-green/25
                disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Add {checkedCourses.size} course{checkedCourses.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <WeeklyCalendar blocks={blocks} />

      {/* Course details */}
      <div className="space-y-2">
        {proposal.courses.map((course) => {
          const color = colors.get(course.course_code)
          const subject = courseCodeToSubject(course.course_code)
          return (
            <div key={course.course_code} className="rounded-lg border border-border bg-surface/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="font-mono text-[11px] font-medium px-2 py-0.5 rounded"
                  style={{ background: color?.bg, color: color?.text, borderLeft: `3px solid ${color?.border}` }}
                >
                  {course.course_code}
                </span>
                <span className="text-[12px] text-text font-medium">{course.title}</span>
                <span className="font-mono text-[10px] text-gold">{course.units} units</span>
                <div className="ml-auto flex gap-1.5">
                  <a
                    href={socSearchUrl(subject)}
                    target="_blank"
                    rel="noopener"
                    className="font-mono text-[10px] text-accent hover:underline"
                  >
                    Schedule of Classes
                  </a>
                  <a
                    href={capeUrl(course.course_code)}
                    target="_blank"
                    rel="noopener"
                    className="font-mono text-[10px] text-accent hover:underline"
                  >
                    CAPEs
                  </a>
                </div>
              </div>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-muted">
                    {['Type', 'Section', 'Days', 'Time', 'Location', 'Instructor', 'Seats'].map((h) => (
                      <th key={h} className="font-mono text-[9px] uppercase text-left px-2 py-1 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {course.sections.map((s, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-2 py-1 font-mono">{s.type}</td>
                      <td className="px-2 py-1 font-mono text-muted">{s.section}</td>
                      <td className="px-2 py-1">{s.days}</td>
                      <td className="px-2 py-1 font-mono">{s.time}</td>
                      <td className="px-2 py-1">{s.building} {s.room}</td>
                      <td className="px-2 py-1">{s.instructor}</td>
                      <td className={`px-2 py-1 font-mono ${s.available > 0 ? 'text-green' : 'text-red'}`}>
                        {s.available}/{s.limit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function generateReportHtml(proposal: ScheduleProposal): string {
  const colors = assignColors(proposal.courses)
  const totalSections = proposal.courses.reduce((s, c) => s + c.sections.length, 0)

  const courseRows = proposal.courses.map((c) => {
    const color = colors.get(c.course_code)
    const sectionRows = c.sections.map((s) =>
      `<tr><td>${s.type}</td><td>${s.section}</td><td>${s.days}</td><td>${s.time}</td><td>${s.building} ${s.room}</td><td>${s.instructor}</td><td style="color:${s.available > 0 ? '#3dd68c' : '#f25f5c'}">${s.available}/${s.limit}</td></tr>`
    ).join('')

    return `
      <div class="course">
        <div class="course-header">
          <span class="badge" style="background:${color?.bg};color:${color?.text};border-left:3px solid ${color?.border}">${c.course_code}</span>
          <span class="course-title">${c.title}</span>
          <span class="units">${c.units} units</span>
        </div>
        <table>
          <thead><tr><th>Type</th><th>Section</th><th>Days</th><th>Time</th><th>Location</th><th>Instructor</th><th>Seats</th></tr></thead>
          <tbody>${sectionRows}</tbody>
        </table>
      </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>UCSD Schedule — ${proposal.quarter}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0c10;color:#e8ecf4;font-family:'Instrument Sans',sans-serif;padding:2rem;max-width:900px;margin:0 auto}
h1{font-family:'DM Mono',monospace;font-size:18px;color:#4f8ef7;margin-bottom:4px}
.subtitle{font-family:'DM Mono',monospace;font-size:12px;color:#7a82a0;margin-bottom:1.5rem}
.subtitle b{color:#e8ecf4}
.stats{display:flex;gap:1.5rem;font-family:'DM Mono',monospace;font-size:11px;color:#7a82a0;margin-bottom:1.5rem}
.stats b{color:#e8ecf4}
.course{background:#181c26;border:1px solid #252a38;border-radius:10px;margin-bottom:12px;overflow:hidden}
.course-header{padding:12px 14px;display:flex;align-items:center;gap:10px}
.badge{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;padding:3px 8px;border-radius:5px}
.course-title{font-size:13px;font-weight:500}
.units{font-family:'DM Mono',monospace;font-size:10px;color:#f5c842}
table{width:100%;border-collapse:collapse;font-size:11px}
th{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;color:#7a82a0;text-align:left;padding:6px 10px;background:#12151c;font-weight:500}
td{padding:6px 10px;border-top:1px solid #252a38;font-family:'DM Mono',monospace}
.footer{margin-top:2rem;font-family:'DM Mono',monospace;font-size:10px;color:#3d4460;text-align:center}
</style>
</head>
<body>
<h1>UCSD Schedule — ${proposal.quarter}</h1>
<div class="stats">
  <span><b>${proposal.total_units}</b> units</span>
  <span><b>${proposal.courses.length}</b> courses</span>
  <span><b>${totalSections}</b> sections</span>
</div>
${courseRows}
<div class="footer">Generated by UCSD Course Browser &middot; ${new Date().toLocaleDateString()}</div>
</body>
</html>`
}
