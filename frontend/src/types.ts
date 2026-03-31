export interface Section {
  section_id: string
  type: string
  section: string
  days: string
  time: string
  building: string
  room: string
  instructor: string
  available: string
  limit: string
  waitlisted: string
}

export interface Course {
  subject: string
  course_code: string
  title: string
  units: string
  restrictions: string
  sections: Section[]
}

export type AvailabilityStatus = 'open' | 'waitlist' | 'full'

export interface FilterState {
  search: string
  department: string
  sectionType: string
  availability: string
}

export interface ScrapeProgress {
  status: 'idle' | 'running' | 'done' | 'error'
  current: number
  total: number
  currentSubject: string
  coursesFound: number
  errors: string[]
}
