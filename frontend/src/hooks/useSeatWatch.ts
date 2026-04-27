import { useState, useCallback, useEffect, useRef } from 'react'

export interface SeatAlert {
  section_id: string
  course_code: string
  section: string
  available: number
  timestamp: number
}

export interface WatchInfo {
  course_code: string
  section: string
  term: string
  last_available: number
  limit: number
  watchers: number
  // Extra metadata stored locally
  title?: string
  units?: string
  type?: string
  days?: string
  time?: string
  instructor?: string
  waitlisted?: number
}

const STORAGE_KEY = 'seat-watches'

interface LocalWatch {
  course_code: string; section: string; term: string
  title?: string; units?: string; type?: string; days?: string; time?: string; instructor?: string
  limit?: number; waitlisted?: number
}

function loadLocal(): Record<string, LocalWatch> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}

function localToWatchInfo(saved: Record<string, LocalWatch>): Record<string, WatchInfo> {
  const result: Record<string, WatchInfo> = {}
  for (const [sid, info] of Object.entries(saved)) {
    result[sid] = { ...info, last_available: 0, limit: info.limit || 0, watchers: 1 }
  }
  return result
}

export function useSeatWatch(term: string) {
  // Initialize watches from localStorage immediately so UI shows them
  const [watches, setWatches] = useState<Record<string, WatchInfo>>(() => localToWatchInfo(loadLocal()))
  const [alerts, setAlerts] = useState<SeatAlert[]>([])
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Re-register watches from localStorage on mount + sync with server
  useEffect(() => {
    const saved = loadLocal()
    const entries = Object.entries(saved)
    if (entries.length === 0) return

    // Re-add watches to server
    for (const [sectionId, info] of entries) {
      fetch('/api/watch/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, ...info }),
      }).catch(() => {})
    }

    // Fetch current state from server (to get last_available updates)
    fetch('/api/watch/list')
      .then(r => r.json())
      .then(data => { if (data.watches && Object.keys(data.watches).length > 0) setWatches(data.watches) })
      .catch(() => {})
  }, [])

  // Poll for alerts — only when there are active watches, at 30s intervals
  const watchCountRef = useRef(Object.keys(loadLocal()).length)
  useEffect(() => {
    watchCountRef.current = Object.keys(watches).length
  }, [watches])

  useEffect(() => {
    // Don't poll if nothing is being watched
    if (Object.keys(loadLocal()).length === 0) return

    pollRef.current = setInterval(() => {
      // Stop polling if all watches were removed mid-interval
      if (watchCountRef.current === 0) {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        return
      }

      fetch('/api/watch/alerts')
        .then(r => r.json())
        .then(data => {
          if (data.alerts?.length) {
            setAlerts(prev => [...prev, ...data.alerts])
            for (const alert of data.alerts) {
              if (notifPermission === 'granted') {
                new Notification('Seat Available!', {
                  body: `${alert.course_code} ${alert.section} now has ${alert.available} seat${alert.available !== 1 ? 's' : ''}`,
                  icon: '/favicon.svg',
                  tag: `seat-${alert.section_id}`,
                })
              }
            }
          }
        })
        .catch(() => {})

      fetch('/api/watch/list')
        .then(r => r.json())
        .then(data => { if (data.watches && Object.keys(data.watches).length > 0) setWatches(data.watches) })
        .catch(() => {})
    }, 30_000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [notifPermission, Object.keys(watches).length])

  const addWatch = useCallback(async (sectionId: string, courseCode: string, section: string, meta?: {
    title?: string; units?: string; type?: string; days?: string; time?: string; instructor?: string; limit?: number; waitlisted?: number
  }) => {
    // Optimistically update local state immediately
    const newWatch: WatchInfo = { course_code: courseCode, section, term, last_available: 0, limit: meta?.limit || 0, watchers: 1,
      title: meta?.title, units: meta?.units, type: meta?.type, days: meta?.days, time: meta?.time, instructor: meta?.instructor, waitlisted: meta?.waitlisted }
    setWatches(prev => ({ ...prev, [sectionId]: newWatch }))

    // Save to localStorage with metadata
    const saved = loadLocal()
    saved[sectionId] = { course_code: courseCode, section, term, ...meta }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    // Send to server
    try {
      await fetch('/api/watch/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, course_code: courseCode, section, term }),
      })
      // Refresh from server to get accurate last_available
      const res = await fetch('/api/watch/list')
      const data = await res.json()
      if (data.watches && Object.keys(data.watches).length > 0) setWatches(data.watches)
    } catch {
      // Server down — local state already updated, will sync later
    }
  }, [term])

  const removeWatch = useCallback(async (sectionId: string, courseCode: string, section: string) => {
    // Optimistically remove from local state
    setWatches(prev => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })

    // Remove from localStorage
    const saved = loadLocal()
    delete saved[sectionId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    // Send to server
    try {
      await fetch('/api/watch/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, course_code: courseCode, section, term }),
      })
    } catch {
      // Server down — local state already updated
    }
  }, [term])

  const isWatching = useCallback((sectionId: string) => {
    return sectionId in watches
  }, [watches])

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
  }, [])

  const dismissAlert = useCallback((index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index))
  }, [])

  const watchCount = Object.keys(watches).length

  return { watches, alerts, watchCount, addWatch, removeWatch, isWatching, requestNotifications, notifPermission, dismissAlert }
}
