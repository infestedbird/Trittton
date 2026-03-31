import { useState, useCallback } from 'react'
import type { Course } from '../types'

export function useCourseData() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFromFile = useCallback((file: File) => {
    setIsLoading(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!Array.isArray(data)) throw new Error('Expected an array of courses')
        setCourses(data)
        setIsLoaded(true)
      } catch {
        setError('Could not parse JSON — make sure it\'s a valid all_courses.json file.')
      } finally {
        setIsLoading(false)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file.')
      setIsLoading(false)
    }
    reader.readAsText(file)
  }, [])

  const loadFromServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/courses')
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Expected an array of courses')
      setCourses(data)
      setIsLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load from server')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Silent auto-load: tries server, returns true/false without setting error state
  const autoLoad = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/courses')
      if (!res.ok) return false
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) return false
      setCourses(data)
      setIsLoaded(true)
      return true
    } catch {
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadFromData = useCallback((data: Course[]) => {
    setCourses(data)
    setIsLoaded(true)
    setError(null)
  }, [])

  return { courses, isLoaded, isLoading, error, loadFromFile, loadFromServer, autoLoad, loadFromData }
}
