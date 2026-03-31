import { useState } from 'react'
import type { CompletedCourse } from '../hooks/useCompletedCourses'
import type { Course } from '../types'

interface CompletedCoursesProps {
  completed: CompletedCourse[]
  allCourses: Course[]
  onAdd: (course: CompletedCourse) => void
  onRemove: (courseCode: string) => void
  onClear: () => void
}

export function CompletedCourses({ completed, allCourses, onAdd, onRemove, onClear }: CompletedCoursesProps) {
  const [search, setSearch] = useState('')

  // Filter available courses for the search dropdown
  const searchResults = search.length >= 2
    ? allCourses
        .filter((c) => {
          const q = search.toLowerCase()
          return (
            c.course_code.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q)
          )
        })
        .filter((c) => !completed.some((cc) => cc.course_code === c.course_code))
        .slice(0, 15)
    : []

  const handleAdd = (course: Course) => {
    onAdd({ course_code: course.course_code, title: course.title })
    setSearch('')
  }

  // Group by subject
  const bySubject = new Map<string, CompletedCourse[]>()
  for (const c of completed) {
    const subj = c.course_code.split(' ')[0]
    if (!bySubject.has(subj)) bySubject.set(subj, [])
    bySubject.get(subj)!.push(c)
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-medium text-text">Completed Courses</h2>
          <p className="text-[13px] text-muted mt-1">
            Add courses you've already taken. The AI planner will use this to recommend courses you're eligible for,
            and the browse view will warn you about unmet prerequisites.
          </p>
        </div>

        {/* Search & Add */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for a course to add (e.g. CSE 11, MATH 20A)..."
            className="w-full bg-surface border border-border rounded-xl text-text font-sans text-[14px]
              px-4 py-3 outline-none transition-colors focus:border-accent placeholder:text-dim"
          />
          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border2 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
              {searchResults.map((c) => (
                <button
                  key={c.course_code}
                  onClick={() => handleAdd(c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface transition-colors cursor-pointer border-b border-border/50 last:border-0"
                >
                  <span className="font-mono text-[12px] font-medium text-accent bg-accent/12 px-2 py-0.5 rounded shrink-0">
                    {c.course_code}
                  </span>
                  <span className="text-[13px] text-text truncate">{c.title}</span>
                  <span className="font-mono text-[10px] text-gold ml-auto shrink-0">{c.units} units</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {completed.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] text-muted">
              <b className="text-text">{completed.length}</b> courses completed across{' '}
              <b className="text-text">{bySubject.size}</b> departments
            </div>
            <button
              onClick={onClear}
              className="font-mono text-[11px] px-2 py-1 rounded-md text-red/60 hover:text-red hover:bg-red/10 transition-all cursor-pointer"
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
              Search for courses you've completed above. This helps the AI recommend courses you're eligible for
              and flags prerequisite warnings in the course browser.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(bySubject.entries()).map(([subj, courses]) => (
              <div key={subj}>
                <div className="font-mono text-[11px] text-muted mb-1.5">{subj}</div>
                <div className="flex flex-wrap gap-2">
                  {courses.map((c) => (
                    <div
                      key={c.course_code}
                      className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 group"
                    >
                      <span className="font-mono text-[12px] font-medium text-green">{c.course_code}</span>
                      <span className="text-[12px] text-muted truncate max-w-[200px]">{c.title}</span>
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
