import { useState, useMemo } from 'react'
import type { Course, FilterState } from '../types'
import { courseAvailStatus } from '../lib/availability'

const defaultFilters: FilterState = {
  search: '',
  department: 'ALL',
  sectionType: '',
  availability: '',
}

export function useFilters(courses: Course[]) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  const departments = useMemo(() => {
    const deptMap = new Map<string, number>()
    for (const c of courses) {
      deptMap.set(c.subject, (deptMap.get(c.subject) || 0) + 1)
    }
    return Array.from(deptMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, count]) => ({ code, count }))
  }, [courses])

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim()
    return courses.filter((c) => {
      if (filters.department !== 'ALL' && c.subject !== filters.department) return false

      if (q) {
        const hay = [c.course_code, c.title, c.subject, ...c.sections.map((s) => s.instructor)]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }

      if (filters.sectionType) {
        if (!c.sections.some((s) => s.type === filters.sectionType)) return false
      }

      if (filters.availability) {
        const { status } = courseAvailStatus(c)
        if (filters.availability !== status) return false
      }

      return true
    })
  }, [courses, filters])

  const stats = useMemo(
    () => ({
      totalCourses: courses.length,
      totalSections: courses.reduce((s, c) => s + c.sections.length, 0),
      totalDepts: departments.length,
    }),
    [courses, departments],
  )

  const setSearch = (search: string) => setFilters((f) => ({ ...f, search }))
  const setDepartment = (department: string) => setFilters((f) => ({ ...f, department }))
  const setSectionType = (sectionType: string) => setFilters((f) => ({ ...f, sectionType }))
  const setAvailability = (availability: string) => setFilters((f) => ({ ...f, availability }))

  return {
    filters,
    filtered,
    departments,
    stats,
    setSearch,
    setDepartment,
    setSectionType,
    setAvailability,
  }
}
