import { useMemo, useState } from 'react'
import type { Section } from '../types'
import type { SavedCourse } from '../hooks/useMySchedule'
import { getCurrentTerm } from '../lib/links'
import { buildSectionBundles, type SectionBundle } from '../lib/tssBundles'
import { sectionAvailStatus } from '../lib/availability'

export function SectionBundles({
  courseCode,
  title,
  units,
  subject,
  sections,
  onPlan,
  hasSection,
}: {
  courseCode: string
  title: string
  units: number
  subject: string
  sections: Section[]
  onPlan?: (course: SavedCourse) => void
  hasSection?: (courseCode: string, sectionCode: string, sectionType: string) => boolean
}) {
  const bundles = useMemo(() => buildSectionBundles(sections), [sections])
  const [showAll, setShowAll] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (bundles.length === 0) return null

  const toSavedSections = (bundle: SectionBundle): SavedCourse['sections'] => bundle.sections.map((section) => ({
    section_id: section.section_id,
    type: section.type,
    section: section.section,
    days: section.days,
    time: section.time,
    building: section.building,
    room: section.room,
    instructor: section.instructor,
    available: sectionAvailStatus(section).seats,
    limit: Number(section.limit) || 0,
    waitlisted: Number(section.waitlisted) || 0,
    waitlist_available: section.waitlist_available,
    status: section.status,
    event_package_ids: section.event_package_ids,
  }))

  const planBundle = (bundle: SectionBundle) => {
    onPlan?.({ course_code: courseCode, title, units, subject, sections: toSavedSections(bundle) })
    setMessage(`Option saved to your ${courseCode} plan`)
  }

  const openBundleInTss = async (bundle: SectionBundle) => {
    if (launching) return
    const tssTab = window.open('', 'trittton-tss-booking')
    if (!tssTab) {
      setMessage('Chrome blocked the TSS tab. Allow popups for Trittton and try again.')
      return
    }
    tssTab.focus()
    setLaunching(bundle.packageId)
    setMessage(null)
    try {
      const response = await fetch('/api/tss/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: getCurrentTerm(), section_ids: bundle.sections.map((section) => section.section_id) }),
      })
      const data = await response.json() as { courses?: Array<{ course_code?: string; tss_booking_url?: string | null }>; error?: string }
      if (!response.ok) throw new Error(data.error || `TSS handoff failed: ${response.status}`)
      const normalized = courseCode.replace(/\s+/g, '').toUpperCase()
      const course = data.courses?.find((item) => item.course_code?.replace(/\s+/g, '').toUpperCase() === normalized) || data.courses?.[0]
      if (!course?.tss_booking_url) throw new Error('UCSD did not return a booking link for this option')
      tssTab.location.href = course.tss_booking_url
      tssTab.focus()
      setMessage(`Opened this complete ${courseCode} option in TSS`)
    } catch (error) {
      tssTab.close()
      setMessage(error instanceof Error ? error.message : 'Could not open this option in TSS')
    } finally {
      setLaunching(null)
    }
  }

  const visible = showAll ? bundles : bundles.slice(0, 4)
  return (
    <section className="border-b border-border bg-gradient-to-br from-accent/8 via-surface/35 to-accent2/5 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-bold text-text">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-accent">✦</span>
            Compatible section bundles
            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted">{bundles.length}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">UCSD-linked lecture, discussion, and lab combinations. Choose one complete option.</p>
        </div>
        {message && <div className="text-[10px] font-medium text-accent">{message}</div>}
      </div>

      <div className="mt-4 grid gap-2.5 xl:grid-cols-2">
        {visible.map((bundle, index) => {
          const planned = bundle.sections.every((section) => hasSection?.(courseCode, section.section, section.type))
          const status = bundle.openSeats > 0 ? `${bundle.openSeats} seats` : bundle.hasWaitlist ? 'waitlist only' : 'currently full'
          return (
            <article key={bundle.packageId} className="rounded-xl border border-border bg-card/85 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-text">Option {index + 1}</div>
                  <div className={`mt-0.5 text-[10px] font-semibold ${bundle.openSeats > 0 ? 'text-green' : bundle.hasWaitlist ? 'text-gold' : 'text-red'}`}>{status}</div>
                </div>
                <div className="flex gap-1.5">
                  {onPlan && (
                    <button onClick={() => planBundle(bundle)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${planned ? 'border-green/20 bg-green/10 text-green' : 'border-border bg-surface text-muted hover:border-accent/30 hover:text-text'}`}>
                      {planned ? '✓ Planned' : '+ Plan bundle'}
                    </button>
                  )}
                  <button onClick={() => openBundleInTss(bundle)} disabled={Boolean(launching)} className="rounded-lg bg-accent px-2.5 py-1.5 text-[10px] font-bold text-white shadow-[0_6px_18px_rgba(100,136,255,0.24)] hover:bg-accent/90 disabled:cursor-wait disabled:opacity-50">
                    {launching === bundle.packageId ? 'Opening…' : bundle.openSeats > 0 ? 'Add in TSS ↗' : bundle.hasWaitlist ? 'Join waitlist in TSS ↗' : 'Open in TSS ↗'}
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {bundle.sections.map((section) => (
                  <span key={section.section_id} className="rounded-md border border-border bg-surface/75 px-2 py-1 font-mono text-[9px] text-muted">
                    <b className="text-text">{section.type}</b> {section.section} · {section.days || 'TBA'} {section.time || ''}
                  </span>
                ))}
              </div>
            </article>
          )
        })}
      </div>
      {bundles.length > 4 && (
        <button onClick={() => setShowAll((current) => !current)} className="mt-3 text-[10px] font-semibold text-accent hover:underline">
          {showAll ? 'Show fewer options' : `Show ${bundles.length - 4} more compatible options`}
        </button>
      )}
    </section>
  )
}
