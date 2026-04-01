import { useState, useRef, useEffect } from 'react'
import type { FourYearPlan as FourYearPlanType, PlannedCourse, QuarterPlan } from '../hooks/useFourYearPlan'
import type { Course } from '../types'

interface FourYearPlanProps {
  plan: FourYearPlanType
  allCourses: Course[]
  onAddCourse: (quarter: string, course: PlannedCourse) => void
  onRemoveCourse: (quarter: string, courseCode: string) => void
  onClearQuarter: (quarter: string) => void
  onClearAll: () => void
  totalUnits: number
}

// Group quarters into academic years
function groupByAcademicYear(plan: FourYearPlanType): { year: string; quarters: QuarterPlan[] }[] {
  const groups: { year: string; quarters: QuarterPlan[] }[] = []
  for (let i = 0; i < plan.length; i += 5) {
    const chunk = plan.slice(i, i + 5)
    if (chunk.length === 0) continue
    const fallQ = chunk[0]
    const springQ = chunk[2]
    // Academic year label: "2025-2026"
    const fallYear = fallQ.label.split(' ').pop()
    const springYear = springQ?.label.split(' ').pop() || fallYear
    groups.push({
      year: `${fallYear}–${springYear}`,
      quarters: chunk,
    })
  }
  return groups
}

// Color palette for course pills (cycled per unique course)
const PILL_COLORS = [
  { bg: 'rgba(79,142,247,0.2)', border: '#4f8ef7', text: '#78a9f7' },
  { bg: 'rgba(61,214,140,0.2)', border: '#3dd68c', text: '#3dd68c' },
  { bg: 'rgba(245,200,66,0.2)', border: '#f5c842', text: '#f5c842' },
  { bg: 'rgba(124,92,252,0.2)', border: '#7c5cfc', text: '#a07cf5' },
  { bg: 'rgba(242,95,92,0.2)', border: '#f25f5c', text: '#f25f5c' },
  { bg: 'rgba(255,159,67,0.2)', border: '#ff9f43', text: '#ff9f43' },
  { bg: 'rgba(0,206,209,0.2)', border: '#00ced1', text: '#00ced1' },
  { bg: 'rgba(255,105,180,0.2)', border: '#ff69b4', text: '#ff69b4' },
]

function getColorForCourse(courseCode: string, allCodes: string[]) {
  const idx = allCodes.indexOf(courseCode)
  return PILL_COLORS[(idx >= 0 ? idx : 0) % PILL_COLORS.length]
}

