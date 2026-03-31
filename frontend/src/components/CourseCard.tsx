import { useState, useEffect } from 'react'
import type { Course, Section } from '../types'
import { courseAvailStatus } from '../lib/availability'
import { SectionTable } from './SectionTable'
import { capeUrl, socSearchUrl, courseCodeToSubject, rmpUrl } from '../lib/links'
import type { SavedCourse } from '../hooks/useMySchedule'
import type { RmpRating } from '../hooks/useRmpRatings'
import { TYPE_COLORS } from '../lib/constants'

interface CourseCardProps {
  course: Course
  index: number
  onAddToSchedule?: (course: SavedCourse) => void
  isInSchedule?: boolean
  hasSection?: (courseCode: string, sectionCode: string, sectionType: string) => boolean
  hasCompleted?: (courseCode: string) => boolean
  getRating?: (instructor: string) => RmpRating | null | undefined
}

export function CourseCard({ course, index, onAddToSchedule, isInSchedule, hasSection, hasCompleted, getRating }: CourseCardProps) {
  const [open, setOpen] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set())
  const [prereqs, setPrereqs] = useState<{ prerequisites: string; description: string } | null>(null)
  const { status, seats } = courseAvailStatus(course)

  // Fetch prereqs when card is expanded
  useEffect(() => {
    if (!open || prereqs) return
    fetch(`/api/prereqs?course=${encodeURIComponent(course.course_code)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setPrereqs(data) })
      .catch(() => {})
  }, [open, prereqs, course.course_code])

  const instructors =
    [...new Set(course.sections.map((s) => s.instructor).filter(Boolean))].slice(0, 2).join(', ') ||
    'TBA'

  let seatLabel = ''
  let seatClass = ''
  if (status === 'open') {
    seatLabel = `${seats} seat${seats !== 1 ? 's' : ''} open`
    seatClass = 'text-green'
  } else if (status === 'waitlist') {
    seatLabel = 'waitlist'
    seatClass = 'text-gold'
  } else {
    seatLabel = 'full'
    seatClass = 'text-red'
  }

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onAddToSchedule) return
    if (isInSchedule) return
    // Open picker instead of adding all
    setShowPicker(true)
    setOpen(true)
    // Pre-select all sections
    setSelectedSections(new Set(course.sections.map((_, i) => i)))
  }

  const toggleSection = (idx: number) => {
    setSelectedSections((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const confirmAdd = () => {
    if (!onAddToSchedule || selectedSections.size === 0) return
    const picked = course.sections.filter((_, i) => selectedSections.has(i))
    onAddToSchedule({
      course_code: course.course_code,
      title: course.title,
      units: parseInt(course.units) || 0,
      subject: course.subject,
      sections: picked.map((s) => ({
        type: s.type,
        section: s.section,
        days: s.days,
        time: s.time,
        building: s.building,
        room: s.room,
        instructor: s.instructor,
        available: parseInt(s.available) || 0,
        limit: parseInt(s.limit) || 0,
      })),
    })
    setShowPicker(false)
  }

  // Check if prereqs are unmet (only if we have prereq data and hasCompleted)
  const hasUnmetPrereqs = (() => {
    if (!prereqs?.prerequisites || !hasCompleted) return false
    const codes = prereqs.prerequisites.match(/[A-Z]{2,5}\s+\d{1,3}[A-Z]*/g) || []
    return codes.some((code) => !hasCompleted(code))
  })()

  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden transition-colors duration-150 hover:border-border2 animate-fade-in ${
        hasUnmetPrereqs ? 'border-red/40' : 'border-border'
      }`}
      data-testid="course-card"
      style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
    >
      {/* Header */}
      <div
        onClick={() => setOpen(!open)}
        className="px-4 py-3.5 cursor-pointer flex items-start gap-3.5 select-none"
        data-testid="course-header"
      >
        {/* Course badge with hover tooltip */}
        <div className="relative group shrink-0 mt-px">
          <a
            href={socSearchUrl(courseCodeToSubject(course.course_code))}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[12px] font-medium bg-accent/12 text-accent rounded-md px-2.5 py-1 whitespace-nowrap hover:bg-accent/20 transition-colors block"
            title={`View ${course.subject} on Schedule of Classes`}
          >
            {course.course_code}
          </a>
          {/* Tooltip */}
          <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150
            absolute left-0 top-full mt-1 z-50 w-72 bg-card border border-border2 rounded-xl p-3 shadow-2xl pointer-events-none">
            <div className="text-[13px] font-medium text-text mb-1">{course.title || 'Untitled'}</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {course.units && <span className="font-mono text-[10px] px-1.5 py-px rounded bg-gold/10 text-gold">{course.units} units</span>}
              {course.restrictions && <span className="font-mono text-[10px] px-1.5 py-px rounded bg-accent2/10 text-accent2">{course.restrictions}</span>}
              <span className={`font-mono text-[10px] px-1.5 py-px rounded ${status === 'open' ? 'bg-green/10 text-green' : status === 'waitlist' ? 'bg-gold/10 text-gold' : 'bg-red/10 text-red'}`}>
                {seatLabel}
              </span>
            </div>
            <div className="text-[11px] text-muted">
              {course.sections.length} section{course.sections.length !== 1 ? 's' : ''} &middot; {instructors}
            </div>
            {instructors !== 'TBA' && (
              <div className="text-[10px] text-dim mt-1">Hover instructor names for RMP links</div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-text leading-snug truncate">
            {course.title || 'Untitled'}
          </div>
          <div className="flex gap-2 mt-1 flex-wrap">
            {course.units && (
              <span className="font-mono text-[10px] px-2 py-px rounded border border-gold/20 bg-gold/5 text-gold">
                {course.units} units
              </span>
            )}
            {course.restrictions && (
              <span className="font-mono text-[10px] px-2 py-px rounded border border-accent2/20 bg-accent2/5 text-accent2">
                {course.restrictions}
              </span>
            )}
            <a
              href={capeUrl(course.course_code)}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[10px] px-2 py-px rounded border border-accent2/20 bg-accent2/5 text-accent2 hover:bg-accent2/10 transition-colors"
            >
              CAPEs
            </a>
            {instructors !== 'TBA' && (() => {
              const mainInstructor = instructors.split(',')[0].trim()
              const rating = getRating?.(mainInstructor)
              return rating ? (
                <a
                  href={rating.rmpUrl}
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => e.stopPropagation()}
                  className={`font-mono text-[10px] px-2 py-px rounded border flex items-center gap-1 hover:opacity-80 transition-colors ${
                    rating.rating >= 4 ? 'border-green/20 bg-green/5 text-green'
                    : rating.rating >= 3 ? 'border-gold/20 bg-gold/5 text-gold'
                    : 'border-red/20 bg-red/5 text-red'
                  }`}
                  title={`${rating.name}: ${rating.rating}/5 rating, ${rating.difficulty}/5 difficulty, ${rating.numRatings} reviews`}
                >
                  <span>&#9733; {rating.rating.toFixed(1)}</span>
                  <span className="text-dim">|</span>
                  <span className={rating.difficulty <= 3 ? 'text-green' : rating.difficulty <= 4 ? 'text-gold' : 'text-red'}>
                    {rating.difficulty.toFixed(1)} diff
                  </span>
                </a>
              ) : (
                <a
                  href={rmpUrl(mainInstructor)}
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[10px] px-2 py-px rounded border border-green/20 bg-green/5 text-green hover:bg-green/10 transition-colors"
                >
                  RMP
                </a>
              )
            })()}
            <span className="font-mono text-[10px] px-2 py-px rounded border border-border text-muted">
              {course.sections.length} section{course.sections.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          {onAddToSchedule && (
            <button
              onClick={handleAddClick}
              className={`font-mono text-[11px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer
                ${isInSchedule
                  ? 'bg-green/15 text-green border border-green/20'
                  : showPicker
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'
                }`}
              title={isInSchedule ? 'Already in My Schedule' : 'Pick sections to add'}
            >
              {isInSchedule ? 'Added' : showPicker ? 'Picking...' : '+ Add'}
            </button>
          )}
          <div className="flex flex-col items-end gap-1">
            <span className={`font-mono text-[11px] font-medium ${seatClass}`} data-testid="seat-status">
              {seatLabel}
            </span>
            <span
              className={`text-dim text-[12px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            >
              &#x25BC;
            </span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div
        className={`border-t border-border overflow-hidden transition-all duration-250 ease-in-out ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 border-t-transparent'
        }`}
      >
        {/* Prerequisites & Description */}
        {prereqs && (prereqs.prerequisites || prereqs.description) && (() => {
          // Check if prereqs are met
          const prereqText = prereqs.prerequisites || ''
          const prereqCodes = prereqText.match(/[A-Z]{2,5}\s+\d{1,3}[A-Z]*/g) || []
          const unmet = hasCompleted
            ? prereqCodes.filter((code) => !hasCompleted(code))
            : []
          const hasUnmet = hasCompleted && unmet.length > 0

          return (
            <div className={`px-4 py-2.5 border-b border-border ${hasUnmet ? 'bg-red/5' : 'bg-surface/50'}`}>
              {prereqs.description && (
                <div className="text-[12px] text-muted leading-relaxed mb-1.5">
                  {prereqs.description.length > 200 ? prereqs.description.slice(0, 200) + '...' : prereqs.description}
                </div>
              )}
              {prereqs.prerequisites && (
                <div className="flex items-start gap-2">
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                    hasUnmet ? 'text-red bg-red/10' : 'text-gold bg-gold/10'
                  }`}>
                    PREREQS
                  </span>
                  <span className="text-[12px] text-text">{prereqs.prerequisites}</span>
                </div>
              )}
              {hasUnmet && (
                <div className="mt-2 flex items-start gap-2 bg-red/10 border border-red/20 rounded-lg px-3 py-2">
                  <span className="text-red text-sm shrink-0">&#9888;</span>
                  <div>
                    <div className="text-[12px] text-red font-medium">Missing prerequisites</div>
                    <div className="text-[11px] text-muted mt-0.5">
                      You need to complete {unmet.join(', ')} first.
                      You can still add this course to plan ahead.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {showPicker ? (
          <SectionPicker
            sections={course.sections}
            selected={selectedSections}
            onToggle={toggleSection}
            onConfirm={confirmAdd}
            onCancel={() => setShowPicker(false)}
          />
        ) : (
          <SectionTable
            sections={course.sections}
            courseCode={course.course_code}
            courseTitle={course.title}
            courseUnits={parseInt(course.units) || 0}
            onAddSection={onAddToSchedule ? (sec) => {
              onAddToSchedule({
                course_code: course.course_code,
                title: course.title,
                units: parseInt(course.units) || 0,
                subject: course.subject,
                sections: [sec],
              })
            } : undefined}
            isSectionAdded={hasSection ? (sec, type) => hasSection(course.course_code, sec, type) : undefined}
            getRating={getRating}
          />
        )}
      </div>
    </div>
  )
}

function SectionPicker({
  sections,
  selected,
  onToggle,
  onConfirm,
  onCancel,
}: {
  sections: Section[]
  selected: Set<number>
  onToggle: (idx: number) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[11px] text-accent font-medium">
          Select sections to add ({selected.size} selected)
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="font-mono text-[11px] px-2 py-1 rounded-md text-muted hover:text-text
              bg-surface border border-border hover:border-border2 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={selected.size === 0}
            className="font-mono text-[11px] px-3 py-1 rounded-md font-medium
              bg-green/15 text-green border border-green/20 hover:bg-green/25
              disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Add {selected.size} section{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {sections.map((s, i) => {
          const isSelected = selected.has(i)
          const aInt = parseInt(s.available) || 0
          const wInt = parseInt(s.waitlisted) || 0
          const typeColor = TYPE_COLORS[s.type]
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all cursor-pointer
                ${isSelected
                  ? 'bg-accent/8 border border-accent/20'
                  : 'bg-surface/50 border border-transparent hover:border-border'
                }`}
            >
              {/* Checkbox */}
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                ${isSelected ? 'bg-accent border-accent' : 'border-dim'}`}>
                {isSelected && <span className="text-white text-[10px]">&#10003;</span>}
              </div>
              {/* Type badge */}
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={typeColor
                  ? { background: typeColor.bg, color: typeColor.text }
                  : { background: 'rgba(122,130,160,0.15)', color: '#7a82a0' }}
              >
                {s.type}
              </span>
              {/* Section */}
              <span className="font-mono text-[11px] text-muted w-10 shrink-0">{s.section}</span>
              {/* Days + Time */}
              <span className="text-[12px] text-text w-28 shrink-0">{s.days} {s.time}</span>
              {/* Location */}
              <span className="text-[12px] text-muted w-24 shrink-0">{s.building} {s.room}</span>
              {/* Instructor */}
              <span className="text-[12px] text-muted flex-1 truncate">{s.instructor || 'TBA'}</span>
              {/* Availability */}
              <span className={`font-mono text-[11px] shrink-0 ${aInt > 0 ? 'text-green' : wInt > 0 ? 'text-gold' : 'text-red'}`}>
                {s.available}/{s.limit}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
