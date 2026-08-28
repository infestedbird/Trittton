import { useState, useMemo, useCallback } from 'react'
import type { CompletedCourse } from '../hooks/useCompletedCourses'
import type { Course } from '../types'
import { GradProgress } from './GradProgress'
import { PREREQ_GRAPH, getCleanPrereqs, getCourseStatus, getUnlocks, getDepth, getAllDownstream } from '../lib/prereqChains'
import { tssHomeUrl } from '../lib/links'

interface Props {
  completed: CompletedCourse[]
  allCourses: Course[]
  onAdd: (course: CompletedCourse) => void
  onRemove: (courseCode: string) => void
  onClear: () => void
  completedCodes?: string[]
}

export function CompletedCourses({ completed, allCourses, onAdd, onRemove, onClear, completedCodes }: Props) {
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [search, setSearch] = useState('')

  const completedSet = useMemo(() => new Set(completed.map(c => c.course_code)), [completed])
  const codes = completedCodes || completed.map(c => c.course_code)

  // Group all scraped courses by department
  const deptMap = useMemo(() => {
    const map = new Map<string, Course[]>()
    for (const c of allCourses) {
      if (!map.has(c.subject)) map.set(c.subject, [])
      map.get(c.subject)!.push(c)
    }
    for (const courses of map.values())
      courses.sort((a, b) => a.course_code.localeCompare(b.course_code))
    return map
  }, [allCourses])

  const departments = useMemo(() => Array.from(deptMap.keys()).sort(), [deptMap])
  const activeDept = selectedDept || departments[0] || ''
  const deptCourses = useMemo(() => deptMap.get(activeDept) || [], [deptMap, activeDept])

  // Count completed per dept
  const deptDoneCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of completed) {
      const subj = c.course_code.split(' ')[0]
      counts.set(subj, (counts.get(subj) || 0) + 1)
    }
    return counts
  }, [completed])

  const toggleCourse = useCallback((code: string, title: string) => {
    if (completedSet.has(code)) onRemove(code)
    else onAdd({ course_code: code, title })
  }, [completedSet, onAdd, onRemove])

  // Build prereq layers for the active department
  const prereqLayers = useMemo(() => {
    const nodes = deptCourses.filter(c => PREREQ_GRAPH[c.course_code] !== undefined)
    const noPrereqData = deptCourses.filter(c => PREREQ_GRAPH[c.course_code] === undefined)

    const byDepth = new Map<number, Course[]>()
    for (const c of nodes) {
      const d = getDepth(c.course_code)
      if (!byDepth.has(d)) byDepth.set(d, [])
      byDepth.get(d)!.push(c)
    }

    const layers = Array.from(byDepth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, courses]) => ({ depth, courses }))

    // Append courses without prereq data as a separate group
    if (noPrereqData.length > 0) {
      layers.push({ depth: -1, courses: noPrereqData })
    }
    return layers
  }, [deptCourses])

  // Filter by search
  const filteredLayers = useMemo(() => {
    if (!search) return prereqLayers
    const q = search.toLowerCase()
    return prereqLayers
      .map(layer => ({
        ...layer,
        courses: layer.courses.filter(c =>
          c.course_code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
        ),
      }))
      .filter(layer => layer.courses.length > 0)
  }, [prereqLayers, search])

  // Stats
  const deptDone = deptCourses.filter(c => completedSet.has(c.course_code)).length
  const deptAvail = deptCourses.filter(c => {
    const s = getCourseStatus(c.course_code, completedSet)
    return s === 'available'
  }).length

  // Degree progress overlay
  if (showProgress) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <button onClick={() => setShowProgress(false)}
            className="flex items-center gap-1.5 text-[13px] text-muted hover:text-text cursor-pointer transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Courses
          </button>
          <div className="flex-1" />
          <span className="text-[12px] text-muted"><b className="text-green">{completed.length}</b> courses completed</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <GradProgress completedCodes={codes} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* ── LEFT: Department list ── */}
      <div className="w-52 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-3 pt-4 pb-2 border-b border-border">
          <div className="text-[11px] font-bold text-dim uppercase tracking-wider mb-1">Departments</div>
          <button onClick={() => setShowProgress(true)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-accent2/8 border border-accent2/15 text-[12px] font-medium text-accent2 hover:bg-accent2/15 cursor-pointer transition-all"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
            </svg>
            Degree Progress
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
          {departments.map(dept => {
            const isActive = activeDept === dept
            const total = deptMap.get(dept)?.length || 0
            const done = deptDoneCounts.get(dept) || 0
            return (
              <button key={dept}
                onClick={() => { setSelectedDept(dept); setSearch(''); setSelectedCourse(null) }}
                className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-left mb-px ${
                  isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-card hover:text-text'
                }`}
              >
                <span className={`font-mono text-[11px] font-bold min-w-[42px] ${isActive ? 'text-accent' : 'text-text'}`}>{dept}</span>
                <span className="text-[10px] text-dim flex-1">{total}</span>
                {done > 0 && (
                  <span className="text-[9px] font-bold text-green bg-green/12 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{done}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="px-3 py-2 border-t border-border">
          <div className="text-[10px] text-dim">{completed.length} total completed</div>
          {completed.length > 0 && (
            <button onClick={() => { if (confirm(`Clear all ${completed.length}?`)) onClear() }}
              className="text-[10px] text-dim hover:text-red cursor-pointer mt-0.5">Clear All</button>
          )}
        </div>
      </div>

      {/* ── MAIN: Prereq chain / course grid ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-text">{activeDept}</h2>
            <div className="text-[11px] text-muted">
              {deptCourses.length} courses &middot;
              <span className="text-green ml-1">{deptDone} done</span> &middot;
              <span className="text-accent ml-1">{deptAvail} available</span>
            </div>
          </div>
          <div className="flex-1" />
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green" />Done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />Available</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border" />Locked</span>
          </div>
          {/* Search */}
          <div className="relative w-52">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full bg-surface border border-border rounded-lg text-[12px] text-text px-2.5 py-1.5 pl-7 outline-none focus:border-accent placeholder:text-dim"
            />
          </div>
        </div>

        {/* Course chain */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filteredLayers.map(({ depth, courses }) => {
            const label = depth === -1 ? 'Other Courses' :
              depth === 0 ? 'No Prerequisites' :
              depth === 1 ? '1 Level Deep' :
              `${depth} Levels Deep`
            return (
              <div key={depth} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-dim uppercase tracking-wider">{label}</span>
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] text-dim">{courses.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {courses.map(c => {
                    const status = getCourseStatus(c.course_code, completedSet)
                    const isDone = status === 'completed'
                    const isSelected = selectedCourse === c.course_code
                    const prereqs = getCleanPrereqs(c.course_code)
                    const unlockCount = getUnlocks(c.course_code).length
                    return (
                      <button key={c.course_code}
                        onClick={() => setSelectedCourse(c.course_code === selectedCourse ? null : c.course_code)}
                        className={`relative group px-3 py-2 rounded-xl border cursor-pointer transition-all text-left ${
                          isDone ? 'bg-green/8 border-green/25 hover:border-green/40' :
                          status === 'available' ? 'bg-accent/6 border-accent/20 hover:border-accent/40' :
                          'bg-card border-border hover:border-border2'
                        } ${isSelected ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`}
                      >
                        {isDone && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green flex items-center justify-center">
                            <svg width="8" height="8" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </div>
                        )}
                        <div className={`font-mono text-[11px] font-bold ${
                          isDone ? 'text-green' : status === 'available' ? 'text-accent' : 'text-muted'
                        }`}>{c.course_code}</div>
                        <div className="text-[9px] text-muted truncate max-w-[130px] mt-0.5">{c.title}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[8px] text-dim">{c.units}u</span>
                          {prereqs && prereqs.length > 0 && !isDone && status === 'locked' && (
                            <span className="text-[8px] text-red/50">needs {prereqs.length}</span>
                          )}
                          {unlockCount > 0 && (
                            <span className="text-[8px] text-dim">→{unlockCount}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filteredLayers.length === 0 && (
            <div className="text-center py-16 text-muted text-[13px]">No courses match "{search}"</div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Detail panel ── */}
      {selectedCourse && (
        <DetailPanel
          courseCode={selectedCourse}
          allCourses={allCourses}
          completedSet={completedSet}
          onClose={() => setSelectedCourse(null)}
          onSelect={setSelectedCourse}
          onToggle={toggleCourse}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

function DetailPanel({ courseCode, allCourses, completedSet, onClose, onSelect, onToggle }: {
  courseCode: string
  allCourses: Course[]
  completedSet: Set<string>
  onClose: () => void
  onSelect: (id: string) => void
  onToggle: (code: string, title: string) => void
}) {
  const course = allCourses.find(c => c.course_code === courseCode)
  const prereqs = getCleanPrereqs(courseCode)
  const status = getCourseStatus(courseCode, completedSet)
  const unlocks = getUnlocks(courseCode)
  const downstream = getAllDownstream(courseCode)
  const isDone = completedSet.has(courseCode)

  return (
    <div className="w-72 shrink-0 border-l border-border bg-surface flex flex-col overflow-hidden animate-fade-in">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            status === 'completed' ? 'bg-green/10 text-green border-green/20' :
            status === 'available' ? 'bg-accent/10 text-accent border-accent/20' :
            'bg-red/10 text-red border-red/20'
          }`}>{status === 'completed' ? 'Completed' : status === 'available' ? 'Available' : 'Prereqs Needed'}</span>
          <button onClick={onClose} className="text-dim hover:text-text cursor-pointer text-lg">&times;</button>
        </div>
        <h3 className="text-[16px] font-bold text-text">{courseCode}</h3>
        {course && <p className="text-[12px] text-muted mt-1">{course.title}</p>}
        {course && <span className="inline-block mt-1.5 text-[10px] font-medium text-gold bg-gold/10 px-2 py-0.5 rounded">{course.units} units</span>}

        <button onClick={() => onToggle(courseCode, course?.title || '')}
          className={`w-full mt-3 py-2.5 rounded-xl text-[12px] font-bold cursor-pointer transition-all ${
            isDone
              ? 'bg-surface text-red border border-red/20 hover:bg-red/8'
              : 'bg-green text-white hover:bg-green/85'
          }`}
        >{isDone ? 'Remove from History' : 'Add to History'}</button>

        {/* TSS — finish booking or waitlisting in UCSD's authenticated system */}
        {course && course.sections && course.sections.length > 0 && !isDone && (
          <div className="mt-2 space-y-1.5">
            <div className="text-[10px] font-bold text-dim uppercase tracking-wide">Register</div>
            {course.sections.slice(0, 4).map(s => (
              <div key={s.section_id || s.section} className="flex items-center gap-1.5">
                <button onClick={() => {
                  window.open(tssHomeUrl(), '_blank', 'noopener,noreferrer')
                }}
                  className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border hover:border-accent/30 hover:bg-accent/5 cursor-pointer transition-all text-left text-[10px]"
                  title={`Open TSS for ${s.section_id}`}
                >
                  <span className="font-mono font-bold text-accent">{s.type} {s.section}</span>
                  <span className="text-dim truncate">{s.days} {s.time}</span>
                  <span className={`ml-auto font-mono shrink-0 ${parseInt(s.available) > 0 ? 'text-green' : 'text-red'}`}>
                    {s.available}/{s.limit}
                  </span>
                </button>
              </div>
            ))}
            <p className="text-[9px] text-dim leading-relaxed">
              Open TSS to book an available event or join its active waitlist. Confirm the exact TSS section ID before submitting.
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Prerequisites */}
        <div>
          <div className="text-[10px] font-bold text-dim uppercase tracking-wide mb-1.5">
            Prerequisites ({prereqs.length})
          </div>
          {prereqs.length === 0 ? (
            <div className="text-[11px] text-green font-medium">No prerequisites</div>
          ) : (
            <div className="space-y-1">
              {prereqs.map(p => (
                <button key={p} onClick={() => onSelect(p)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border hover:border-border2 cursor-pointer transition-all text-left"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${completedSet.has(p) ? 'bg-green' : 'bg-border'}`} />
                  <span className="font-mono text-[11px] font-semibold text-text flex-1">{p}</span>
                  {completedSet.has(p) && (
                    <svg width="10" height="10" fill="none" stroke="#3dd68c" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Unlocks */}
        {unlocks.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-dim uppercase tracking-wide mb-1.5">
              Unlocks ({unlocks.length})
            </div>
            <div className="space-y-1">
              {unlocks.map(u => (
                <button key={u} onClick={() => onSelect(u)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border hover:border-border2 cursor-pointer transition-all text-left"
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-accent shrink-0">
                    <path strokeLinecap="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <span className="font-mono text-[11px] font-semibold text-text">{u}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full chain */}
        {downstream.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-dim uppercase tracking-wide mb-1.5">
              Full Chain ({downstream.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {downstream.map(c => (
                <button key={c} onClick={() => onSelect(c)}
                  className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-accent/8 text-accent hover:bg-accent/15 cursor-pointer"
                >{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
