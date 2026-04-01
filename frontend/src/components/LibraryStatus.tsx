import { useState, useEffect, useCallback } from 'react'

interface SubLocation {
  name: string
  id: number
  abbreviation: string
  busyness: number
  people: number
  capacity: number
  isAvailable: boolean
  isOpen: boolean
  hourSummary: string
}

interface Library {
  name: string
  id: number
  busyness: number
  people: number
  capacity: number
  isAvailable: boolean
  isOpen: boolean
  hourSummary: string
  bestLocations: { abbreviation: string; id: number; busyness: number }[]
  subLocs: SubLocation[]
}

interface DayHours {
  date: string
  times: { status: string; hours?: { from: string; to: string }[]; currently_open: boolean }
  rendered: string
}

interface LibraryHours {
  lid: number
  name: string
  weeks: Record<string, DayHours>[]
}

function getBusynessLevel(busyness: number): { label: string; color: string; bg: string } {
  if (busyness <= 0) return { label: 'Empty', color: '#3dd68c', bg: 'rgba(61,214,140,0.15)' }
  if (busyness <= 25) return { label: 'Not Busy', color: '#3dd68c', bg: 'rgba(61,214,140,0.15)' }
  if (busyness <= 50) return { label: 'Moderate', color: '#f5c842', bg: 'rgba(245,200,66,0.15)' }
  if (busyness <= 75) return { label: 'Busy', color: '#ff9f43', bg: 'rgba(255,159,67,0.15)' }
  return { label: 'Very Busy', color: '#f25f5c', bg: 'rgba(242,95,92,0.15)' }
}

