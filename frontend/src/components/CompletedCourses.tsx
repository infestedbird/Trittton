import { useState, useMemo } from 'react'
import type { CompletedCourse } from '../hooks/useCompletedCourses'
import type { Course } from '../types'

interface CompletedCoursesProps {
  completed: CompletedCourse[]
  allCourses: Course[]
  onAdd: (course: CompletedCourse) => void
  onRemove: (courseCode: string) => void
  onClear: () => void
}

// Validate that input looks like a course code (e.g. "CSE 11", "MATH 20A", "HUM 1")
function isValidCourseCode(input: string): boolean {
  return /^[A-Z]{2,5}\s+\d{1,3}[A-Z]{0,3}$/i.test(input.trim())
}

// Normalize course code to uppercase with single space
function normalizeCourseCode(input: string): string {
  const parts = input.trim().split(/\s+/)
  if (parts.length < 2) return input.trim().toUpperCase()
  return parts[0].toUpperCase() + ' ' + parts.slice(1).join('').toUpperCase()
}

export function CompletedCourses({ completed, allCourses, onAdd, onRemove, onClear }: CompletedCoursesProps) {
  const [search, setSearch] = useState('')
  const [showManualHint, setShowManualHint] = useState(false)

  const completedSet = useMemo(() => new Set(completed.map((c) => c.course_code)), [completed])

  // Search scraped courses first
  const searchResults = useMemo(() => {
    if (search.length < 2) return []
    const q = search.toLowerCase()
    return allCourses
      .filter((c) =>
        c.course_code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      )
      .filter((c) => !completedSet.has(c.course_code))
      .slice(0, 15)
  }, [search, allCourses, completedSet])

  // Check if manual entry is possible (typed something that looks like a course code but isn't in scraped data)
  const manualCode = useMemo(() => {
    if (search.length < 3) return null
    const normalized = normalizeCourseCode(search)
    if (!isValidCourseCode(normalized)) return null
    if (completedSet.has(normalized)) return null
    // Only show manual option if it's NOT already in the search results
    if (searchResults.some((c) => c.course_code === normalized)) return null
    return normalized
  }, [search, searchResults, completedSet])

  const handleAddFromSearch = (course: Course) => {
    onAdd({ course_code: course.course_code, title: course.title })
    setSearch('')
    setShowManualHint(false)
  }

  const handleAddManual = (code: string) => {
    onAdd({ course_code: code, title: '' })
    setSearch('')
    setShowManualHint(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // If there's a search result, add the first one
      if (searchResults.length > 0) {
        handleAddFromSearch(searchResults[0])
      } else if (manualCode) {
        handleAddManual(manualCode)
      }
    }
  }

  // Group by subject
  const bySubject = new Map<string, CompletedCourse[]>()
  for (const c of completed) {
    const subj = c.course_code.split(' ')[0]
    if (!bySubject.has(subj)) bySubject.set(subj, [])
    bySubject.get(subj)!.push(c)
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-text">Completed Courses</h2>
          <p className="text-[13px] text-muted mt-1">
            Add courses you've already taken. Search from this term's courses, or type any course code
            (e.g. HUM 1, WCWP 10A) and press Enter to add it manually.
          </p>
        </div>

        {/* Search & Add */}
        <div className="relative">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowManualHint(true) }}
              onKeyDown={handleKeyDown}
              placeholder="Search or type any course code (e.g. CSE 11, HUM 1, WCWP 10A)..."
              className="w-full bg-surface border border-border rounded-xl text-text font-sans text-[14px]
                px-4 py-3 pl-10 outline-none transition-colors focus:border-accent placeholder:text-dim"
            />
          </div>

          {/* Dropdown */}
          {(searchResults.length > 0 || manualCode) && showManualHint && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border2 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
              {/* Manual add option — shown at top when course isn't in scraped data */}
              {manualCode && (
                <button
                  onClick={() => handleAddManual(manualCode)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors cursor-pointer border-b border-border/50"
                >
                  <span className="font-mono text-[12px] font-medium text-gold bg-gold/12 px-2 py-0.5 rounded shrink-0">
                    {manualCode}
                  </span>
                  <span className="text-[13px] text-muted">Add manually (not in current term data)</span>
                  <span className="font-mono text-[11px] text-dim ml-auto shrink-0">Enter ↵</span>
                </button>
              )}

              {/* Scraped course results */}
              {searchResults.map((c) => (
                <button
                  key={c.course_code}
                  onClick={() => handleAddFromSearch(c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface transition-colors cursor-pointer border-b border-border/50 last:border-0"
                >
                  <span className="font-mono text-[12px] font-medium text-accent bg-accent/12 px-2 py-0.5 rounded shrink-0">
                    {c.course_code}
                  </span>
                  <span className="text-[13px] text-text truncate">{c.title}</span>
                  <span className="font-mono text-[11px] text-gold ml-auto shrink-0">{c.units} units</span>
                </button>
              ))}
            </div>
          )}

          {/* Hint when no results and not a valid code */}
          {search.length >= 2 && searchResults.length === 0 && !manualCode && showManualHint && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border2 rounded-xl shadow-2xl z-50 px-4 py-3">
              <p className="text-[12px] text-muted">
                No matching courses in this term's data. Type a full course code like <span className="font-mono text-accent">MATH 20A</span> or <span className="font-mono text-accent">HUM 1</span> and press Enter to add manually.
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        {completed.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-muted">
              <b className="text-text">{completed.length}</b> courses completed across{' '}
              <b className="text-text">{bySubject.size}</b> departments
            </div>
            <button
              onClick={onClear}
              className="text-[11px] px-2 py-1 rounded-md text-red/60 hover:text-red hover:bg-red/10 transition-all cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Course list grouped by subject */}
        {completed.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-accent2/12 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" fill="none" stroke="#7c5cfc" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-text mb-2">No courses added yet</h3>
            <p className="text-[13px] text-muted max-w-sm mx-auto">
              Search for courses above or type any course code and press Enter.
              This tracks your progress toward graduation requirements.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(bySubject.entries()).map(([subj, courses]) => (
              <div key={subj}>
                <div className="text-[11px] text-muted mb-1.5">{subj}</div>
                <div className="flex flex-wrap gap-2">
                  {courses.map((c) => (
                    <div
                      key={c.course_code}
                      className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 group"
                    >
                      <span className="font-mono text-[12px] font-medium text-green">{c.course_code}</span>
                      {c.title && <span className="text-[12px] text-muted truncate max-w-[200px]">{c.title}</span>}
                      <button
                        onClick={() => onRemove(c.course_code)}
                        className="text-dim hover:text-red transition-colors cursor-pointer opacity-0 group-hover:opacity-100 text-sm"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
