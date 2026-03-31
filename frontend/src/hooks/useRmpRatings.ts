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

export function useRmpRatings(courses: Course[]) {
  const [ratings, setRatings] = useState<Record<string, RmpRating | null>>({})
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(new Set<string>())

  useEffect(() => {
    if (courses.length === 0) return

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
    const toFetch = Array.from(allInstructors).filter((i) => !fetchedRef.current.has(i))
    if (toFetch.length === 0) return

    // Mark as fetched to avoid re-requesting
    for (const i of toFetch) fetchedRef.current.add(i)

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
        setRatings((prev) => ({ ...prev, ...data }))
      } catch { /* silent */ }
    }

    setLoading(true)
    // Process batches sequentially
    const batches: string[][] = []
    for (let i = 0; i < toFetch.length; i += 25) {
      batches.push(toFetch.slice(i, i + 25))
    }

    ;(async () => {
      for (const batch of batches) {
        await fetchBatch(batch)
      }
      setLoading(false)
    })()
  }, [courses])

  const getRating = useCallback((instructor: string): RmpRating | null | undefined => {
    return ratings[instructor] ?? ratings[instructor?.trim()]
  }, [ratings])

  return { ratings, getRating, loading }
}
