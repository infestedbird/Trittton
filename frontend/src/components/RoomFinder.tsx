import { useState, useEffect, useCallback } from 'react'

interface RoomInfo {
  room: string
  available: boolean
  free_minutes: number
  free_until: string | null
  current_class: { course: string; type: string; end: string } | null
  next_class: { course: string; type: string; start: string; end: string } | null
  total_classes_today: number
}

interface RoomData {
  check_day: number
  check_time: string
  total_rooms: number
  available_rooms: number
  buildings: Record<string, RoomInfo[]>
  error?: string
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'p' : 'a'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

function freeLabel(mins: number): string {
  if (mins >= 600) return 'Free all day'
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m free`
  return `${mins}m free`
}

export function RoomFinder() {
  const [data, setData] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBuilding, setSelectedBuilding] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showOccupied, setShowOccupied] = useState(false)
  const [checkDay, setCheckDay] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) // Convert JS day (0=Sun) to Mon=0
  const [checkTime, setCheckTime] = useState<string>('')

  const fetchRooms = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('day', String(checkDay))
    if (checkTime) params.set('time', checkTime)
    fetch(`/api/rooms/available?${params}`)
      .then(r => r.json())
      .then((d: RoomData) => {
        setData(d)
        if (!selectedBuilding && d.buildings) {
          // Auto-select building with most available rooms
          const sorted = Object.entries(d.buildings).sort((a, b) => {
            const aFree = a[1].filter(r => r.available).length
            const bFree = b[1].filter(r => r.available).length
            return bFree - aFree
          })
          if (sorted.length > 0) setSelectedBuilding(sorted[0][0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [checkDay, checkTime])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchRooms, 120000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  // Refresh when tab becomes visible
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchRooms() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchRooms])

  if (loading && !data) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (data?.error) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">{'\ud83c\udfeb'}</div>
          <div className="text-sm text-muted">{data.error}</div>
          <p className="text-xs text-dim mt-2">Load course data first (scrape or upload JSON)</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const buildings = data.buildings
  const buildingIds = Object.keys(buildings)
  const currentRooms = buildings[selectedBuilding] || []

  // Filter rooms
  const filteredRooms = currentRooms.filter(r => {
    if (!showOccupied && !r.available) return false
    if (search && !r.room.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Building stats
  const buildingStats = buildingIds.map(b => ({
    id: b,
    total: buildings[b].length,
    free: buildings[b].filter(r => r.available).length,
  })).sort((a, b) => b.free - a.free)

  const isNow = !checkTime

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* ════════ LEFT SIDEBAR — Building List ════════ */}
      <div className="w-72 shrink-0 border-r border-border bg-surface/50 flex flex-col overflow-hidden">
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Buildings</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-dim">{buildingIds.length} buildings</span>
            <span className="text-dim text-[10px]">{'\u00b7'}</span>
            <span className="text-[11px] text-green font-medium">{data.available_rooms} rooms free</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {buildingStats.map(({ id, total, free }) => {
            const isSelected = selectedBuilding === id
            const pct = total > 0 ? (free / total) * 100 : 0
            return (
              <button key={id} onClick={() => setSelectedBuilding(id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl cursor-pointer transition-all group
                  ${isSelected
                    ? 'bg-card border border-accent/30 shadow-sm'
                    : 'hover:bg-card/60 border border-transparent'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${free > 0 ? 'bg-green' : 'bg-red/60'}`} />
                    <span className={`text-[13px] font-semibold truncate ${isSelected ? 'text-text' : 'text-muted group-hover:text-text'}`}>
                      {id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium ${free > 0 ? 'text-green' : 'text-dim'}`}>{free}/{total}</span>
                  </div>
                </div>
                {/* Mini bar */}
                <div className="mt-1.5 h-1 bg-surface rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: pct > 50 ? '#3dd68c' : pct > 20 ? '#f5c842' : '#f25f5c' }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ════════ MAIN CONTENT ════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top controls */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Day picker */}
            <div className="flex gap-1 bg-surface rounded-xl p-1">
              {DAY_NAMES.map((d, i) => (
                <button key={d} onClick={() => setCheckDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all
                    ${checkDay === i ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
                  {d}
                </button>
              ))}
            </div>

            {/* Time input */}
            <div className="flex items-center gap-2">
              <input type="time" value={checkTime} onChange={e => setCheckTime(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-[12px] text-text outline-none focus:border-accent/50" />
              {checkTime && (
                <button onClick={() => setCheckTime('')}
                  className="text-[11px] text-accent cursor-pointer hover:underline">Now</button>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rooms..."
                className="bg-surface border border-border rounded-xl pl-8 pr-3 py-1.5 text-[12px] text-text outline-none focus:border-accent/50 placeholder:text-dim w-40" />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>

            {/* Show occupied toggle */}
            <button onClick={() => setShowOccupied(!showOccupied)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-medium cursor-pointer transition-all
                ${showOccupied ? 'bg-accent/15 text-accent border border-accent/25' : 'bg-card border border-border text-muted hover:text-text'}`}>
              {showOccupied ? 'All Rooms' : 'Free Only'}
            </button>

