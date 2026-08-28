import { useState, useCallback, useEffect, useRef } from 'react'

export interface SeatAlert {
  section_id: string
  course_code: string
  section: string
  available: number
  waitlist_available?: number
  kind?: 'seat' | 'waitlist'
  timestamp: number
}

export interface WatchInfo {
  course_code: string
  section: string
  term: string
  last_available: number
  last_waitlist_available?: number
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

export function useSeatWatch(term: string, uid: string | null = null) {
  // Initialize watches from localStorage immediately so UI shows them
  const [watches, setWatches] = useState<Record<string, WatchInfo>>(() => localToWatchInfo(loadLocal()))
  const [alerts, setAlerts] = useState<SeatAlert[]>([])
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Build a query string with the uid, used on every GET request.
  const uidQuery = uid ? `?uid=${encodeURIComponent(uid)}` : ''

  // Re-register watches from localStorage on mount + sync with server.
  // We re-run when the uid changes so a sign-in after the watches were loaded still gets
  // them registered with the user's server-side bucket.
  useEffect(() => {
    const saved = loadLocal()
    const entries = Object.entries(saved)
    if (entries.length === 0) return

    for (const [sectionId, info] of entries) {
      fetch('/api/watch/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, uid, ...info }),
      }).catch(() => {})
    }

    fetch(`/api/watch/list${uidQuery}`)
      .then(r => r.json())
      .then(data => { if (data.watches && Object.keys(data.watches).length > 0) setWatches(data.watches) })
      .catch(() => {})
  }, [uid, uidQuery])

  // Poll for alerts — only when there are active watches, at 30s intervals.
  //
  // The previous effect listed `Object.keys(watches).length` in its dep array, which
  // recreated the entire setInterval on EVERY single watches update. If an alert was
  // about to fire from the old interval, it was torn down + a new one started, so
  // alerts could be silently missed during the 30s window. Now we hold the polling
  // state in refs and only re-run the effect when the watches set crosses from
  // "empty" to "non-empty" (and vice versa).
  const watchesRef = useRef(watches)
  const notifPermissionRef = useRef(notifPermission)
  const uidQueryRef = useRef(uidQuery)

  useEffect(() => {
    watchesRef.current = watches
    notifPermissionRef.current = notifPermission
    uidQueryRef.current = uidQuery
  }, [watches, notifPermission, uidQuery])

  const hasAnyWatches = Object.keys(watches).length > 0 || Object.keys(loadLocal()).length > 0

  useEffect(() => {
    if (!hasAnyWatches) return

    const tick = () => {
      // No watches left → silence the timer.
      if (Object.keys(watchesRef.current).length === 0 && Object.keys(loadLocal()).length === 0) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        return
      }
      const q = uidQueryRef.current
      fetch(`/api/watch/alerts${q}`)
        .then(r => r.json())
        .then(data => {
          if (data.alerts?.length) {
            setAlerts(prev => [...prev, ...data.alerts])
            for (const alert of data.alerts) {
              if (notifPermissionRef.current === 'granted') {
                const isWaitlist = alert.kind === 'waitlist'
                new Notification(isWaitlist ? 'TSS Waitlist Available!' : 'TSS Seat Available!', {
                  body: isWaitlist
                    ? `${alert.course_code} ${alert.section} has ${alert.waitlist_available} waitlist spot${alert.waitlist_available !== 1 ? 's' : ''}`
                    : `${alert.course_code} ${alert.section} now has ${alert.available} seat${alert.available !== 1 ? 's' : ''}`,
                  icon: '/favicon.svg',
                  tag: `seat-${alert.section_id}`,
                })
              }
            }
          }
        })
        .catch(() => {})

      fetch(`/api/watch/list${q}`)
        .then(r => r.json())
        .then(data => { if (data.watches && Object.keys(data.watches).length > 0) setWatches(data.watches) })
        .catch(() => {})
    }
    pollRef.current = setInterval(tick, 30_000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [hasAnyWatches])

  const addWatch = useCallback(async (sectionId: string, courseCode: string, section: string, meta?: {
    title?: string; units?: string; type?: string; days?: string; time?: string; instructor?: string; limit?: number; waitlisted?: number
  }) => {
    const newWatch: WatchInfo = { course_code: courseCode, section, term, last_available: 0, limit: meta?.limit || 0, watchers: 1,
      title: meta?.title, units: meta?.units, type: meta?.type, days: meta?.days, time: meta?.time, instructor: meta?.instructor, waitlisted: meta?.waitlisted }
    setWatches(prev => ({ ...prev, [sectionId]: newWatch }))

    const saved = loadLocal()
    saved[sectionId] = { course_code: courseCode, section, term, ...meta }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    try {
      await fetch('/api/watch/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, course_code: courseCode, section, term, uid }),
      })
      const res = await fetch(`/api/watch/list${uidQuery}`)
      const data = await res.json()
      if (data.watches && Object.keys(data.watches).length > 0) setWatches(data.watches)
    } catch {
      // Server down — local state already updated, will sync later
    }
  }, [term, uid, uidQuery])

  const removeWatch = useCallback(async (sectionId: string, courseCode: string, section: string) => {
    setWatches(prev => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })

    const saved = loadLocal()
    delete saved[sectionId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    try {
      await fetch('/api/watch/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId, course_code: courseCode, section, term, uid }),
      })
    } catch {
      // Server down — local state already updated
    }
  }, [term, uid])

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
