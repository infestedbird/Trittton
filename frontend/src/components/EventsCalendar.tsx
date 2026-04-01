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

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function isUpcoming(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) >= new Date(new Date().toDateString())
}

function isPast(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date(new Date().toDateString())
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - new Date(new Date().toDateString()).getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
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
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <div className="font-mono text-[12px] text-muted">Loading events & dates...</div>
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
    <div className="h-[calc(100vh-56px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-text">Dates & Events</h2>
            <div className="flex gap-4 mt-1 font-mono text-[11px] text-muted">
              <span>Registration dates, academic calendar, campus events</span>
              {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium
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
              className={`px-4 py-1.5 rounded-md text-[12px] font-mono font-medium cursor-pointer
                ${tab === key ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {label}
              {key === 'upcoming' && upcomingDates.length > 0 && (
                <span className="ml-1.5 text-[9px] text-accent">{upcomingDates.length}</span>
              )}
              {key === 'events' && upcomingEvents.length > 0 && (
                <span className="ml-1.5 text-[9px] text-accent">{upcomingEvents.length}</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-red text-[12px] font-mono bg-red/8 border border-red/15 rounded-lg px-3 py-2">
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
                className={`font-mono text-[11px] px-2.5 py-1 rounded-lg cursor-pointer
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
                    className={`font-mono text-[11px] px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1.5
                      ${categoryFilter === key ? 'border' : 'hover:opacity-80'}`}
                    style={{
                      background: style.bg,
                      color: style.color,
                      borderColor: categoryFilter === key ? style.color : 'transparent',
                    }}
                  >
                    {style.label}
                    <span className="text-[9px] opacity-60">{count}</span>
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
                          {d.start ? new Date(d.start).getDate() : '?'}
                        </div>
                        <div className="font-mono text-[10px] text-muted uppercase">
                          {d.start ? new Date(d.start).toLocaleDateString('en-US', { month: 'short' }) : ''}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text truncate">{d.summary}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="font-mono text-[10px] px-1.5 py-px rounded"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
                          <span className="font-mono text-[10px] text-muted">{formatDate(d.start)}</span>
                          {d.end && d.end !== d.start && (
                            <span className="font-mono text-[10px] text-dim">– {formatDate(d.end)}</span>
                          )}
                        </div>
                      </div>

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
                className={`font-mono text-[11px] px-2.5 py-1 rounded-lg cursor-pointer
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
                    className="font-mono text-[11px] px-2.5 py-1 rounded-lg cursor-pointer"
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
                    <th className="font-mono text-[9px] text-muted uppercase text-left px-4 py-2.5 font-medium w-24">Date</th>
                    <th className="font-mono text-[9px] text-muted uppercase text-left px-4 py-2.5 font-medium">Event</th>
                    <th className="font-mono text-[9px] text-muted uppercase text-left px-4 py-2.5 font-medium w-28">Category</th>
                    <th className="font-mono text-[9px] text-muted uppercase text-right px-4 py-2.5 font-medium w-16">Status</th>
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
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
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

                      <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-muted">
                        <span>{formatDateTime(evt.start)}</span>
                        {(evt.location || evt.venue) && (
                          <>
                            <span className="text-dim">&middot;</span>
                            <span className="truncate">{evt.venue || evt.location}</span>
                          </>
                        )}
                      </div>

                      {evt.description && (
                        <div className="text-[12px] text-muted mt-2 line-clamp-2 leading-relaxed">
                          {evt.description}
                        </div>
                      )}

                      {evt.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {evt.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-accent2/8 text-accent2/70">
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
        <div className="text-[11px] text-dim font-mono text-center pb-6">
          Academic dates from UCSD Registrar &middot; Events from calendar.ucsd.edu &middot; Auto-refreshes every hour
        </div>
      </div>
    </div>
  )
}
