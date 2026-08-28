import { useMemo } from 'react'
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window'
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
  isWatching?: (sectionId: string) => boolean
  onWatch?: (sectionId: string, courseCode: string, section: string, meta?: Record<string, unknown>) => void
  onUnwatch?: (sectionId: string, courseCode: string, section: string) => void
}

// Threshold below which we use a plain flat render — virtualization adds a measure pass per
// row that's wasteful when the list is small. Above this, switch to react-window so DOM stays
// thin even with the full ~7k-course "All Departments" view.
const VIRTUALIZE_THRESHOLD = 80

// Fallback row height before useDynamicRowHeight measures the real one. Picked to roughly
// match a collapsed CourseCard so the initial paint doesn't visibly thrash.
const DEFAULT_ROW_HEIGHT = 86

type CardProps = Omit<CourseListProps, 'courses'> & { courses: Course[] }

function Row({ index, style, courses, ...cardProps }: RowComponentProps<CardProps>) {
  const c = courses[index]
  return (
      <div style={style} className="pb-3.5">
      <CourseCard
        course={c}
        index={index}
        onAddToSchedule={cardProps.onAddToSchedule}
        isInSchedule={cardProps.hasCourse?.(c.course_code)}
        hasSection={cardProps.hasSection}
        hasCompleted={cardProps.hasCompleted}
        getRating={cardProps.getRating}
        isWatching={cardProps.isWatching}
        onWatch={cardProps.onWatch}
        onUnwatch={cardProps.onUnwatch}
      />
    </div>
  )
}

export function CourseList(props: CourseListProps) {
  const { courses } = props

  // Cache keyed by length+first/last code so the dynamic-height map is invalidated when the
  // filtered list changes shape. Without a key swap, expanding a card on "ALL Departments"
  // would carry that measurement into a filtered subset.
  const measureKey = useMemo(
    () => `${courses.length}-${courses[0]?.course_code ?? ''}-${courses[courses.length - 1]?.course_code ?? ''}`,
    [courses],
  )
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: DEFAULT_ROW_HEIGHT, key: measureKey })

  if (courses.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <h3 className="text-base font-medium text-text mb-2">No courses found</h3>
        <p className="text-[13px] text-muted">Try adjusting your search or filters.</p>
      </div>
    )
  }

  // Small lists: plain render. No measurement overhead, smoother scroll near the top.
  if (courses.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div className="flex flex-col gap-3.5" data-testid="course-list">
        {courses.map((c, i) => (
          <CourseCard
            key={`${c.course_code}-${i}`}
            course={c}
            index={i}
            onAddToSchedule={props.onAddToSchedule}
            isInSchedule={props.hasCourse?.(c.course_code)}
            hasSection={props.hasSection}
            hasCompleted={props.hasCompleted}
            getRating={props.getRating}
            isWatching={props.isWatching}
            onWatch={props.onWatch}
            onUnwatch={props.onUnwatch}
          />
        ))}
      </div>
    )
  }

  // Large lists: virtualize. The List sizes itself to fit its scrolling parent — the Browse
  // view already gives us a scroll container, so we expand to fill that.
  return (
    <div className="h-full min-h-[320px]" data-testid="course-list">
      <List<CardProps>
        rowCount={courses.length}
        rowHeight={rowHeight}
        rowComponent={Row}
        rowProps={props as CardProps}
        overscanCount={4}
        defaultHeight={600}
        style={{ height: '100%' }}
      />
    </div>
  )
}
