import { useState, useEffect, useCallback, useRef } from 'react'
import type { Course } from '../types'

export interface RmpRating {
  name: string
  rating: number
  difficulty: number
  wouldTakeAgain: number
  numRatings: number
  rmpUrl: string
}

// Keep ratings useful without letting a full TSS catalog trigger hundreds of
// background requests. Searching or filtering changes `courses`, so relevant
// instructors outside this initial window are fetched when the user narrows in.
const MAX_INSTRUCTORS_PER_VIEW = 60
const PREFETCH_DELAY_MS = 700

export function useRmpRatings(courses: Course[]) {
  const [ratings, setRatings] = useState<Record<string, RmpRating | null>>({})
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(new Set<string>())

  useEffect(() => {
    if (courses.length === 0) return

    let cancelled = false

    // Collect unique instructors
    const allInstructors = new Set<string>()
    for (const c of courses) {
      for (const s of c.sections) {
        const name = s.instructor?.trim()
        if (name && name !== 'TBA' && name !== 'Staff' && name.length > 2) {
          allInstructors.add(name)
        }
      }
    }

    // Filter out already fetched
    const toFetch = Array.from(allInstructors)
      .filter((i) => !fetchedRef.current.has(i))
      .slice(0, MAX_INSTRUCTORS_PER_VIEW)
    if (toFetch.length === 0) return

    // Fetch in batches of 25
    const fetchBatch = async (batch: string[]) => {
      try {
        const res = await fetch('/api/rmp/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructors: batch }),
        })
        if (!res.ok) return
        const data: Record<string, RmpRating | null> = await res.json()
        if (!cancelled) setRatings((prev) => ({ ...prev, ...data }))
      } catch { /* silent */ }
    }

    // Let the catalog paint and become interactive before secondary lookups.
    const timer = window.setTimeout(() => {
      if (cancelled) return
      for (const instructor of toFetch) fetchedRef.current.add(instructor)
      const batches: string[][] = []
      for (let i = 0; i < toFetch.length; i += 25) batches.push(toFetch.slice(i, i + 25))
      setLoading(true)
      Promise.all(batches.map(fetchBatch)).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, PREFETCH_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [courses])

  const getRating = useCallback((instructor: string): RmpRating | null | undefined => {
    return ratings[instructor] ?? ratings[instructor?.trim()]
  }, [ratings])

  return { ratings, getRating, loading }
}
