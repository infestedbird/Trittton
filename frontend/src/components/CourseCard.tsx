import { useState, useEffect } from 'react'
import type { Course, Section } from '../types'
import { courseAvailStatus } from '../lib/availability'
import { SectionTable } from './SectionTable'
import { ProfessorCompare } from './ProfessorCompare'
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
  isWatching?: (sectionId: string) => boolean
  onWatch?: (sectionId: string, courseCode: string, section: string, meta?: Record<string, unknown>) => void
  onUnwatch?: (sectionId: string, courseCode: string, section: string) => void
}

export function CourseCard({ course, index, onAddToSchedule, isInSchedule, hasSection, hasCompleted, getRating, isWatching, onWatch, onUnwatch }: CourseCardProps) {
  const [open, setOpen] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set())
  const [prereqs, setPrereqs] = useState<{ prerequisites: string; description: string } | null>(null)
  const { status, seats } = courseAvailStatus(course)

  useEffect(() => {
    if (!open || prereqs) return
    fetch(`/api/prereqs?course=${encodeURIComponent(course.course_code)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setPrereqs(data) })
      .catch(() => {})
  }, [open, prereqs, course.course_code])

  const uniqueInstructors = [...new Set(course.sections.map((s) => s.instructor).filter(n => n && n !== 'TBA' && n !== 'Staff'))]
  const uniqueInstructorCount = uniqueInstructors.length
  const instructors = uniqueInstructors.slice(0, 2).join(', ') || 'TBA'

  let seatLabel = ''
  if (status === 'open') {
    seatLabel = `${seats} open`
  } else if (status === 'waitlist') {
    seatLabel = 'waitlist'
  } else {
    seatLabel = 'full'
  }

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onAddToSchedule) return
    if (isInSchedule) return
    setShowPicker(true)
    setOpen(true)
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

  const hasUnmetPrereqs = (() => {
    if (!prereqs?.prerequisites || !hasCompleted) return false
    const codes = prereqs.prerequisites.match(/[A-Z]{2,5}\s+\d{1,3}[A-Z]*/g) || []
    return codes.some((code) => !hasCompleted(code))
  })()

  // Get primary instructor rating
  const mainInstructor = instructors.split(',')[0].trim()
  const rating = mainInstructor !== 'TBA' ? getRating?.(mainInstructor) : null

  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden card-hover animate-fade-in ${
        hasUnmetPrereqs ? 'border-red/30' : 'border-border hover:border-border2'
      }`}
      data-testid="course-card"
      style={{ animationDelay: `${Math.min(index * 15, 150)}ms` }}
    >
      {/* Header — essentials only */}
      <div
        onClick={() => setOpen(!open)}
        className="px-5 py-4 cursor-pointer flex items-center gap-3 select-none"
        data-testid="course-header"
      >
        {/* Course code + units */}
        <a
          href={socSearchUrl(courseCodeToSubject(course.course_code))}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm font-bold bg-accent/12 text-accent rounded-xl px-3.5 py-2 whitespace-nowrap hover:bg-accent/20 shrink-0"
          title={`View ${course.subject} on Schedule of Classes`}
        >
          {course.course_code}
          {course.units && <span className="ml-1.5 text-xs font-medium text-accent/60">{course.units}u</span>}
        </a>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-text leading-snug truncate">
            {course.title || 'Untitled'}
          </div>
        </div>

        {/* Right: add button + seat status pill + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          {onAddToSchedule && (
            <button
              onClick={handleAddClick}
              className={`text-sm font-bold px-5 py-2 rounded-xl cursor-pointer transition-all
                ${isInSchedule
                  ? 'bg-green text-white shadow-[0_0_12px_rgba(61,214,140,0.3)]'
                  : showPicker
                    ? 'bg-accent/20 text-accent border-2 border-accent/25'
                    : 'bg-accent text-white hover:bg-accent/85 hover:shadow-[0_0_16px_rgba(79,142,247,0.3)]'
                }`}
              title={isInSchedule ? 'Already in My Schedule' : 'Pick sections to add'}
            >
              {isInSchedule ? '✓ Added' : showPicker ? 'Picking...' : '+ Add'}
            </button>
          )}

          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            status === 'open' ? 'bg-green/15 text-green' : status === 'waitlist' ? 'bg-gold/15 text-gold' : 'bg-red/15 text-red'
          }`} data-testid="seat-status">
            {seatLabel}
          </span>

          <span className={`text-dim text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            &#x25BC;
          </span>
        </div>
      </div>

      {/* Expanded summary bar — details that used to be in collapsed header */}
      {open && (
        <div className="px-5 py-2.5 bg-surface/30 border-t border-border/50 flex items-center gap-3 flex-wrap text-[12px] text-muted">
          <span>{course.sections.length} section{course.sections.length !== 1 ? 's' : ''}</span>
          {course.restrictions && <span className="text-accent2">{course.restrictions}</span>}
          <span className="truncate max-w-[200px]">{instructors}</span>
          {rating && (
            <a href={rating.rmpUrl} target="_blank" rel="noopener"
              className={`hover:underline ${rating.rating >= 4 ? 'text-green' : rating.rating >= 3 ? 'text-gold' : 'text-red'}`}>
              &#9733;{rating.rating.toFixed(1)}
            </a>
          )}
          <a href={capeUrl(course.course_code)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
            className="text-[11px] px-1.5 py-0.5 rounded bg-accent2/8 text-accent2/70 hover:text-accent2">CAPEs</a>
          {mainInstructor !== 'TBA' && (
            <a href={rmpUrl(mainInstructor)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
              className="text-[11px] px-1.5 py-0.5 rounded bg-green/8 text-green/70 hover:text-green">RMP</a>
          )}
          {uniqueInstructorCount >= 2 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCompare(true) }}
              className="text-[11px] px-2 py-0.5 rounded bg-gold/10 text-gold/80 hover:text-gold hover:bg-gold/15 cursor-pointer"
            >
              Compare Professors
            </button>
          )}
        </div>
      )}

      {showCompare && (
        <ProfessorCompare
          courseCode={course.course_code}
          sections={course.sections}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Expanded content */}
      <div
        className={`border-t border-border overflow-hidden transition-all duration-200 ease-in-out ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 border-t-transparent'
        }`}
      >
        {/* Prerequisites */}
        {prereqs && (prereqs.prerequisites || prereqs.description) && (() => {
          const prereqText = prereqs.prerequisites || ''
          const prereqCodes = prereqText.match(/[A-Z]{2,5}\s+\d{1,3}[A-Z]*/g) || []
          const unmet = hasCompleted
            ? prereqCodes.filter((code) => !hasCompleted(code))
            : []
          const hasUnmet = hasCompleted && unmet.length > 0

          return (
            <div className={`px-4 py-2.5 border-b border-border/50 ${hasUnmet ? 'bg-red/4' : 'bg-surface/30'}`}>
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
                <div className="mt-2 flex items-start gap-2 bg-red/8 border border-red/15 rounded-lg px-3 py-2">
                  <span className="text-red text-sm shrink-0">&#9888;</span>
                  <div>
                    <div className="text-[12px] text-red font-medium">Missing prerequisites</div>
                    <div className="text-[11px] text-muted mt-0.5">
                      You need to complete {unmet.join(', ')} first.
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
            isWatching={isWatching}
            onWatch={onWatch ? (sid, _cc, sec, meta) => onWatch(sid, course.course_code, sec, { ...meta, title: course.title, units: course.units }) : undefined}
            onUnwatch={onUnwatch ? (sid, _cc, sec) => onUnwatch(sid, course.course_code, sec) : undefined}
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
          Select sections ({selected.size} selected)
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="font-mono text-[11px] px-2.5 py-1 rounded-lg text-muted hover:text-text
              bg-surface border border-border hover:border-border2 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={selected.size === 0}
            className="font-mono text-[11px] px-3 py-1 rounded-lg font-medium
              bg-green/12 text-green border border-green/15 hover:bg-green/20
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Add {selected.size}
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer
                ${isSelected
                  ? 'bg-accent/6 border border-accent/15'
                  : 'bg-surface/30 border border-transparent hover:border-border'
                }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0
                ${isSelected ? 'bg-accent border-accent' : 'border-dim'}`}>
                {isSelected && <span className="text-white text-[10px]">&#10003;</span>}
              </div>
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={typeColor
                  ? { background: typeColor.bg, color: typeColor.text }
                  : { background: 'rgba(122,130,160,0.15)', color: '#7a82a0' }}
              >
                {s.type}
              </span>
              <span className="font-mono text-[11px] text-muted w-10 shrink-0">{s.section}</span>
              <span className="text-[12px] text-text w-28 shrink-0">{s.days} {s.time}</span>
              <span className="text-[12px] text-muted w-24 shrink-0">{s.building} {s.room}</span>
              <span className="text-[12px] text-muted flex-1 truncate">{s.instructor || 'TBA'}</span>
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
