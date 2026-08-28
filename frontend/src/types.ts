export interface Section {
  section_id: string
  section_ref?: string
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
  waitlist_available?: number | null
  status?: string | null
  event_package_ids?: string[]
  source?: 'tss' | 'soc'
}

export interface Course {
  subject: string
  course_code: string
  title: string
  units: string
  restrictions: string
  sections: Section[]
  source?: 'tss' | 'soc'
  module_code?: string | null
  academic_level?: string | null
  prerequisites?: string[]
  availability_refresh_pending?: boolean
  open_seat_count?: number
  waitlist_available_count?: number
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
