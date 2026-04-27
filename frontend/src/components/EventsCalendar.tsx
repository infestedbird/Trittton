import { useState, useEffect, useCallback } from 'react'

interface CampusEvent {
  id: number
  title: string
  description: string
  url: string
  start: string | null
  end: string | null
  location: string
  venue: string
  photo_url: string
  tags: string[]
}

interface AcademicDate {
  summary: string
  start: string | null
  end: string | null
  category: string
  year_range: string
}

type Tab = 'upcoming' | 'calendar' | 'events'

const CATEGORY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  enrollment: { color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)', label: 'Enrollment' },
  instruction: { color: '#3dd68c', bg: 'rgba(61,214,140,0.12)', label: 'Instruction' },
  finals: { color: '#f25f5c', bg: 'rgba(242,95,92,0.12)', label: 'Finals' },
  holiday: { color: '#f5c842', bg: 'rgba(245,200,66,0.12)', label: 'Holiday' },
  commencement: { color: '#7c5cfc', bg: 'rgba(124,92,252,0.12)', label: 'Commencement' },
  academic: { color: '#7a82a0', bg: 'rgba(122,130,160,0.12)', label: 'Academic' },
}

// Parse "2026-04-02" by splitting the string — never let JS Date shift the day
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDateParts(iso: string): { year: number; month: number; day: number } | null {
  // Handle "2026-04-02" or "2026-04-02T..."
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) }
}

function parseLocalDate(iso: string): Date {
  const p = parseDateParts(iso)
  if (!p) return new Date(iso)
  // Create date using local constructor (month is 0-indexed)
  return new Date(p.year, p.month - 1, p.day, 12, 0, 0)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const p = parseDateParts(iso)
  if (!p) return ''
  // Get weekday from a safely-constructed local date
  const d = new Date(p.year, p.month - 1, p.day, 12, 0, 0)
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${MONTH_NAMES[p.month - 1]} ${p.day}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  if (iso.includes('T')) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  return formatDate(iso)
}

function isUpcoming(iso: string | null): boolean {
  if (!iso) return false
  const p = parseDateParts(iso)
  if (!p) return false
  const today = new Date()
  const eventDate = new Date(p.year, p.month - 1, p.day)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return eventDate >= todayDate
}

