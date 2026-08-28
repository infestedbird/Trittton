import { useState } from 'react'
import type { Section } from '../types'
import { TYPE_COLORS, TYPE_LABELS } from '../lib/constants'
import { capeInstructorUrl, getCurrentTerm, isTssTerm, rmpUrl, webRegUrl } from '../lib/links'
import type { RmpRating } from '../hooks/useRmpRatings'
import { isWaitlistOnlySection, sectionAvailStatus } from '../lib/availability'

interface SectionTableProps {
  sections: Section[]
  courseCode?: string
  courseTitle?: string
  courseUnits?: number
  onAddSection?: (section: { section_id?: string; type: string; section: string; days: string; time: string; building: string; room: string; instructor: string; available: number; limit: number; waitlisted?: number; waitlist_available?: number | null; status?: string | null; event_package_ids?: string[] }) => void
  isSectionAdded?: (sectionCode: string, sectionType: string) => boolean
  getRating?: (instructor: string) => RmpRating | null | undefined
  isWatching?: (sectionId: string) => boolean
  onWatch?: (sectionId: string, courseCode: string, section: string, meta?: {
    title?: string; units?: string; type?: string; days?: string; time?: string; instructor?: string; limit?: number; waitlisted?: number
  }) => void
  onUnwatch?: (sectionId: string, courseCode: string, section: string) => void
}

function isOnlineSection(s: Section): boolean {
  const b = (s.building || '').toUpperCase()
  const r = (s.room || '').toUpperCase()
  return b === 'RCLAS' || b === 'REMOTE' || b === 'TBA' || b === 'ONLIN' || b === 'ONLINE'
    || r === 'REMOTE' || r === 'ONLINE'
    || (!b && !r && !s.days)
}

