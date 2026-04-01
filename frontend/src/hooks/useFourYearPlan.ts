import { useState, useCallback, useEffect } from 'react'

export interface PlannedCourse {
  course_code: string
  title: string
  units: number
}

export interface QuarterPlan {
  quarter: string    // e.g. "FA26", "WI27"
  label: string      // e.g. "Fall 2026"
  courses: PlannedCourse[]
}

export type FourYearPlan = QuarterPlan[]

const STORAGE_KEY = 'ucsd-four-year-plan'

// Generate all quarters for 4 academic years starting from the current quarter
export function generateQuarters(): QuarterPlan[] {
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()

  // Determine the current academic year start
  // UCSD academic year: Fall (Sep) -> Winter (Jan) -> Spring (Mar) -> Summer (Jun-Aug)
  // If we're in Jan-Aug, the academic year started the previous fall
  let startYear = month >= 8 ? year : year - 1

  const quarters: QuarterPlan[] = []
  for (let y = 0; y < 4; y++) {
    const academicYear = startYear + y
    // Fall of academicYear, then Winter/Spring/Summer of academicYear+1
    const fallYr = academicYear
    const restYr = academicYear + 1
    const fallSuffix = String(fallYr).slice(2)
    const restSuffix = String(restYr).slice(2)

    quarters.push({ quarter: `FA${fallSuffix}`, label: `Fall ${fallYr}`, courses: [] })
    quarters.push({ quarter: `WI${restSuffix}`, label: `Winter ${restYr}`, courses: [] })
    quarters.push({ quarter: `SP${restSuffix}`, label: `Spring ${restYr}`, courses: [] })
    quarters.push({ quarter: `S1${restSuffix}`, label: `Summer I ${restYr}`, courses: [] })
    quarters.push({ quarter: `S2${restSuffix}`, label: `Summer II ${restYr}`, courses: [] })
  }

  return quarters
}

function loadFromStorage(): FourYearPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return generateQuarters()
    const saved: FourYearPlan = JSON.parse(raw)
    // Merge with fresh quarters to handle any new quarters not in storage
    const fresh = generateQuarters()
    return fresh.map((q) => {
      const existing = saved.find((s) => s.quarter === q.quarter)
      return existing ? { ...q, courses: existing.courses } : q
    })
  } catch {
    return generateQuarters()
  }
}

export function useFourYearPlan() {
  const [plan, setPlan] = useState<FourYearPlan>(loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  }, [plan])

  const addCourse = useCallback((quarter: string, course: PlannedCourse) => {
    setPlan((prev) =>
      prev.map((q) => {
        if (q.quarter !== quarter) return q
        if (q.courses.some((c) => c.course_code === course.course_code)) return q
        return { ...q, courses: [...q.courses, course] }
      })
    )
  }, [])

  const removeCourse = useCallback((quarter: string, courseCode: string) => {
    setPlan((prev) =>
      prev.map((q) => {
        if (q.quarter !== quarter) return q
        return { ...q, courses: q.courses.filter((c) => c.course_code !== courseCode) }
      })
    )
  }, [])

  const moveCourse = useCallback((fromQuarter: string, toQuarter: string, courseCode: string) => {
    setPlan((prev) => {
      const course = prev.find((q) => q.quarter === fromQuarter)?.courses.find((c) => c.course_code === courseCode)
      if (!course) return prev
      return prev.map((q) => {
        if (q.quarter === fromQuarter) {
          return { ...q, courses: q.courses.filter((c) => c.course_code !== courseCode) }
        }
        if (q.quarter === toQuarter) {
          if (q.courses.some((c) => c.course_code === courseCode)) return q
          return { ...q, courses: [...q.courses, course] }
        }
        return q
      })
    })
  }, [])

  const clearQuarter = useCallback((quarter: string) => {
    setPlan((prev) =>
      prev.map((q) => (q.quarter === quarter ? { ...q, courses: [] } : q))
    )
  }, [])

  const clearAll = useCallback(() => {
    setPlan(generateQuarters())
  }, [])

  const totalUnits = plan.reduce((sum, q) => sum + q.courses.reduce((s, c) => s + c.units, 0), 0)

  return { plan, addCourse, removeCourse, moveCourse, clearQuarter, clearAll, totalUnits }
}