            {/* Refresh indicator */}
            <div className="ml-auto flex items-center gap-2">
              {isNow && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                  <span className="text-[10px] text-dim">Live</span>
                </div>
              )}
              <button onClick={fetchRooms}
                className="text-[11px] text-muted hover:text-text cursor-pointer flex items-center gap-1">
                <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedBuilding ? (
            <>
              {/* Building header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-2xl">{'\ud83c\udfeb'}</span>
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-text">{selectedBuilding}</h1>
                  <div className="text-sm text-muted">
                    {DAY_NAMES_FULL[checkDay]}
                    {checkTime ? ` at ${formatTime(checkTime)}` : ` \u00b7 ${formatTime(data.check_time)}`}
                    <span className="text-dim"> &middot; </span>
                    <span className="text-green font-medium">
                      {currentRooms.filter(r => r.available).length} of {currentRooms.length} rooms free
                    </span>
                  </div>
                </div>
              </div>

              {/* Room grid */}
              {filteredRooms.length === 0 ? (
                <div className="py-16 text-center text-sm text-dim">
                  {showOccupied ? 'No rooms match your search' : 'No empty rooms right now — try a different time'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredRooms.map(room => (
                    <div key={room.room}
                      className={`rounded-xl border p-4 transition-all ${
                        room.available
                          ? 'bg-card border-green/20 hover:border-green/40'
                          : 'bg-surface/50 border-border opacity-60'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${room.available ? 'bg-green' : 'bg-red/70'}`} />
                          <span className="text-[15px] font-bold text-text">{selectedBuilding} {room.room}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          room.available ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                        }`}>
                          {room.available ? 'EMPTY' : 'IN USE'}
                        </span>
                      </div>

                      {room.available ? (
                        <div>
                          <div className="text-[13px] font-semibold text-green mb-1">
                            {freeLabel(room.free_minutes)}
                          </div>
                          {room.next_class ? (
                            <div className="text-[11px] text-muted">
                              Next: <span className="text-text font-medium">{room.next_class.course}</span>
                              {' '}at {formatTime(room.next_class.start)}
                            </div>
                          ) : (
                            <div className="text-[11px] text-dim">No more classes today</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {room.current_class && (
                            <div className="text-[11px] text-muted">
                              <span className="text-text font-medium">{room.current_class.course}</span>
                              {' '}({room.current_class.type}) until {formatTime(room.current_class.end)}
                            </div>
                          )}
                          {room.next_class && room.next_class.course !== room.current_class?.course && (
                            <div className="text-[11px] text-dim mt-0.5">
                              Then: {room.next_class.course} at {formatTime(room.next_class.start)}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2 text-[10px] text-dim">
                        {room.total_classes_today} class{room.total_classes_today !== 1 ? 'es' : ''} today
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-dim">Select a building</div>
          )}
        </div>
      </div>
    </div>
  )
}
