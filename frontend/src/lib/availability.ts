import type { Course, AvailabilityStatus } from '../types'

export function courseAvailStatus(course: Course): { status: AvailabilityStatus; seats: number } {
  let totalAvail = 0
  let hasWait = false

  for (const s of course.sections) {
    const a = parseInt(s.available) || 0
    const w = parseInt(s.waitlisted) || 0
    totalAvail += a
    if (w > 0) hasWait = true
  }

  if (totalAvail > 0) return { status: 'open', seats: totalAvail }
  if (hasWait) return { status: 'waitlist', seats: 0 }
  return { status: 'full', seats: 0 }
}