function getBusynessBarColor(busyness: number): string {
  if (busyness <= 25) return '#3dd68c'
  if (busyness <= 50) return '#f5c842'
  if (busyness <= 75) return '#ff9f43'
  return '#f25f5c'
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getRecommendation(libraries: Library[]): string {
  const openFloors = libraries.flatMap((lib) =>
    lib.subLocs
      .filter((s) => s.isOpen && s.isAvailable)
      .map((s) => ({ ...s, library: lib.name }))
  )

  if (openFloors.length === 0) return 'All libraries are currently closed.'

  const sorted = [...openFloors].sort((a, b) => a.busyness - b.busyness)
  const best = sorted[0]
  const level = getBusynessLevel(best.busyness)

  return `Best spot right now: ${best.library} — ${best.name} (${level.label}, ${best.busyness}% full, ~${best.people} people)`
}

export function LibraryStatus() {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [hours, setHours] = useState<LibraryHours[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [liveRes, hoursRes] = await Promise.all([
        fetch('/api/library/live'),
        fetch('/api/library/hours'),
      ])
      if (liveRes.ok) {
        const liveData = await liveRes.json()
        setLibraries(liveData)
        setLastUpdated(new Date())
      }
      if (hoursRes.ok) {
        const hoursData = await hoursRes.json()
        setHours(hoursData.locations || [])
      }
      setError(null)
    } catch (e) {
      setError('Failed to fetch library data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <div className="font-mono text-[12px] text-muted">Loading library data...</div>
        </div>
      </div>
    )
  }

  if (error && libraries.length === 0) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red font-mono text-[13px] mb-2">{error}</div>
          <button onClick={fetchData} className="font-mono text-[12px] text-accent hover:underline cursor-pointer">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const today = new Date()
  const dayName = DAY_NAMES[today.getDay()]

  // Map hours by library name
  const hoursMap = new Map<string, LibraryHours>()
  for (const h of hours) {
    hoursMap.set(h.name, h)
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-text">Library Status</h2>
            <div className="flex gap-4 mt-1 font-mono text-[11px] text-muted">
              <span>Live occupancy data</span>
              {lastUpdated && (
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium
              bg-accent/10 text-accent border border-accent/20
              hover:bg-accent/20 transition-all cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* Recommendation banner */}
        {libraries.length > 0 && (
          <div className="rounded-xl border border-green/20 bg-green/5 px-4 py-3">
            <div className="font-mono text-[11px] text-green font-medium mb-0.5">RECOMMENDATION</div>
            <div className="text-[13px] text-text">{getRecommendation(libraries)}</div>
          </div>
        )}

        {/* Library cards */}
        {libraries.map((lib) => {
          const level = getBusynessLevel(lib.busyness)
          const libHours = hoursMap.get(lib.name)
          const todayHours = libHours?.weeks?.[0]?.[dayName]

          return (
            <div key={lib.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Library header */}
              <div className="px-5 py-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: lib.isOpen ? level.color : '#3d4460' }}
                    />
                    <h3 className="text-[15px] font-medium text-text">{lib.name}</h3>
                    <span
                      className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{ color: lib.isOpen ? level.color : '#7a82a0', background: lib.isOpen ? level.bg : 'rgba(122,130,160,0.1)' }}
                    >
                      {lib.isOpen ? `${level.label} (${lib.busyness}%)` : 'Closed'}
                    </span>
                  </div>
                  <div className="text-right font-mono text-[11px] text-muted">
                    {lib.isOpen && (
                      <span><b className="text-text">{lib.people}</b> / {lib.capacity} people</span>
                    )}
                  </div>
                </div>

                {/* Overall busyness bar */}
                {lib.isOpen && (
                  <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(lib.busyness, 100)}%`,
                        background: getBusynessBarColor(lib.busyness),
                      }}
                    />
                  </div>
                )}

                {/* Today's hours */}
                {todayHours && (
                  <div className="mt-2 font-mono text-[10px] text-muted">
                    Today ({dayName}): <span className="text-text">{todayHours.rendered}</span>
                  </div>
                )}
              </div>

              {/* Floor breakdown */}
              {lib.subLocs.length > 0 && (
                <div className="px-5 py-3 space-y-2">
                  <div className="font-mono text-[9px] text-muted uppercase tracking-wider mb-2">Floor Breakdown</div>
                  {lib.subLocs.map((floor) => {
                    const floorLevel = getBusynessLevel(floor.busyness)
                    return (
                      <div key={floor.id} className="flex items-center gap-3">
                        <div className="w-20 font-mono text-[11px] text-muted truncate shrink-0">
                          {floor.abbreviation || floor.name}
                        </div>
                        <div className="flex-1 h-4 rounded bg-surface overflow-hidden relative">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{
                              width: `${Math.max(Math.min(floor.busyness, 100), 1)}%`,
                              background: floor.isOpen ? getBusynessBarColor(floor.busyness) : '#3d4460',
                              opacity: floor.isOpen ? 1 : 0.3,
                            }}
                          />
                        </div>
                        <div className="w-28 text-right font-mono text-[10px] shrink-0" style={{ color: floor.isOpen ? floorLevel.color : '#3d4460' }}>
                          {floor.isOpen ? (
                            <>{floor.busyness}% &middot; {floor.people}/{floor.capacity}</>
                          ) : (
                            <span className="text-dim">{floor.hourSummary || 'Closed'}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Weekly hours table */}
        {hours.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <div className="font-mono text-[11px] text-muted uppercase tracking-wider">Weekly Hours</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="font-mono text-[9px] text-muted uppercase text-left px-4 py-2 font-medium">Library</th>
                    {DAY_NAMES.map((d) => (
                      <th
                        key={d}
                        className={`font-mono text-[9px] uppercase text-center px-2 py-2 font-medium
                          ${d === dayName ? 'text-accent' : 'text-muted'}`}
                      >
                        {d.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hours.map((lib) => {
                    const week = lib.weeks?.[0]
                    if (!week) return null
                    return (
                      <tr key={lib.lid} className="border-b border-border/30">
                        <td className="px-4 py-2 font-medium text-text font-mono">{lib.name}</td>
                        {DAY_NAMES.map((d) => {
                          const day = week[d]
                          const isToday = d === dayName
                          const isClosed = day?.times?.status === 'closed'
                          return (
                            <td
                              key={d}
                              className={`px-2 py-2 text-center font-mono
                                ${isToday ? 'bg-accent/5' : ''}
                                ${isClosed ? 'text-dim' : 'text-muted'}`}
                            >
                              {isClosed ? 'Closed' : day?.rendered || '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[11px] text-dim font-mono text-center pb-6">
          Data from Waitz.io &middot; Auto-refreshes every 60 seconds
        </div>
      </div>
    </div>
  )
}
