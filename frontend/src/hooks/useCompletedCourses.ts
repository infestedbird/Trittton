import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'ucsd-completed-courses'

export interface CompletedCourse {
  course_code: string
  title: string
}

function loadFromStorage(): CompletedCourse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useCompletedCourses() {
  const [completed, setCompleted] = useState<CompletedCourse[]>(loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed))
  }, [completed])

  const addCourse = useCallback((course: CompletedCourse) => {
    setCompleted((prev) => {
      if (prev.some((c) => c.course_code === course.course_code)) return prev
      return [...prev, course].sort((a, b) => a.course_code.localeCompare(b.course_code))
    })
  }, [])

  const removeCourse = useCallback((courseCode: string) => {
    setCompleted((prev) => prev.filter((c) => c.course_code !== courseCode))
  }, [])

  const clearAll = useCallback(() => {
    setCompleted([])
  }, [])

  const hasCompleted = useCallback(
    (courseCode: string) => completed.some((c) => c.course_code === courseCode),
    [completed],
  )

  // Get a formatted string for the AI context
  const asContextString = useCallback(() => {
    if (completed.length === 0) return ''
    return completed.map((c) => c.course_code).join(', ')
  }, [completed])

  return { completed, addCourse, removeCourse, clearAll, hasCompleted, asContextString }
}
