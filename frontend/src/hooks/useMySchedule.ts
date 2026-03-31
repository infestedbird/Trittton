import { useState, useCallback, useEffect } from 'react'
import type { ScheduleProposal } from '../lib/schedule'

export interface SavedCourse {
  course_code: string
  title: string
  units: number
  subject: string
  sections: {
    type: string
    section: string
    days: string
    time: string
    building: string
    room: string
    instructor: string
    available: number
    limit: number
  }[]
}

const STORAGE_KEY = 'ucsd-my-schedule'

function loadFromStorage(): SavedCourse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useMySchedule() {
  const [schedule, setSchedule] = useState<SavedCourse[]>(loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule))
  }, [schedule])

  const addCourse = useCallback((course: SavedCourse) => {
    setSchedule((prev) => {
      if (prev.some((c) => c.course_code === course.course_code)) {
        // Replace existing
        return prev.map((c) => (c.course_code === course.course_code ? course : c))
      }
      return [...prev, course]
    })
  }, [])

  const removeCourse = useCallback((courseCode: string) => {
    setSchedule((prev) => prev.filter((c) => c.course_code !== courseCode))
  }, [])

  const clearSchedule = useCallback(() => {
    setSchedule([])
  }, [])

  const addFromProposal = useCallback((proposal: ScheduleProposal) => {
    setSchedule((prev) => {
      const newSchedule = [...prev]
      for (const course of proposal.courses) {
        const saved: SavedCourse = {
          course_code: course.course_code,
          title: course.title,
          units: course.units,
          subject: course.course_code.split(' ')[0],
          sections: course.sections,
        }
        const idx = newSchedule.findIndex((c) => c.course_code === saved.course_code)
        if (idx >= 0) {
          newSchedule[idx] = saved
        } else {
          newSchedule.push(saved)
        }
      }
      return newSchedule
    })
  }, [])

  // Convert to ScheduleProposal for calendar rendering
  const asProposal: ScheduleProposal = {
    quarter: 'Spring 2026',
    total_units: schedule.reduce((s, c) => s + c.units, 0),
    courses: schedule,
  }

  // Add a single section to a course (creates the course entry if needed)
  const addSection = useCallback((courseCode: string, title: string, units: number, section: SavedCourse['sections'][0]) => {
    setSchedule((prev) => {
      const existing = prev.find((c) => c.course_code === courseCode)
      if (existing) {
        // Add section if not already there
        if (existing.sections.some((s) => s.section === section.section && s.type === section.type)) return prev
        return prev.map((c) =>
          c.course_code === courseCode ? { ...c, sections: [...c.sections, section] } : c
        )
      }
      return [...prev, {
        course_code: courseCode,
        title,
        units,
        subject: courseCode.split(' ')[0],
        sections: [section],
      }]
    })
  }, [])

  // Remove a single section from a course (removes course if no sections left)
  const removeSection = useCallback((courseCode: string, sectionCode: string, sectionType: string) => {
    setSchedule((prev) => {
      return prev
        .map((c) => {
          if (c.course_code !== courseCode) return c
          const filtered = c.sections.filter((s) => !(s.section === sectionCode && s.type === sectionType))
          return { ...c, sections: filtered }
        })
        .filter((c) => c.sections.length > 0)
    })
  }, [])

  const hasCourse = useCallback(
    (courseCode: string) => schedule.some((c) => c.course_code === courseCode),
    [schedule],
  )

  const hasSection = useCallback(
    (courseCode: string, sectionCode: string, sectionType: string) =>
      schedule.some((c) => c.course_code === courseCode && c.sections.some((s) => s.section === sectionCode && s.type === sectionType)),
    [schedule],
  )

  return { schedule, asProposal, addCourse, removeCourse, clearSchedule, addFromProposal, hasCourse, hasSection, addSection, removeSection }
}