export function FourYearPlan({ plan, allCourses, onAddCourse, onRemoveCourse, onClearQuarter, onClearAll, totalUnits }: FourYearPlanProps) {
  const academicYears = groupByAcademicYear(plan)
  const allPlannedCodes = plan.flatMap((q) => q.courses.map((c) => c.course_code))
  const uniqueCodes = [...new Set(allPlannedCodes)]
  const totalCourses = uniqueCodes.length

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-text">4-Year Plan</h2>
            <div className="flex gap-4 mt-1 font-mono text-[11px] text-muted">
              <span><b className="text-text">{totalUnits}</b> total units</span>
              <span><b className="text-text">{totalCourses}</b> unique courses</span>
              <span><b className="text-text">{plan.filter((q) => q.courses.length > 0).length}</b> active quarters</span>
            </div>
          </div>
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium
              bg-red/10 text-red border border-red/20
              hover:bg-red/20 transition-all cursor-pointer"
          >
            Clear Plan
          </button>
        </div>

        {/* Academic year rows */}
        {academicYears.map((ay) => (
          <div key={ay.year}>
            <div className="font-mono text-[11px] text-muted mb-2 uppercase tracking-wider">{ay.year}</div>
            <div className="grid grid-cols-5 gap-2">
              {ay.quarters.map((q) => (
                <QuarterCard
                  key={q.quarter}
                  quarter={q}
                  allCourses={allCourses}
                  uniqueCodes={uniqueCodes}
                  onAdd={(course) => onAddCourse(q.quarter, course)}
                  onRemove={(code) => onRemoveCourse(q.quarter, code)}
                  onClear={() => onClearQuarter(q.quarter)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Legend / help */}
        <div className="text-[11px] text-dim font-mono text-center pb-6">
          Type a course code (e.g. "CSE 12") to add it to a quarter. These are rough plans — no enrollment data needed.
        </div>
      </div>
    </div>
  )
}

interface QuarterCardProps {
  quarter: QuarterPlan
  allCourses: Course[]
  uniqueCodes: string[]
  onAdd: (course: PlannedCourse) => void
  onRemove: (courseCode: string) => void
  onClear: () => void
}

function QuarterCard({ quarter, allCourses, uniqueCodes, onAdd, onRemove, onClear }: QuarterCardProps) {
  const [input, setInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [suggestions, setSuggestions] = useState<Course[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const quarterUnits = quarter.courses.reduce((s, c) => s + c.units, 0)
  const isSummer = quarter.quarter.startsWith('S1') || quarter.quarter.startsWith('S2')

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  // Close input when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowInput(false)
        setInput('')
        setSuggestions([])
      }
    }
    if (showInput) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showInput])

  const handleInputChange = (val: string) => {
    setInput(val)
    setSelectedIdx(0)
    if (val.trim().length < 2) {
      setSuggestions([])
      return
    }
    const query = val.trim().toUpperCase()
    const matches = allCourses
      .filter((c) =>
        c.course_code.toUpperCase().includes(query) ||
        c.title.toUpperCase().includes(query)
      )
      .filter((c) => !quarter.courses.some((pc) => pc.course_code === c.course_code))
      .slice(0, 6)
    setSuggestions(matches)
  }

  const addFromSuggestion = (course: Course) => {
    onAdd({
      course_code: course.course_code,
      title: course.title,
      units: parseInt(course.units) || 4,
    })
    setInput('')
    setSuggestions([])
    setShowInput(false)
  }

  const addManual = () => {
    const code = input.trim().toUpperCase()
    if (!code) return
    // Check if it matches a known course
    const match = allCourses.find((c) => c.course_code.toUpperCase() === code)
    if (match) {
      addFromSuggestion(match)
    } else {
      // Add as a manual/unknown course with estimated 4 units
      onAdd({
        course_code: code,
        title: 'Planned Course',
        units: 4,
      })
      setInput('')
      setSuggestions([])
      setShowInput(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowInput(false)
      setInput('')
      setSuggestions([])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (suggestions.length > 0 && selectedIdx < suggestions.length) {
        addFromSuggestion(suggestions[selectedIdx])
      } else {
        addManual()
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border bg-card p-3 flex flex-col min-h-[160px] transition-all
        ${isSummer ? 'border-border/60 opacity-80' : 'border-border'}`}
    >
      {/* Quarter header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-mono text-[11px] font-medium text-text">{quarter.label}</div>
          <div className="font-mono text-[9px] text-muted">
            {quarterUnits > 0 ? `${quarterUnits} units` : 'no courses'}
          </div>
        </div>
        {quarter.courses.length > 0 && (
          <button
            onClick={onClear}
            className="font-mono text-[9px] text-dim hover:text-red transition-colors cursor-pointer"
            title="Clear quarter"
          >
            clear
          </button>
        )}
      </div>

      {/* Course pills */}
      <div className="flex-1 space-y-1">
        {quarter.courses.map((c) => {
          const color = getColorForCourse(c.course_code, uniqueCodes)
          return (
            <div
              key={c.course_code}
              className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-mono"
              style={{ background: color.bg, borderLeft: `2px solid ${color.border}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" style={{ color: color.text }}>{c.course_code}</div>
                <div className="text-[9px] text-muted truncate">{c.title !== 'Planned Course' ? c.title : ''}</div>
              </div>
              <span className="text-[9px] text-muted shrink-0">{c.units}u</span>
              <button
                onClick={() => onRemove(c.course_code)}
                className="opacity-0 group-hover:opacity-100 text-[11px] text-muted hover:text-red transition-all cursor-pointer shrink-0"
              >
                &times;
              </button>
            </div>
          )
        })}
      </div>

      {/* Add course input */}
      {showInput ? (
        <div className="mt-2 relative">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="CSE 12"
            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5
              text-[11px] font-mono text-text placeholder:text-dim
              outline-none focus:border-accent/50 transition-colors"
          />
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded-lg overflow-hidden shadow-xl z-50 max-h-[200px] overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s.course_code}
                  onClick={() => addFromSuggestion(s)}
                  className={`w-full text-left px-2 py-1.5 text-[11px] font-mono cursor-pointer transition-colors
                    ${i === selectedIdx ? 'bg-accent/15 text-accent' : 'text-text hover:bg-card'}`}
                >
                  <span className="font-medium">{s.course_code}</span>
                  <span className="text-muted ml-1.5">{s.title}</span>
                  <span className="text-dim ml-1">({s.units}u)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="mt-2 w-full rounded-lg border border-dashed border-dim/40 py-2
            text-[11px] font-mono text-dim hover:text-accent hover:border-accent/30 hover:bg-accent/5
            transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
          </svg>
          Add Course
        </button>
      )}
    </div>
  )
}
