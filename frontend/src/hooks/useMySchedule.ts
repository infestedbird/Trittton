import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ScheduleProposal } from '../lib/schedule'
import type { Course } from '../types'
import { TERM_OPTIONS, courseCodeToSubject } from '../lib/links'
import { useCloudSync, type CloudSyncStatus } from './useCloudSync'
import { sectionAvailStatus } from '../lib/availability'

export interface SavedCourse {
  course_code: string
  title: string
  units: number
  subject: string
  sections: {
    section_id?: string
    type: string
    section: string
    days: string
    time: string
    building: string
    room: string
    instructor: string
    available: number
    limit: number
    waitlisted?: number
    waitlist_available?: number | null
    status?: string | null
    event_package_ids?: string[]
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
        const defaultTerm = localStorage.getItem('ucsd-term') || 'FA26'
        localStorage.removeItem('ucsd-my-schedule')
        return { [defaultTerm]: courses }
      }
    }
    return {}
  } catch {
    return {}
  }
}

export function useMySchedule(currentTerm: string, uid: string | null = null) {
  const [allSchedules, setAllSchedules] = useState<AllSchedules>(loadAllFromStorage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allSchedules))
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        // Storage full — surface to console so user sees something instead of a silent crash
        console.warn('[useMySchedule] localStorage quota exceeded; schedule changes will not persist until storage is cleared.')
      }
    }
  }, [allSchedules])

  const cloudStatus: CloudSyncStatus = useCloudSync<AllSchedules>({
    uid,
    key: 'my-schedules',
    value: allSchedules,
    applyRemote: (remote) => setAllSchedules(remote || {}),
  })

  // Current term's schedule
  const schedule = useMemo(() => allSchedules[currentTerm] || [], [allSchedules, currentTerm])

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
          subject: courseCodeToSubject(course.course_code),
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
        subject: courseCodeToSubject(courseCode),
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

  // Restore a previous schedule snapshot — used by Undo on Clear.
  const restoreSchedule = useCallback((prev: SavedCourse[]) => {
    setSchedule(() => prev)
  }, [setSchedule])

  // Saved plans keep section choices, but seat counts must come from the latest
  // catalog snapshot. This updates availability without replacing the user's
  // selected sections or creating cloud-sync churn when nothing changed.
  const refreshAvailability = useCallback((catalog: Course[]) => {
    const liveCourses = new Map(catalog.map((course) => [normalizeCourseCode(course.course_code), course]))
    setSchedule((prev) => {
      let changed = false
      const next = prev.map((savedCourse) => {
        const liveCourse = liveCourses.get(normalizeCourseCode(savedCourse.course_code))
        if (!liveCourse) return savedCourse

        const sections = savedCourse.sections.map((savedSection) => {
          const liveSection = liveCourse.sections.find((section) =>
            (savedSection.section_id && section.section_id === savedSection.section_id)
            || (section.section === savedSection.section && section.type === savedSection.type),
          )
          if (!liveSection) return savedSection

          const liveAvailability = sectionAvailStatus(liveSection)
          const refreshed = {
            ...savedSection,
            available: liveAvailability.seats,
            limit: Number(liveSection.limit) || 0,
            waitlisted: Number(liveSection.waitlisted) || 0,
            waitlist_available: liveSection.waitlist_available,
            status: liveSection.status,
            event_package_ids: liveSection.event_package_ids,
          }
          if (
            refreshed.available !== savedSection.available
            || refreshed.limit !== savedSection.limit
            || refreshed.waitlisted !== (savedSection.waitlisted || 0)
            || refreshed.waitlist_available !== savedSection.waitlist_available
            || refreshed.status !== savedSection.status
          ) changed = true
          return refreshed
        })
        return sections.some((section, index) => section !== savedCourse.sections[index])
          ? { ...savedCourse, sections }
          : savedCourse
      })
      return changed ? next : prev
    })
  }, [setSchedule])

  return { schedule, allSchedules, asProposal, addCourse, removeCourse, clearSchedule, restoreSchedule, refreshAvailability, addFromProposal, hasCourse, hasSection, addSection, removeSection, totalCount, cloudStatus }
}

function normalizeCourseCode(code: string) {
  return code.replace(/[\s-]+/g, '').toUpperCase().replace(/^([A-Z]+)0+/, '$1')
}
