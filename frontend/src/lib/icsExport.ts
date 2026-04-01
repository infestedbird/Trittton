import type { SavedCourse } from '../hooks/useMySchedule'
import { parseDays, parseTime } from './schedule'
import { TERM_OPTIONS } from './links'

// Quarter start dates and end dates (instruction periods)
const TERM_DATES: Record<string, { start: string; end: string }> = {
  FA25: { start: '2025-09-25', end: '2025-12-05' },
  WI26: { start: '2026-01-05', end: '2026-03-13' },
  SP26: { start: '2026-03-30', end: '2026-06-05' },
  S126: { start: '2026-06-29', end: '2026-07-31' },
  S226: { start: '2026-08-03', end: '2026-09-04' },
  FA26: { start: '2026-09-24', end: '2026-12-04' },
  WI27: { start: '2027-01-04', end: '2027-03-12' },
}

const DAY_TO_RRULE: Record<string, string> = {
  Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU',
}

const DAY_TO_OFFSET: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function toICSDate(dateStr: string, hours: number, minutes: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hours)}${pad(minutes)}00`
}

function findFirstDayOnOrAfter(startDate: string, targetDayOffset: number): string {
  const d = new Date(startDate + 'T00:00:00')
  const currentDay = d.getDay()
  let diff = targetDayOffset - currentDay
  if (diff < 0) diff += 7
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@trittton`
}

export function generateICS(schedule: SavedCourse[], term: string, email: string): string {
  const termDates = TERM_DATES[term]
  const termLabel = TERM_OPTIONS.find((t) => t.value === term)?.label || term

  if (!termDates) {
    // Fallback: just create single events without recurrence
    return generateSimpleICS(schedule, termLabel, email)
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trittton//UCSD Course Browser//EN',
    `X-WR-CALNAME:UCSD ${termLabel}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const endDateForRrule = new Date(termDates.end + 'T23:59:59')
  const untilStr = `${endDateForRrule.getFullYear()}${pad(endDateForRrule.getMonth() + 1)}${pad(endDateForRrule.getDate())}T235959Z`

  for (const course of schedule) {
    for (const sec of course.sections) {
      const days = parseDays(sec.days)
      const time = parseTime(sec.time)
      if (!time || days.length === 0) continue

      const startHour = Math.floor(time.start)
      const startMin = Math.round((time.start - startHour) * 60)
      const endHour = Math.floor(time.end)
      const endMin = Math.round((time.end - endHour) * 60)

      // RRULE days
      const rruleDays = days.map((d) => DAY_TO_RRULE[d]).filter(Boolean).join(',')

      // Find the first occurrence date (first matching day on or after term start)
      const firstDay = days[0]
      const firstDate = findFirstDayOnOrAfter(termDates.start, DAY_TO_OFFSET[firstDay])

      const dtstart = toICSDate(firstDate, startHour, startMin)
      const dtend = toICSDate(firstDate, endHour, endMin)

      const location = [sec.building, sec.room].filter(Boolean).join(' ')
      const description = `${course.course_code} - ${course.title}\\n${sec.type} ${sec.section}\\nInstructor: ${sec.instructor || 'TBA'}\\n${course.units} units`

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid()}`)
      lines.push(`DTSTART;TZID=America/Los_Angeles:${dtstart}`)
      lines.push(`DTEND;TZID=America/Los_Angeles:${dtend}`)
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${rruleDays};UNTIL=${untilStr}`)
      lines.push(`SUMMARY:${course.course_code} ${sec.type} ${sec.section}`)
      lines.push(`DESCRIPTION:${description}`)
      if (location) lines.push(`LOCATION:${location} - UC San Diego`)
      if (email) lines.push(`ATTENDEE;RSVP=TRUE:mailto:${email}`)
      lines.push(`STATUS:CONFIRMED`)
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function generateSimpleICS(schedule: SavedCourse[], termLabel: string, email: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trittton//UCSD Course Browser//EN',
    `X-WR-CALNAME:UCSD ${termLabel}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  for (const course of schedule) {
    for (const sec of course.sections) {
      const time = parseTime(sec.time)
      if (!time) continue

      const startHour = Math.floor(time.start)
      const startMin = Math.round((time.start - startHour) * 60)
      const endHour = Math.floor(time.end)
      const endMin = Math.round((time.end - endHour) * 60)

      const location = [sec.building, sec.room].filter(Boolean).join(' ')

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${uid()}`)
      lines.push(`DTSTART;TZID=America/Los_Angeles:${toICSDate(dateStr, startHour, startMin)}`)
      lines.push(`DTEND;TZID=America/Los_Angeles:${toICSDate(dateStr, endHour, endMin)}`)
      lines.push(`SUMMARY:${course.course_code} ${sec.type} ${sec.section}`)
      lines.push(`DESCRIPTION:${course.course_code} - ${course.title}`)
      if (location) lines.push(`LOCATION:${location} - UC San Diego`)
      if (email) lines.push(`ATTENDEE;RSVP=TRUE:mailto:${email}`)
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(schedule: SavedCourse[], term: string, email: string) {
  const termLabel = TERM_OPTIONS.find((t) => t.value === term)?.label || term
  const ics = generateICS(schedule, term, email)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ucsd-schedule-${termLabel.replace(/\s+/g, '-').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
