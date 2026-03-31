import type { Course } from '../types'
import { CourseCard } from './CourseCard'
import type { SavedCourse } from '../hooks/useMySchedule'
import type { RmpRating } from '../hooks/useRmpRatings'

interface CourseListProps {
  courses: Course[]
  onAddToSchedule?: (course: SavedCourse) => void
  hasCourse?: (courseCode: string) => boolean
  hasSection?: (courseCode: string, sectionCode: string, sectionType: string) => boolean
  hasCompleted?: (courseCode: string) => boolean
  getRating?: (instructor: string) => RmpRating | null | undefined
}

export function CourseList({ courses, onAddToSchedule, hasCourse, hasSection, hasCompleted, getRating }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <h3 className="text-base font-medium text-text mb-2">No courses found</h3>
        <p className="text-[13px] text-muted">Try adjusting your search or filters.</p>
      </div>
    )
  }

  const visible = courses.slice(0, 300)

  return (
    <div className="flex flex-col gap-3" data-testid="course-list">
      {visible.map((c, i) => (
        <CourseCard
          key={`${c.course_code}-${i}`}
          course={c}
          index={i}
          onAddToSchedule={onAddToSchedule}
          isInSchedule={hasCourse?.(c.course_code)}
          hasSection={hasSection}
          hasCompleted={hasCompleted}
          getRating={getRating}
        />
      ))}
      {courses.length > 300 && (
        <div className="text-center py-8 text-muted text-[13px]">
          Showing first 300 of {courses.length.toLocaleString()} courses — narrow your search to see more.
        </div>
      )}
    </div>
  )
}