export function SectionTable({ sections, courseCode, onAddSection, isSectionAdded, getRating, isWatching, onWatch, onUnwatch }: SectionTableProps) {
  const [watchToast, setWatchToast] = useState<string | null>(null)
  const [launchingSectionId, setLaunchingSectionId] = useState<string | null>(null)

  if (sections.length === 0) {
    return (
      <div className="px-4 py-3 text-muted text-[12px]">No section data available.</div>
    )
  }

  // Get unique section types for legend
  const types = [...new Set(sections.map(s => s.type))]

  const showToast = (msg: string) => {
    setWatchToast(msg)
    setTimeout(() => setWatchToast(null), 3000)
  }

  const openExactTssCourse = async (section: Section) => {
    if (!section.section_id || launchingSectionId) return

    // Create the tab synchronously from the click so Chrome does not treat it
    // as an unsolicited popup while the exact UCSD booking URL is resolved.
    const tssTab = window.open('', 'trittton-tss-booking')
    if (!tssTab) {
      showToast('Chrome blocked the TSS tab. Allow popups for Trittton and try again.')
      return
    }
    tssTab.focus()
    setLaunchingSectionId(section.section_id)

    try {
      const response = await fetch('/api/tss/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: getCurrentTerm(),
          section_ids: [section.section_id],
        }),
      })
      const data = await response.json() as {
        courses?: Array<{ course_code?: string; tss_booking_url?: string | null }>
        error?: string
      }
      if (!response.ok) throw new Error(data.error || `TSS handoff failed: ${response.status}`)

      const normalizedCode = courseCode?.replace(/\s+/g, '').toUpperCase()
      const match = data.courses?.find(
        (course) => course.course_code?.replace(/\s+/g, '').toUpperCase() === normalizedCode,
      ) || data.courses?.[0]
      if (!match?.tss_booking_url) throw new Error('UCSD did not return a booking link for this section')

      // Assigning href can navigate a reused cross-origin TSS window; calling
      // Location.replace() on that window is blocked by same-origin rules.
      tssTab.location.href = match.tss_booking_url
      tssTab.focus()
      showToast(`Opened ${courseCode || 'course'} ${section.section} directly in TSS`)
    } catch (error) {
      tssTab.close()
      showToast(error instanceof Error ? error.message : 'Could not open this course in TSS')
    } finally {
      setLaunchingSectionId(null)
    }
  }

  return (
    <div className="overflow-x-auto">
      {/* Section type legend */}
      <div className="px-4 py-2.5 bg-surface/20 border-b border-border/50 flex items-center gap-4 flex-wrap">
        <span className="text-[11px] text-dim font-semibold uppercase tracking-wider">Types:</span>
        {types.map(t => {
          const color = TYPE_COLORS[t]
          return (
            <span key={t} className="flex items-center gap-1.5 text-[12px]">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium"
                style={color ? { background: color.bg, color: color.text } : { background: 'rgba(122,130,160,0.15)', color: '#7a82a0' }}>
                {t}
              </span>
              <span className="text-muted">{TYPE_LABELS[t] || t}</span>
            </span>
          )
        })}
      </div>

      {/* Watch toast notification */}
      {watchToast && (
        <div className="px-4 py-2 bg-gold/10 border-b border-gold/20 text-gold text-[12px] font-medium flex items-center gap-2 animate-fade-in">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {watchToast}
        </div>
      )}

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-surface">
            {onAddSection && <th className="px-2 py-2 text-[10px] uppercase tracking-wide text-muted font-medium">Plan</th>}
            {['Type', 'Section', 'Days', 'Time', 'Location', 'Instructor', 'Available', 'Limit', 'Waitlist', ''].map(
              (h) => (
                <th key={h} className="text-[11px] tracking-wide uppercase text-muted px-3 py-2 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sections.map((s, i) => {
            const availability = sectionAvailStatus(s)
            const aInt = availability.seats
            const wInt = parseInt(s.waitlisted) || 0
            const waitlistOnly = isWaitlistOnlySection(s)
            const waitlistOpen = availability.status === 'waitlist'
            const availClass = availability.status === 'open' ? 'text-green' : waitlistOpen ? 'text-gold' : 'text-red'
            const typeColor = TYPE_COLORS[s.type]
            const added = isSectionAdded?.(s.section, s.type) ?? false

            return (
              <tr key={`${s.section_id}-${i}`} className="hover:bg-white/[0.015] transition-colors">
                {onAddSection && (
                  <td className="px-2 py-2 border-t border-border">
                    <button
                      onClick={() => onAddSection({
                        section_id: s.section_id,
                        type: s.type,
                        section: s.section,
                        days: s.days,
                        time: s.time,
                        building: s.building,
                        room: s.room,
                        instructor: s.instructor,
                        available: aInt,
                        limit: parseInt(s.limit) || 0,
                        waitlisted: wInt,
                        waitlist_available: s.waitlist_available,
                        status: s.status,
                        event_package_ids: s.event_package_ids,
                      })}
                      className={`min-w-[48px] h-8 px-2 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer
                        ${added
                          ? 'bg-green/20 text-green'
                          : 'bg-accent/15 text-accent hover:bg-accent/25 hover:scale-110'
                        }`}
                      title={added ? 'Already saved to your Trittton plan' : `Save ${s.type} ${s.section} to your Trittton plan`}
                    >
                      {added ? '✓ Saved' : '+ Plan'}
                    </button>
                  </td>
                )}
                <td className="px-3 py-2 border-t border-border">
                  <span
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded font-medium"
                    style={
                      typeColor
                        ? { background: typeColor.bg, color: typeColor.text }
                        : { background: 'rgba(122,130,160,0.15)', color: '#7a82a0' }
                    }
                  >
                    {s.type}
                  </span>
                </td>
                <td className="px-3 py-2 border-t border-border font-mono text-muted">{s.section}</td>
                <td className="px-3 py-2 border-t border-border">{s.days || '\u2014'}</td>
                <td className="px-3 py-2 border-t border-border">{s.time || '\u2014'}</td>
                <td className="px-3 py-2 border-t border-border">
                  {isOnlineSection(s) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent2/12 text-accent2 text-[11px] font-medium">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                      </svg>
                      Online
                    </span>
                  ) : (
                    <span>{s.building ? `${s.building} ${s.room || ''}`.trim() : '\u2014'}</span>
                  )}
                </td>
                <td className="px-3 py-2 border-t border-border">
                  {s.instructor && s.instructor !== 'TBA' ? (() => {
                    const rating = getRating?.(s.instructor)
                    return (
                    <span className="inline-flex gap-1.5 items-center flex-wrap">
                      <a
                        href={rating?.rmpUrl || rmpUrl(s.instructor)}
                        target="_blank"
                        rel="noopener"
                        className="hover:text-accent hover:underline transition-colors"
                        title={`RateMyProfessor: ${s.instructor}`}
                      >
                        {s.instructor}
                      </a>
                      {rating && (
                        <a
                          href={rating.rmpUrl}
                          target="_blank"
                          rel="noopener"
                          className={`font-mono text-[11px] px-1 py-px rounded ${
                            rating.rating >= 4 ? 'bg-green/10 text-green' : rating.rating >= 3 ? 'bg-gold/10 text-gold' : 'bg-red/10 text-red'
                          }`}
                          title={`${rating.rating}/5 rating, ${rating.difficulty}/5 difficulty, ${rating.numRatings} reviews`}
                        >
                          &#9733;{rating.rating.toFixed(1)}
                        </a>
                      )}
                      <a
                        href={capeInstructorUrl(s.instructor)}
                        target="_blank"
                        rel="noopener"
                        className="text-[11px] text-accent2 hover:underline"
                        title={`CAPEs for ${s.instructor}`}
                      >
                        CAPEs
                      </a>
                    </span>
                    )
                  })() : 'TBA'}
                </td>
                <td className={`px-3 py-2 border-t border-border font-mono ${availClass}`}>
                  {aInt}
                </td>
                <td className="px-3 py-2 border-t border-border font-mono text-muted">
                  {s.limit || '\u2014'}
                </td>
                <td className="px-3 py-2 border-t border-border font-mono text-muted">
                  {waitlistOnly ? 'Waitlist only' : (s.waitlist_available || 0) > 0 ? `${s.waitlist_available} open` : wInt > 0 ? `${wInt} joined` : '\u2014'}
                </td>
                <td className="px-2 py-2 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    {s.section_id && s.source === 'tss' && isTssTerm(getCurrentTerm()) ? (
                      <button
                        onClick={() => openExactTssCourse(s)}
                        disabled={Boolean(launchingSectionId)}
                        className="min-w-[104px] whitespace-nowrap rounded-lg border border-accent bg-accent px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_6px_18px_rgba(79,142,247,0.22)] transition-all hover:-translate-y-0.5 hover:bg-accent/90 disabled:cursor-wait disabled:opacity-55"
                        title={`Open ${courseCode || 'this course'} ${s.section} directly in TSS`}
                      >
                        {launchingSectionId === s.section_id ? 'Opening TSS…' : waitlistOnly ? 'Join waitlist in TSS ↗' : 'Add in TSS ↗'}
                      </button>
                    ) : s.section_id ? (
                      <a
                        href={webRegUrl(s.section_id)}
                        target="_blank"
                        rel="noopener"
                        className="whitespace-nowrap rounded border border-accent/20 bg-accent/10 px-2 py-0.5 text-[11px] text-accent transition-colors hover:bg-accent/20"
                      >
                        WebReg &rarr;
                      </a>
                    ) : null}
                    {s.section_id && availability.status !== 'open' && onWatch && onUnwatch && (() => {
                      const watching = isWatching?.(s.section_id)
                      return (
                        <button
                          onClick={() => {
                            if (watching) {
                              onUnwatch(s.section_id, '', s.section)
                              showToast(`Stopped watching ${s.type} ${s.section}`)
                            } else {
                              onWatch(s.section_id, '', s.section, {
                                type: s.type, days: s.days, time: s.time, instructor: s.instructor,
                                limit: parseInt(s.limit) || 0, waitlisted: parseInt(s.waitlisted) || 0,
                              })
                              showToast(`Watching ${s.type} ${s.section} — you'll be notified when a seat opens`)
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            watching
                              ? 'bg-gold/20 text-gold border border-gold/25 hover:bg-gold/30 shadow-[0_0_8px_rgba(245,200,66,0.2)]'
                              : 'bg-surface text-muted border border-border hover:text-gold hover:border-gold/30 hover:bg-gold/10'
                          }`}
                          title={watching ? 'Stop watching for seats' : 'Get notified when a seat opens'}
                        >
                          <svg width="14" height="14" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                          </svg>
                          {watching ? 'Watching' : 'Watch'}
                        </button>
                      )
                    })()}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
