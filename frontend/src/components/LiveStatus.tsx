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

interface Location {
  name: string
  id: number
  category: string
  busyness: number
  people: number
  capacity: number
  isAvailable: boolean
  isOpen: boolean
  hourSummary: string
  bestTime: string
  bestLocations: { abbreviation: string; id: number; busyness: number }[]
  trend: number[]
  subLocs: SubLocation[]
}

type CategoryFilter = '' | 'library' | 'fitness' | 'dining' | 'recreation' | 'other'

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  library: { label: 'Libraries', icon: '📚', color: '#4f8ef7' },
  fitness: { label: 'Fitness', icon: '💪', color: '#3dd68c' },
  dining:  { label: 'Dining', icon: '🍽️', color: '#f5c842' },
  recreation: { label: 'Recreation', icon: '🎮', color: '#7c5cfc' },
  other:   { label: 'Other', icon: '📍', color: '#7a82a0' },
}

function getStatusColor(busyness: number): string {
  if (busyness <= 30) return '#3dd68c'
  if (busyness <= 60) return '#f5c842'
  return '#f25f5c'
}

function getStatusLabel(busyness: number): string {
  if (busyness <= 30) return 'Low'
  if (busyness <= 60) return 'Moderate'
  return 'Busy'
}

function getStatusBg(busyness: number): string {
  if (busyness <= 30) return 'rgba(61,214,140,0.1)'
  if (busyness <= 60) return 'rgba(245,200,66,0.1)'
  return 'rgba(242,95,92,0.1)'
}

function MiniTrend({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const w = 80
  const h = 24
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LiveStatus() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CategoryFilter>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/campus/live')
      if (res.ok) {
        const data = await res.json()
        setLocations(data)
        setLastUpdated(new Date())
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-[12px] text-muted">Loading campus pulse...</div>
        </div>
      </div>
    )
  }

  const filtered = filter ? locations.filter((l) => l.category === filter) : locations
  const categories = [...new Set(locations.map((l) => l.category))]

  // Find best spot overall
  const openSpots = locations.filter((l) => l.isOpen && l.isAvailable)
  const bestOverall = openSpots.length > 0
    ? openSpots.reduce((a, b) => (a.busyness < b.busyness ? a : b))
    : null

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Live Status</h2>
            <div className="flex gap-4 mt-1 text-[11px] text-muted">
              <span>Real-time campus occupancy</span>
              {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                Live
              </span>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 rounded-lg text-[11px] font-medium
              bg-accent text-white hover:bg-accent/85 cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* Best spot banner */}
        {bestOverall && (
          <div className="rounded-xl border border-green/20 bg-green/5 px-5 py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-green font-semibold uppercase tracking-wider mb-0.5">Best Spot Right Now</div>
              <div className="text-[14px] text-text font-medium">{bestOverall.name}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[20px] font-bold" style={{ color: getStatusColor(bestOverall.busyness) }}>
                {bestOverall.busyness}%
              </div>
              <div className="font-mono text-[11px] text-muted">{bestOverall.people} / {bestOverall.capacity}</div>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('')}
            className={`text-[11px] px-3 py-1.5 rounded-lg cursor-pointer
              ${!filter ? 'bg-accent/12 text-accent font-semibold' : 'bg-surface text-muted hover:text-text'}`}
          >
            All ({locations.length})
          </button>
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.other
            const count = locations.filter((l) => l.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setFilter(filter === cat ? '' : cat as CategoryFilter)}
                className={`text-[11px] px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5
                  ${filter === cat ? 'font-semibold' : 'hover:opacity-80'}`}
                style={{
                  background: filter === cat ? `${meta.color}18` : 'var(--color-surface)',
                  color: filter === cat ? meta.color : 'var(--color-muted)',
                }}
              >
                <span>{meta.icon}</span>
                {meta.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Location cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((loc) => {
            const statusColor = getStatusColor(loc.busyness)
            const catMeta = CATEGORY_META[loc.category] || CATEGORY_META.other
            const isExpanded = expandedId === loc.id

            return (
              <div
                key={loc.id}
                className={`rounded-xl border bg-card overflow-hidden card-hover cursor-pointer
                  ${loc.isOpen ? 'border-border hover:border-border2' : 'border-border/50 opacity-60'}`}
                onClick={() => setExpandedId(isExpanded ? null : loc.id)}
              >
                {/* Card header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: loc.isOpen ? statusColor : '#3d4460' }}
                        />
                        <span className="text-[14px] font-semibold text-text">{loc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span style={{ color: catMeta.color }}>{catMeta.label}</span>
                        <span className="text-dim">&middot;</span>
                        <span className="text-muted">{loc.isOpen ? loc.hourSummary || 'Open' : 'Closed'}</span>
                      </div>
                    </div>
                    {loc.isOpen && <MiniTrend data={loc.trend} color={statusColor} />}
                  </div>

                  {/* Capacity bar */}
                  {loc.isOpen ? (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: statusColor, background: getStatusBg(loc.busyness) }}
                        >
                          {getStatusLabel(loc.busyness)} &middot; {loc.busyness}%
                        </span>
                        <span className="font-mono text-[11px] text-muted">{loc.people}/{loc.capacity}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(loc.busyness, 100)}%`,
                            background: `linear-gradient(90deg, ${statusColor}cc, ${statusColor})`,
                          }}
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-muted flex items-center gap-1">
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        Best time: <span className="text-accent font-medium">{loc.bestTime}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[12px] text-dim">{loc.hourSummary || 'Currently closed'}</div>
                  )}
                </div>

                {/* Expanded floor breakdown */}
                {isExpanded && loc.subLocs.length > 0 && (
                  <div className="border-t border-border/50 px-4 py-3 space-y-1.5 animate-fade-in">
                    <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Floor Breakdown</div>
                    {loc.subLocs.map((floor) => {
                      const floorColor = getStatusColor(floor.busyness)
                      return (
                        <div key={floor.id} className="flex items-center gap-2">
                          <span className="w-16 font-mono text-[11px] text-muted truncate shrink-0">
                            {floor.abbreviation || floor.name}
                          </span>
                          <div className="flex-1 h-3 rounded-full bg-surface overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(Math.min(floor.busyness, 100), 2)}%`,
                                background: floor.isOpen ? `linear-gradient(90deg, ${floorColor}aa, ${floorColor})` : '#3d4460',
                                opacity: floor.isOpen ? 1 : 0.3,
                              }}
                            />
                          </div>
                          <span className="w-20 text-right font-mono text-[11px] shrink-0" style={{ color: floor.isOpen ? floorColor : '#3d4460' }}>
                            {floor.isOpen ? `${floor.busyness}% · ${floor.people}` : 'Closed'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="text-[11px] text-dim text-center pb-6">
          Data from Waitz.io &middot; Auto-refreshes every 60s &middot; Click a card for floor details
        </div>
      </div>
    </div>
  )
}
