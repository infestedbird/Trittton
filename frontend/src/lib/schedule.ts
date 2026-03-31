export interface ScheduleSection {
  course_code: string
  title: string
  units: number
  type: string
  section: string
  days: string
  time: string
  building: string
  room: string
  instructor: string
  available: number
  limit: number
  color: string
}

export interface ScheduleProposal {
  quarter: string
  total_units: number
  courses: {
    course_code: string
    title: string
    units: number
    sections: {
      type: string
      section: string
      days: string
      time: string
      building: string
      room: string
      instructor: string
      available: number
      limit: number
    }[]
  }[]
}

const COURSE_COLORS = [
  { bg: 'rgba(79,142,247,0.25)', border: '#4f8ef7', text: '#78a9f7' },
  { bg: 'rgba(61,214,140,0.25)', border: '#3dd68c', text: '#3dd68c' },
  { bg: 'rgba(245,200,66,0.25)', border: '#f5c842', text: '#f5c842' },
  { bg: 'rgba(124,92,252,0.25)', border: '#7c5cfc', text: '#a07cf5' },
  { bg: 'rgba(242,95,92,0.25)', border: '#f25f5c', text: '#f25f5c' },
  { bg: 'rgba(255,159,67,0.25)', border: '#ff9f43', text: '#ff9f43' },
  { bg: 'rgba(0,206,209,0.25)', border: '#00ced1', text: '#00ced1' },
  { bg: 'rgba(255,105,180,0.25)', border: '#ff69b4', text: '#ff69b4' },
]

export function assignColors(courses: ScheduleProposal['courses']): Map<string, typeof COURSE_COLORS[0]> {
  const map = new Map<string, typeof COURSE_COLORS[0]>()
  courses.forEach((c, i) => {
    map.set(c.course_code, COURSE_COLORS[i % COURSE_COLORS.length])
  })
  return map
}

const DAY_MAP: Record<string, string[]> = {
  M: ['Mon'], Tu: ['Tue'], W: ['Wed'], Th: ['Thu'], F: ['Fri'],
  MWF: ['Mon', 'Wed', 'Fri'],
  TuTh: ['Tue', 'Thu'],
  MW: ['Mon', 'Wed'],
  MF: ['Mon', 'Fri'],
  WF: ['Wed', 'Fri'],
}

export function parseDays(days: string): string[] {
  if (DAY_MAP[days]) return DAY_MAP[days]
  // Parse compound: "MWF" → split by known patterns
  const result: string[] = []
  let remaining = days
  const patterns = [
    ['Th', 'Thu'], ['Tu', 'Tue'], ['M', 'Mon'], ['W', 'Wed'], ['F', 'Fri'], ['Sa', 'Sat'], ['Su', 'Sun'],
  ] as const
  for (const [pat, day] of patterns) {
    if (remaining.includes(pat)) {
      result.push(day)
      remaining = remaining.replace(pat, '')
    }
  }
  return result.length > 0 ? result : [days]
}

export function parseTime(time: string): { start: number; end: number } | null {
  // "9:00a-9:50a" or "5:00p-6:20p"
  const match = time.match(/(\d{1,2}):(\d{2})(a|p)-(\d{1,2}):(\d{2})(a|p)/)
  if (!match) return null
  const [, sh, sm, sap, eh, em, eap] = match
  const startH = parseInt(sh) + (sap === 'p' && parseInt(sh) !== 12 ? 12 : 0) + (sap === 'a' && parseInt(sh) === 12 ? -12 : 0)
  const endH = parseInt(eh) + (eap === 'p' && parseInt(eh) !== 12 ? 12 : 0) + (eap === 'a' && parseInt(eh) === 12 ? -12 : 0)
  return {
    start: startH + parseInt(sm) / 60,
    end: endH + parseInt(em) / 60,
  }
}

export interface CalendarBlock {
  courseCode: string
  title: string
  type: string
  section: string
  day: string
  startHour: number
  endHour: number
  time: string
  building: string
  room: string
  instructor: string
  color: typeof COURSE_COLORS[0]
}

export function buildCalendarBlocks(proposal: ScheduleProposal): CalendarBlock[] {
  const colors = assignColors(proposal.courses)
  const blocks: CalendarBlock[] = []

  for (const course of proposal.courses) {
    const color = colors.get(course.course_code) || COURSE_COLORS[0]
    for (const sec of course.sections) {
      const days = parseDays(sec.days)
      const time = parseTime(sec.time)
      if (!time) continue
      for (const day of days) {
        blocks.push({
          courseCode: course.course_code,
          title: course.title,
          type: sec.type,
          section: sec.section,
          day,
          startHour: time.start,
          endHour: time.end,
          time: sec.time,
          building: sec.building,
          room: sec.room,
          instructor: sec.instructor,
          color,
        })
      }
    }
  }
  return blocks
}

export function detectConflicts(blocks: CalendarBlock[]): [CalendarBlock, CalendarBlock][] {
  const conflicts: [CalendarBlock, CalendarBlock][] = []
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i], b = blocks[j]
      if (a.day === b.day && a.startHour < b.endHour && b.startHour < a.endHour) {
        conflicts.push([a, b])
      }
    }
  }
  return conflicts
}

export function parseScheduleJson(content: string): ScheduleProposal | null {
  // Look for ```schedule-json ... ``` blocks
  const match = content.match(/```schedule-json\s*\n([\s\S]*?)\n```/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}
