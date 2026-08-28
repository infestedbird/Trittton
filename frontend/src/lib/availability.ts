import type { Course, AvailabilityStatus } from '../types'

export interface SectionSeatState {
  available?: string | number | null
  waitlisted?: string | number | null
  waitlist_available?: number | null
  status?: string | null
}

export function isWaitlistOnlySection(section: SectionSeatState): boolean {
  return String(section.status || '').trim().toLowerCase() === 'waitlist_only'
}

export function sectionAvailStatus(section: SectionSeatState): { status: AvailabilityStatus; seats: number } {
  if (isWaitlistOnlySection(section)) return { status: 'waitlist', seats: 0 }

  const seats = Number(section.available) || 0
  if (seats > 0) return { status: 'open', seats }
  if ((Number(section.waitlist_available) || 0) > 0 || (Number(section.waitlisted) || 0) > 0) {
    return { status: 'waitlist', seats: 0 }
  }
  return { status: 'full', seats: 0 }
}

export function courseAvailStatus(course: Course): { status: AvailabilityStatus; seats: number } {
  if (course.source === 'tss') {
    const seats = course.open_seat_count || 0
    if (seats > 0) return { status: 'open', seats }
    if ((course.waitlist_available_count || 0) > 0 || course.sections.some(isWaitlistOnlySection)) {
      return { status: 'waitlist', seats: 0 }
    }
    return { status: 'full', seats: 0 }
  }
  const states = course.sections.map(sectionAvailStatus)
  const totalAvail = states.reduce((total, state) => total + state.seats, 0)
  const hasWait = states.some((state) => state.status === 'waitlist')

  if (totalAvail > 0) return { status: 'open', seats: totalAvail }
  if (hasWait) return { status: 'waitlist', seats: 0 }
  return { status: 'full', seats: 0 }
}
