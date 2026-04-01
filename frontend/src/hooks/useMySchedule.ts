import { useState, useCallback, useEffect } from 'react'
import type { ScheduleProposal } from '../lib/schedule'
import { TERM_OPTIONS } from '../lib/links'

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

// Stores all terms' schedules: { "SP26": [...], "FA26": [...], ... }
type AllSchedules = Record<string, SavedCourse[]>

const STORAGE_KEY = 'ucsd-my-schedules'

function loadAllFromStorage(): AllSchedules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // Migrate old single-schedule format
    const legacy = localStorage.getItem('ucsd-my-schedule')
    if (legacy) {
      const courses = JSON.parse(legacy)
      if (Array.isArray(courses) && courses.length > 0) {
        const defaultTerm = localStorage.getItem('ucsd-term') || 'SP26'
        localStorage.removeItem('ucsd-my-schedule')
        return { [defaultTerm]: courses }
      }
    }
    return {}
  } catch {
    return {}
  }
}

export function useMySchedule(currentTerm: string) {
  const [allSchedules, setAllSchedules] = useState<AllSchedules>(loadAllFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSchedules))
  }, [allSchedules])

  // Current term's schedule
  const schedule = allSchedules[currentTerm] || []

  const setSchedule = useCallback((updater: (prev: SavedCourse[]) => SavedCourse[]) => {
    setAllSchedules((all) => ({
      ...all,
      [currentTerm]: updater(all[currentTerm] || []),
    }))
  }, [currentTerm])

  const addCourse = useCallback((course: SavedCourse) => {
    setSchedule((prev) => {
      if (prev.some((c) => c.course_code === course.course_code)) {
        return prev.map((c) => (c.course_code === course.course_code ? course : c))
      }
      return [...prev, course]
    })
  }, [setSchedule])

  const removeCourse = useCallback((courseCode: string) => {
    setSchedule((prev) => prev.filter((c) => c.course_code !== courseCode))
  }, [setSchedule])

  const clearSchedule = useCallback(() => {
    setSchedule(() => [])
  }, [setSchedule])

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
  }, [setSchedule])

  const termLabel = TERM_OPTIONS.find((t) => t.value === currentTerm)?.label || currentTerm

  const asProposal: ScheduleProposal = {
    quarter: termLabel,
    total_units: schedule.reduce((s, c) => s + c.units, 0),
    courses: schedule,
  }

  const addSection = useCallback((courseCode: string, title: string, units: number, section: SavedCourse['sections'][0]) => {
    setSchedule((prev) => {
      const existing = prev.find((c) => c.course_code === courseCode)
      if (existing) {
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
  }, [setSchedule])

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
  }, [setSchedule])

  const hasCourse = useCallback(
    (courseCode: string) => schedule.some((c) => c.course_code === courseCode),
    [schedule],
  )

  const hasSection = useCallback(
    (courseCode: string, sectionCode: string, sectionType: string) =>
      schedule.some((c) => c.course_code === courseCode && c.sections.some((s) => s.section === sectionCode && s.type === sectionType)),
    [schedule],
  )

  // Get count of all courses across all terms (for header badge)
  const totalCount = schedule.length

  return { schedule, allSchedules, asProposal, addCourse, removeCourse, clearSchedule, addFromProposal, hasCourse, hasSection, addSection, removeSection, totalCount }
}
