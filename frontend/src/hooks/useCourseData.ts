import { useState, useCallback, useEffect } from 'react'
import type { Course } from '../types'
import { idbGet, idbSet } from '../lib/idbCache'
import { isTssTerm } from '../lib/links'

// Per-term cache key so switching terms doesn't show stale data from another quarter.
function cacheKey(term?: string): string {
  return `courses:${term || 'current'}`
}

export function useCourseData(term: string) {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadedTerm, setLoadedTerm] = useState<string | null>(null)
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
        setLoadedTerm(term)
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
  }, [term])

  const loadFromServer = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses?term=${encodeURIComponent(term)}`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Expected an array of courses')
      setCourses(data)
      setIsLoaded(true)
      setLoadedTerm(term)
      // Update the cache so subsequent cold loads are instant.
      idbSet(cacheKey(term), data, res.headers.get('ETag') ?? undefined).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load from server')
    } finally {
      setIsLoading(false)
    }
  }, [term])

  // Silent auto-load — first try IndexedDB so the UI is interactive within ~50ms even on a
  // cold load. Then revalidate from the server in the background. If the cache is empty we
  // fall back to a bounded server fetch (longer for the paged TSS catalog).
  const autoLoad = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    let usedCache = false
    try {
      const cached = await idbGet<Course[]>(cacheKey(term))
      if (cached && Array.isArray(cached.value) && cached.value.length > 0) {
        setCourses(cached.value)
        setIsLoaded(true)
        setLoadedTerm(term)
        setIsLoading(false)
        usedCache = true
        // Background revalidation. If the server responds with fresh data, swap it in
        // silently. Network failures are non-fatal here because we already have data.
        ;(async () => {
          try {
            const headers: HeadersInit = cached.etag ? { 'If-None-Match': cached.etag } : {}
            const res = await fetch(`/api/courses?term=${encodeURIComponent(term)}`, { headers })
            if (res.status === 304) return // unchanged
            if (!res.ok) return
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
              setCourses(data)
              setLoadedTerm(term)
              idbSet(cacheKey(term), data, res.headers.get('ETag') ?? undefined).catch(() => {})
            }
          } catch { /* offline — keep using cache */ }
        })()
        return true
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), isTssTerm(term) ? 20_000 : 3_000)
      const res = await fetch(`/api/courses?term=${encodeURIComponent(term)}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return false
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) return false
      setCourses(data)
      setIsLoaded(true)
      setLoadedTerm(term)
      idbSet(cacheKey(term), data, res.headers.get('ETag') ?? undefined).catch(() => {})
      return true
    } catch {
      return usedCache
    } finally {
      if (!usedCache) setIsLoading(false)
    }
  }, [term])

  const loadFromData = useCallback((data: Course[]) => {
    setCourses(data)
    setIsLoaded(true)
    setLoadedTerm(term)
    setError(null)
    idbSet(cacheKey(term), data).catch(() => {})
  }, [term])

  // TSS availability changes throughout enrollment. Revalidate the complete
  // catalog every minute; ETags avoid downloading unchanged data, while the
  // server's shared cache prevents every browser from refetching all UCSD pages.
  // Watched sections still use the faster targeted 45-second tracker.
  useEffect(() => {
    if (!isTssTerm(term)) return
    let cancelled = false

    const revalidate = async () => {
      try {
        const cached = await idbGet<Course[]>(cacheKey(term))
        const headers: HeadersInit = cached?.etag ? { 'If-None-Match': cached.etag } : {}
        const res = await fetch(`/api/courses?term=${encodeURIComponent(term)}`, {
          headers,
          cache: 'no-cache',
        })
        if (cancelled || res.status === 304 || !res.ok) return
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0 || cancelled) return
        setCourses(data)
        setIsLoaded(true)
        setLoadedTerm(term)
        idbSet(cacheKey(term), data, res.headers.get('ETag') ?? undefined).catch(() => {})
      } catch { /* keep the last verified snapshot while offline */ }
    }

    const interval = window.setInterval(revalidate, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [term])

  return { courses, isLoaded: isLoaded && loadedTerm === term, isLoading, error, loadFromFile, loadFromServer, autoLoad, loadFromData }
}
