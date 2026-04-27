import { useState, useEffect, useMemo } from 'react'

// ── Types ──

interface MenuItem {
  name: string
  protein: number
  carbs: number
  fat: number
  calories: number
  price: number
  tags: string[]
  station: string
  nutrition_source?: 'hdh' | 'estimated' | 'sample'
}

interface LocationInfo {
  name: string
  college: string
  hours: Record<string, string>
  hours_str: string
  stations: string[]
  description: string
}

interface LocationMenu {
  info: LocationInfo
  meals: Record<string, MenuItem[]>
}

type MealPeriod = 'Breakfast' | 'Lunch' | 'Dinner'

// ── Helpers ──

// Standard UCSD meal times
const MEAL_TIMES: Record<MealPeriod, string> = {
  Breakfast: '7 – 10:30 am',
  Lunch: '11 am – 4 pm',
  Dinner: '5 – 9 pm',
}

function getCurrentMealPeriod(): MealPeriod {
  const h = new Date().getHours()
  if (h < 11) return 'Breakfast'
  if (h < 17) return 'Lunch'
  return 'Dinner'
}

function getOpenStatus(hours: Record<string, string>): { open: boolean; todayHours: string; nextOpen: string } {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const hour = now.getHours()

  // Find today's hours
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayName = dayNames[day]

  let todayHours = ''
  for (const [key, val] of Object.entries(hours)) {
    const parts = key.split('-').map(s => s.trim())
    // Check if today's day name is in the key range
    if (parts.some(p => todayName.startsWith(p.slice(0, 3))) || key.includes(todayName)) {
      todayHours = val
      break
    }
    // Handle ranges like "Mon-Fri"
    if (parts.length === 2) {
      const startIdx = dayNames.findIndex(d => parts[0].startsWith(d.slice(0, 3)))
      const endIdx = dayNames.findIndex(d => parts[1].startsWith(d.slice(0, 3)))
      if (startIdx !== -1 && endIdx !== -1) {
        if (startIdx <= endIdx ? (day >= startIdx && day <= endIdx) : (day >= startIdx || day <= endIdx)) {
          todayHours = val
          break
        }
      }
    }
  }

  if (!todayHours) todayHours = Object.values(hours)[0] || 'Unknown'

  const isClosed = todayHours.toLowerCase() === 'closed'
  let open = false
  if (!isClosed) {
    // Parse "7am-11pm" style
    const match = todayHours.match(/(\d+)(am|pm)?.*?(\d+)(am|pm)?/i)
    if (match) {
      let openH = parseInt(match[1])
      const openAmPm = (match[2] || 'am').toLowerCase()
      let closeH = parseInt(match[3])
      const closeAmPm = (match[4] || 'pm').toLowerCase()
      if (openAmPm === 'pm' && openH !== 12) openH += 12
      if (openAmPm === 'am' && openH === 12) openH = 0
      if (closeAmPm === 'pm' && closeH !== 12) closeH += 12
      if (closeAmPm === 'am' && closeH === 12) closeH = 0
      open = hour >= openH && hour < closeH
    }
  }

  // Figure out next open time
  let nextOpen = ''
  if (!open) {
    if (isClosed) {
      nextOpen = 'Closed today'
    } else {
      nextOpen = `Opens at ${todayHours.split('-')[0].trim()}`
    }
  }

  return { open, todayHours: isClosed ? 'Closed today' : todayHours, nextOpen }
}

function macroBar(protein: number, carbs: number, fat: number): { pPct: number; cPct: number; fPct: number } {
  const total = protein * 4 + carbs * 4 + fat * 9
  if (total === 0) return { pPct: 33, cPct: 33, fPct: 34 }
  return {
    pPct: Math.round((protein * 4 / total) * 100),
    cPct: Math.round((carbs * 4 / total) * 100),
    fPct: Math.round((fat * 9 / total) * 100),
  }
}

// ── Component ──

interface DiningProps {
  model: string
  onModelChange?: (m: string) => void
  geminiKey?: string | null
  onRequestKey?: () => void
}