function isPast(iso: string | null): boolean {
  if (!iso) return false
  const p = parseDateParts(iso)
  if (!p) return false
  const today = new Date()
  const eventDate = new Date(p.year, p.month - 1, p.day)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return eventDate < todayDate
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const p = parseDateParts(iso)
  if (!p) return null
  const today = new Date()
  const eventDate = new Date(p.year, p.month - 1, p.day)
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.ceil((eventDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntilLabel(iso: string | null): string {
  const d = daysUntil(iso)
  if (d === null) return ''
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d < 0) return `${Math.abs(d)}d ago`
  if (d <= 7) return `${d}d`
  if (d <= 30) return `${Math.ceil(d / 7)}w`
  return `${Math.ceil(d / 30)}mo`
}

function toGCalDateStr(iso: string | null): string {
  if (!iso) return ''
  // Format: YYYYMMDD for all-day events
  return iso.replace(/-/g, '').slice(0, 8)
}

function toGCalDateTimeStr(iso: string | null): string {
  if (!iso) return ''
  // Format: YYYYMMDDTHHmmssZ for timed events
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function makeGCalUrl(title: string, start: string | null, end: string | null, details?: string, location?: string): string {
  const params = new URLSearchParams()
  params.set('action', 'TEMPLATE')
  params.set('text', title)
  if (start) {
    const hasTime = start.includes('T')
    if (hasTime) {
      params.set('dates', `${toGCalDateTimeStr(start)}/${end ? toGCalDateTimeStr(end) : toGCalDateTimeStr(start)}`)
    } else {
      // All-day event: end date needs +1 day for Google Calendar (exclusive end)
      // Use UTC methods to avoid timezone shifting
      const startStr = toGCalDateStr(start)
      const endSource = end || start
      const endDate = new Date(endSource + 'T00:00:00Z') // Force UTC
      endDate.setUTCDate(endDate.getUTCDate() + 1)
      const endStr = endDate.toISOString().replace(/-/g, '').slice(0, 8)
      params.set('dates', `${startStr}/${endStr}`)
    }
  }
  if (details) params.set('details', details)
  if (location) params.set('location', location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function CalendarAddButton({ url, small }: { url: string; small?: boolean }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title="Add to Google Calendar"
      className={`inline-flex items-center gap-1 rounded-lg cursor-pointer transition-all hover:bg-accent/15 shrink-0
        ${small ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1 text-[11px]'}
        text-accent border border-accent/20 hover:border-accent/40 font-medium`}>
      <svg className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
      </svg>
      {!small && 'Add'}
    </a>
  )
}

export function EventsCalendar() {
  const [events, setEvents] = useState<CampusEvent[]>([])
  const [dates, setDates] = useState<AcademicDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, calRes] = await Promise.all([
        fetch('/api/events?days=30&pp=40'),
        fetch('/api/calendar'),
      ])
      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.events || [])
      }
      if (calRes.ok) {
        const data = await calRes.json()
        setDates(data.dates || [])
      }
      setLastUpdated(new Date())
      setError(null)
    } catch {
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3600_000) // 1 hour
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-[12px] text-muted">Loading events & dates...</div>
        </div>
      </div>
    )
  }

  // Upcoming important dates (next 90 days)
  const upcomingDates = dates
    .filter((d) => isUpcoming(d.start) && daysUntil(d.start)! <= 90)
    .filter((d) => !categoryFilter || d.category === categoryFilter)

  // All calendar dates
  const allDates = dates.filter((d) => !categoryFilter || d.category === categoryFilter)

  // Upcoming events
  const upcomingEvents = events.filter((e) => isUpcoming(e.start))

  // Count by category for upcoming
  const categoryCounts = upcomingDates.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Dates & Events</h2>
            <div className="flex gap-4 mt-1 text-[11px] text-muted">
              <span>Registration dates, academic calendar, campus events</span>
              {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium
              bg-accent/10 text-accent border border-accent/20
              hover:bg-accent/20 cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-surface rounded-lg p-0.5 w-fit border border-border">
          {([
            ['upcoming', 'Upcoming'],
            ['calendar', 'Full Calendar'],
            ['events', 'Campus Events'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-[12px] font-medium cursor-pointer
                ${tab === key ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {label}
              {key === 'upcoming' && upcomingDates.length > 0 && (
                <span className="ml-1.5 text-[11px] text-accent">{upcomingDates.length}</span>
              )}
              {key === 'events' && upcomingEvents.length > 0 && (
                <span className="ml-1.5 text-[11px] text-accent">{upcomingEvents.length}</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-red text-[12px] bg-red/8 border border-red/15 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Upcoming Tab */}
        {tab === 'upcoming' && (
          <div className="space-y-4">
            {/* Category filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setCategoryFilter('')}
                className={`text-[11px] px-2.5 py-1 rounded-lg cursor-pointer
                  ${!categoryFilter ? 'bg-accent/12 text-accent' : 'bg-surface text-muted hover:text-text'}`}
              >
                All
              </button>
              {Object.entries(CATEGORY_STYLES).map(([key, style]) => {
                const count = categoryCounts[key] || 0
                if (count === 0) return null
                return (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(categoryFilter === key ? '' : key)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1.5
                      ${categoryFilter === key ? 'border' : 'hover:opacity-80'}`}
                    style={{
                      background: style.bg,
                      color: style.color,
                      borderColor: categoryFilter === key ? style.color : 'transparent',
                    }}
                  >
                    {style.label}
                    <span className="text-[11px] opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Upcoming dates list */}
            {upcomingDates.length === 0 ? (
              <div className="text-center py-12 text-muted text-[13px]">
                No upcoming dates in the next 90 days{categoryFilter ? ` for ${CATEGORY_STYLES[categoryFilter]?.label}` : ''}.
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingDates.map((d, i) => {
                  const style = CATEGORY_STYLES[d.category] || CATEGORY_STYLES.academic
                  const days = daysUntil(d.start)
                  const isImminent = days !== null && days <= 7 && days >= 0

                  return (
                    <div
                      key={`${d.summary}-${d.start}-${i}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-card animate-fade-in
                        ${isImminent ? 'border-accent/20' : 'border-border'}`}
                      style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
                    >
                      {/* Date badge */}
                      <div className="w-14 text-center shrink-0">
                        <div className="font-mono text-[18px] font-medium text-text leading-tight">
                          {d.start ? (parseDateParts(d.start)?.day ?? '?') : '?'}
                        </div>
                        <div className="font-mono text-[11px] text-muted uppercase">
                          {d.start ? (MONTH_NAMES[(parseDateParts(d.start)?.month ?? 1) - 1]) : ''}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text truncate">{d.summary}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[11px] px-1.5 py-px rounded"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
                          <span className="font-mono text-[11px] text-muted">{formatDate(d.start)}</span>
                          {d.end && d.end !== d.start && (
                            <span className="font-mono text-[11px] text-dim">– {formatDate(d.end)}</span>
                          )}
                        </div>
                      </div>

                      {/* Add to calendar */}
                      <CalendarAddButton url={makeGCalUrl(d.summary, d.start, d.end, `UCSD Academic Calendar — ${CATEGORY_STYLES[d.category]?.label || d.category}`, 'UC San Diego')} small />

                      {/* Countdown */}
                      <div className={`font-mono text-[12px] font-medium shrink-0 ${
                        days === 0 ? 'text-red' : isImminent ? 'text-accent' : 'text-muted'
                      }`}>
                        {daysUntilLabel(d.start)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Full Calendar Tab */}
        {tab === 'calendar' && (
          <div className="space-y-4">
            {/* Category filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setCategoryFilter('')}
                className={`text-[11px] px-2.5 py-1 rounded-lg cursor-pointer
                  ${!categoryFilter ? 'bg-accent/12 text-accent' : 'bg-surface text-muted hover:text-text'}`}
              >
                All ({allDates.length})
              </button>
              {Object.entries(CATEGORY_STYLES).map(([key, style]) => {
                const count = dates.filter((d) => d.category === key).length
                if (count === 0) return null
                return (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(categoryFilter === key ? '' : key)}
                    className="text-[11px] px-2.5 py-1 rounded-lg cursor-pointer"
                    style={{
                      background: categoryFilter === key ? style.bg : 'var(--color-surface)',
                      color: categoryFilter === key ? style.color : 'var(--color-muted)',
                    }}
                  >
                    {style.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* All dates table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-[11px] text-muted uppercase text-left px-4 py-2.5 font-medium w-24">Date</th>
                    <th className="text-[11px] text-muted uppercase text-left px-4 py-2.5 font-medium">Event</th>
                    <th className="text-[11px] text-muted uppercase text-left px-4 py-2.5 font-medium w-28">Category</th>
                    <th className="text-[11px] text-muted uppercase text-center px-4 py-2.5 font-medium w-12"></th>
                    <th className="text-[11px] text-muted uppercase text-right px-4 py-2.5 font-medium w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allDates.map((d, i) => {
                    const style = CATEGORY_STYLES[d.category] || CATEGORY_STYLES.academic
                    const past = isPast(d.start)
                    return (
                      <tr key={`${d.summary}-${d.start}-${i}`} className={`border-b border-border/30 ${past ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-2 font-mono text-muted">{formatDate(d.start)}</td>
                        <td className="px-4 py-2 text-text font-medium">{d.summary}</td>
                        <td className="px-4 py-2">
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {!past && <CalendarAddButton url={makeGCalUrl(d.summary, d.start, d.end, `UCSD ${CATEGORY_STYLES[d.category]?.label || ''}`, 'UC San Diego')} small />}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-[11px]">
                          {past ? (
                            <span className="text-dim">Past</span>
                          ) : (
                            <span className={daysUntil(d.start)! <= 7 ? 'text-accent font-medium' : 'text-muted'}>
                              {daysUntilLabel(d.start)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Campus Events Tab */}
        {tab === 'events' && (
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12 text-muted text-[13px]">
                No upcoming campus events found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcomingEvents.map((evt) => (
                  <a
                    key={evt.id}
                    href={evt.url}
                    target="_blank"
                    rel="noopener"
                    className="group rounded-xl border border-border bg-card overflow-hidden hover:border-border2 animate-fade-in"
                  >
                    {/* Image */}
                    {evt.photo_url && (
                      <div className="h-32 bg-surface overflow-hidden">
                        <img
                          src={evt.photo_url}
                          alt=""
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="text-[13px] font-medium text-text group-hover:text-accent leading-snug line-clamp-2">
                        {evt.title}
                      </div>

                      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted">
                        <span>{formatDateTime(evt.start)}</span>
                        {(evt.location || evt.venue) && (
                          <>
                            <span className="text-dim">&middot;</span>
                            <span className="truncate">{evt.venue || evt.location}</span>
                          </>
                        )}
                        <span className="ml-auto">
                          <CalendarAddButton url={makeGCalUrl(evt.title, evt.start, evt.end, evt.description, evt.venue || evt.location || 'UC San Diego')} small />
                        </span>
                      </div>

                      {evt.description && (
                        <div className="text-[12px] text-muted mt-2 line-clamp-2 leading-relaxed">
                          {evt.description}
                        </div>
                      )}

                      {evt.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {evt.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-accent2/8 text-accent2/70">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-[11px] text-dim text-center pb-6">
          Academic dates from UCSD Registrar &middot; Events from calendar.ucsd.edu &middot; Auto-refreshes every hour
        </div>
      </div>
    </div>
  )
}
