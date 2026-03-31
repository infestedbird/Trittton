import type { Section } from '../types'
import { TYPE_COLORS } from '../lib/constants'
import { capeInstructorUrl, rmpUrl, webRegUrl } from '../lib/links'
import type { RmpRating } from '../hooks/useRmpRatings'

interface SectionTableProps {
  sections: Section[]
  courseCode?: string
  courseTitle?: string
  courseUnits?: number
  onAddSection?: (section: { type: string; section: string; days: string; time: string; building: string; room: string; instructor: string; available: number; limit: number }) => void
  isSectionAdded?: (sectionCode: string, sectionType: string) => boolean
  getRating?: (instructor: string) => RmpRating | null | undefined
}

export function SectionTable({ sections, onAddSection, isSectionAdded, getRating }: SectionTableProps) {
  if (sections.length === 0) {
    return (
      <div className="px-4 py-3 text-muted text-[12px]">No section data available.</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-surface">
            {onAddSection && <th className="px-2 py-2 w-8" />}
            {['ID', 'Type', 'Section', 'Days', 'Time', 'Building', 'Room', 'Instructor', 'Available', 'Limit', 'Waitlist', ''].map(
              (h) => (
                <th
                  key={h}
                  className="font-mono text-[10px] tracking-wide uppercase text-muted px-3 py-2 text-left font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sections.map((s, i) => {
            const aInt = parseInt(s.available) || 0
            const wInt = parseInt(s.waitlisted) || 0
            const availClass = aInt > 0 ? 'text-green' : wInt > 0 ? 'text-gold' : 'text-red'
            const typeColor = TYPE_COLORS[s.type]
            const added = isSectionAdded?.(s.section, s.type) ?? false

            return (
              <tr key={`${s.section_id}-${i}`} className="hover:bg-white/[0.015] transition-colors">
                {onAddSection && (
                  <td className="px-2 py-2 border-t border-border">
                    <button
                      onClick={() => onAddSection({
                        type: s.type,
                        section: s.section,
                        days: s.days,
                        time: s.time,
                        building: s.building,
                        room: s.room,
                        instructor: s.instructor,
                        available: aInt,
                        limit: parseInt(s.limit) || 0,
                      })}
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer
                        ${added
                          ? 'bg-green/15 text-green border border-green/20'
                          : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'
                        }`}
                      title={added ? 'Already added' : `Add ${s.type} ${s.section} to My Schedule`}
                    >
                      {added ? '✓' : '+'}
                    </button>
                  </td>
                )}
                <td className="px-3 py-2 border-t border-border font-mono text-muted">
                  {s.section_id || '\u2014'}
                </td>
                <td className="px-3 py-2 border-t border-border">
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded font-medium"
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
                <td className="px-3 py-2 border-t border-border">{s.building || '\u2014'}</td>
                <td className="px-3 py-2 border-t border-border">{s.room || '\u2014'}</td>
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
                          className={`font-mono text-[9px] px-1 py-px rounded ${
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
                        className="text-[9px] font-mono text-accent2 hover:underline"
                        title={`CAPEs for ${s.instructor}`}
                      >
                        CAPEs
                      </a>
                    </span>
                    )
                  })() : 'TBA'}
                </td>
                <td className={`px-3 py-2 border-t border-border font-mono ${availClass}`}>
                  {s.available || '\u2014'}
                </td>
                <td className="px-3 py-2 border-t border-border font-mono text-muted">
                  {s.limit || '\u2014'}
                </td>
                <td className="px-3 py-2 border-t border-border font-mono text-muted">
                  {wInt > 0 ? wInt : '\u2014'}
                </td>
                <td className="px-2 py-2 border-t border-border">
                  {s.section_id && (
                    <a
                      href={webRegUrl(s.section_id)}
                      target="_blank"
                      rel="noopener"
                      className="font-mono text-[10px] px-2 py-0.5 rounded
                        bg-accent/10 text-accent border border-accent/20
                        hover:bg-accent/20 transition-colors whitespace-nowrap"
                    >
                      Enroll &rarr;
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