export function Dining({ }: DiningProps) {
  const [menus, setMenus] = useState<Record<string, LocationMenu>>({})
  const [loading, setLoading] = useState(true)
  const [selectedHallId, setSelectedHallId] = useState('')
  const [selectedMeal, setSelectedMeal] = useState<MealPeriod>(getCurrentMealPeriod)
  const [selectedStation, setSelectedStation] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/dining/menus')
      .then(r => r.json())
      .then(d => {
        setMenus(d.menus || {})
        const ids = Object.keys(d.menus || {})
        if (ids.length > 0 && !selectedHallId) setSelectedHallId(ids[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const hallIds = Object.keys(menus)
  const hall = menus[selectedHallId]
  const info = hall?.info
  const hallStatus = info ? getOpenStatus(info.hours) : null

  // Items for selected meal
  const mealItems = useMemo(() => {
    if (!hall?.meals?.[selectedMeal]) return []
    return hall.meals[selectedMeal]
  }, [hall, selectedMeal])

  // Stations for current meal
  const stations = useMemo(() => {
    const s = new Set<string>()
    mealItems.forEach(item => { if (item.station) s.add(item.station) })
    return Array.from(s)
  }, [mealItems])

  // Filter items
  const filteredItems = useMemo(() => {
    let items = mealItems
    if (selectedStation) items = items.filter(i => i.station === selectedStation)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.station.toLowerCase().includes(q))
    }
    return items
  }, [mealItems, selectedStation, search])

  // Group by station
  const groupedByStation = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {}
    filteredItems.forEach(item => {
      const st = item.station || 'Other'
      if (!groups[st]) groups[st] = []
      groups[st].push(item)
    })
    return groups
  }, [filteredItems])

  // Is this meal currently being served?
  const isMealActive = (meal: MealPeriod): boolean => {
    if (!hallStatus?.open) return false
    return getCurrentMealPeriod() === meal
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin block" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex">
      {/* ═══ LEFT — Dining Hall List ═══ */}
      <div className="w-72 shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-base font-bold text-text">Dining Halls</h2>
          <div className="text-[11px] text-muted mt-0.5">{hallIds.length} locations on campus</div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {hallIds.map(id => {
            const h = menus[id]
            const isActive = selectedHallId === id
            const status = getOpenStatus(h.info.hours)
            return (
              <button key={id} onClick={() => { setSelectedHallId(id); setSelectedStation(''); setSearch('') }}
                className={`w-full text-left px-3 py-3 rounded-xl cursor-pointer transition-all mb-1 ${
                  isActive ? 'bg-accent/10 border border-accent/20' : 'hover:bg-card border border-transparent'
                }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.open ? 'bg-green' : 'bg-red/40'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-semibold ${isActive ? 'text-accent' : 'text-text'}`}>{h.info.name}</div>
                    <div className="text-[11px] text-muted">{h.info.college}</div>
                  </div>
                </div>
                <div className="text-[10px] text-muted mt-1.5 ml-5">
                  {status.open ? (
                    <span className="text-green font-medium">Open &middot; {status.todayHours}</span>
                  ) : (
                    <span className="text-muted">{status.nextOpen}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!hall ? (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">Select a dining hall</div>
        ) : (
          <>
            {/* ── Restaurant Info Card ── */}
            <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
              {/* Name + Status */}
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-text">{info.name}</h1>
                {hallStatus?.open ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green/10 text-green border border-green/20">Open</span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red/10 text-red border border-red/20">Closed</span>
                )}
              </div>

              {/* Info grid */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted mb-4">
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-accent">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493" />
                  </svg>
                  {info.college}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" className="text-accent">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Today: {hallStatus?.todayHours}
                </span>
              </div>

              {/* Description */}
              <p className="text-[13px] text-muted leading-relaxed mb-4">{info.description}</p>

              {/* Stations as visual list */}
              <div className="flex flex-wrap gap-2 mb-4">
                {info.stations.map(s => (
                  <span key={s} className="px-3 py-1.5 rounded-lg bg-card border border-border text-[12px] text-text font-medium">{s}</span>
                ))}
              </div>

              {/* Full hours accordion */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
                {Object.entries(info.hours).map(([days, time]) => (
                  <span key={days}><span className="font-medium text-text">{days}</span> {time}</span>
                ))}
              </div>
            </div>

            {/* ── Meal Tabs ── */}
            <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
              <div className="flex gap-1 bg-bg rounded-lg p-0.5">
                {(['Breakfast', 'Lunch', 'Dinner'] as MealPeriod[]).map(meal => {
                  const count = (hall.meals[meal] || []).length
                  const active = isMealActive(meal)
                  const hasItems = count > 0
                  return (
                    <button key={meal} onClick={() => { setSelectedMeal(meal); setSelectedStation('') }}
                      className={`px-4 py-2 rounded-md text-[12px] font-medium cursor-pointer transition-all relative ${
                        selectedMeal === meal
                          ? 'bg-card text-text shadow-sm'
                          : hasItems ? 'text-muted hover:text-text' : 'text-dim'
                      }`}>
                      <div>{meal}</div>
                      <div className={`text-[9px] mt-0.5 ${selectedMeal === meal ? 'text-muted' : 'text-dim'}`}>
                        {MEAL_TIMES[meal]}
                      </div>
                      {active && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex-1" />

              {/* Search */}
              <div className="relative">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..."
                  className="bg-bg border border-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-text outline-none focus:border-accent/50 placeholder:text-muted w-44" />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
                </svg>
              </div>

              <span className="text-[11px] text-muted tabular-nums">{filteredItems.length} items</span>
            </div>

            {/* ── Station Filters ── */}
            {stations.length > 1 && (
              <div className="px-6 py-2.5 border-b border-border flex flex-wrap gap-1.5 shrink-0">
                <button onClick={() => setSelectedStation('')}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-all ${
                    !selectedStation ? 'bg-accent text-white' : 'bg-card border border-border text-muted hover:text-text'
                  }`}>
                  All
                </button>
                {stations.map(s => (
                  <button key={s} onClick={() => setSelectedStation(s === selectedStation ? '' : s)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-all ${
                      selectedStation === s ? 'bg-accent text-white' : 'bg-card border border-border text-muted hover:text-text'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* ── Menu Items ── */}
            <div className="flex-1 overflow-y-auto">
              {mealItems.length === 0 ? (
                /* ── Closed / No menu state ── */
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-sm px-6">
                    <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                      {!hallStatus?.open ? (
                        <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-muted">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <span className="text-3xl">{selectedMeal === 'Breakfast' ? '\u2600\ufe0f' : selectedMeal === 'Lunch' ? '\u2615' : '\ud83c\udf19'}</span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-text mb-1">
                      {!hallStatus?.open
                        ? `${info.name} is closed right now`
                        : `No ${selectedMeal.toLowerCase()} menu`
                      }
                    </h3>
                    <p className="text-[13px] text-muted leading-relaxed mb-4">
                      {!hallStatus?.open
                        ? `Hours today: ${hallStatus?.todayHours}. Browse the menu for when it reopens.`
                        : `Try switching to ${selectedMeal === 'Breakfast' ? 'lunch' : selectedMeal === 'Lunch' ? 'dinner' : 'lunch'}.`
                      }
                    </p>
                    {/* Quick switch to a meal that has items */}
                    <div className="flex justify-center gap-2">
                      {(['Breakfast', 'Lunch', 'Dinner'] as MealPeriod[]).map(m => {
                        const c = (hall.meals[m] || []).length
                        if (c === 0 || m === selectedMeal) return null
                        return (
                          <button key={m} onClick={() => { setSelectedMeal(m); setSelectedStation('') }}
                            className="px-4 py-2 rounded-lg bg-accent/10 text-accent text-[12px] font-semibold cursor-pointer hover:bg-accent/20 transition-all">
                            View {m} ({c} items)
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-muted text-sm">No items match "{search}"</div>
              ) : (
                <div className="px-6 py-4">
                  {Object.entries(groupedByStation).map(([station, items]) => (
                    <div key={station} className="mb-8">
                      {/* Station header */}
                      <div className="flex items-center gap-2.5 mb-3 sticky top-0 bg-bg/90 backdrop-blur-sm py-2 z-10">
                        <div className="w-1 h-5 rounded-full bg-accent" />
                        <h3 className="text-[15px] font-bold text-text">{station}</h3>
                        <span className="text-[11px] text-muted font-medium">{items.length} items</span>
                      </div>

                      {/* Item grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {items.map((item, i) => {
                          const { pPct, cPct, fPct } = macroBar(item.protein, item.carbs, item.fat)
                          return (
                            <div key={`${item.name}-${i}`}
                              className="bg-card border border-border rounded-xl p-4 hover:border-border2 transition-all">
                              {/* Top: Name + Price */}
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <div className="text-[14px] font-semibold text-text leading-snug">{item.name}</div>
                                  {item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {item.tags.map(t => (
                                        <span key={t} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                          t === 'vegan' ? 'bg-green/10 text-green' :
                                          t === 'vegetarian' ? 'bg-green/10 text-green' :
                                          t === 'high-protein' ? 'bg-accent/10 text-accent' :
                                          t === 'gluten-free' ? 'bg-gold/10 text-gold' :
                                          'bg-card text-muted'
                                        }`}>{t}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {item.price > 0 && (
                                  <span className="text-[15px] font-bold text-text shrink-0">${item.price.toFixed(2)}</span>
                                )}
                              </div>

                              {/* Bottom: Macros */}
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 text-[12px] flex-wrap">
                                  <span className="font-bold text-text tabular-nums">{item.calories} <span className="text-[10px] text-muted font-normal">cal</span></span>
                                  <span className="font-semibold text-accent tabular-nums">{item.protein}g <span className="text-[10px] text-muted font-normal">protein</span></span>
                                  <span className="font-semibold text-gold tabular-nums">{item.carbs}g <span className="text-[10px] text-muted font-normal">carbs</span></span>
                                  <span className="font-semibold text-red tabular-nums">{item.fat}g <span className="text-[10px] text-muted font-normal">fat</span></span>
                                </div>

                                <div className="flex-1" />

                                {/* Visual macro bar */}
                                <div className="w-16 h-2 rounded-full overflow-hidden flex shrink-0">
                                  <div className="bg-accent" style={{ width: `${pPct}%` }} />
                                  <div className="bg-gold" style={{ width: `${cPct}%` }} />
                                  <div className="bg-red" style={{ width: `${fPct}%` }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
