import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Types ──

interface TransitRoute {
  route_id: string
  short_name: string
  long_name: string
  color: string
  type: number
}

interface TransitStop {
  stop_id: string
  name: string
  lat: number
  lon: number
  routes: string[]
}

interface Departure {
  route_id: string
  route_name: string
  route_color: string
  route_type: number
  headsign: string
  scheduled_time: string
  minutes_away: number
  is_late_night: boolean
}

interface RouteStopInfo {
  stop_id: string
  name: string
  sequence: number
  lat?: number
  lon?: number
  next_departure: { time: string; minutes: number } | null
}

interface GeoResult {
  display_name: string
  lat: string
  lon: string
}

interface DirectionStep {
  mode: 'walk' | 'wait' | 'ride'
  description: string
  minutes: number
  departs?: string
  stops?: number
}

interface DirectionOption {
  type: 'transit' | 'walk_only'
  total_minutes: number
  route_name?: string
  route_long_name?: string
  route_color?: string
  route_type?: number
  board_stop?: string
  board_lat?: number
  board_lon?: number
  board_time?: string
  alight_stop?: string
  alight_lat?: number
  alight_lon?: number
  estimated?: boolean
  leave_by?: string
  arrive_by?: string
  on_time?: boolean
  timing_note?: string
  steps: DirectionStep[]
}

// ── Helpers ──

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function minutesLabel(min: number): string {
  if (min <= 0) return 'Now'
  if (min === 1) return '1 min'
  return `${min} min`
}

function routeTypeLabel(r: TransitRoute): string {
  if (r.type === 0) return 'Trolley'
  if (['201', '202', '204', '237'].includes(r.route_id)) return 'Campus'
  return 'Bus'
}

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function walkMinutes(km: number): number {
  return Math.ceil(km / 0.08) // ~5 km/h = 0.083 km/min
}

function googleMapsTransitUrl(destLat: number, destLon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&travelmode=transit`
}

function googleMapsWalkUrl(destLat: number, destLon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&travelmode=walking`
}

function appleMapsUrl(lat: number, lon: number): string {
  return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=r&t=m`
}

function makeStopIcon(color: string, isSelected: boolean, label?: string): L.DivIcon {
  const size = isSelected ? 22 : 14
  if (label) {
    return L.divIcon({
      className: '',
      iconSize: [0, 0],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="display:flex;align-items:center;gap:4px;pointer-events:auto">
        <div style="width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid ${color};background:${color};box-shadow:0 1px 4px rgba(0,0,0,0.25)${isSelected ? `;box-shadow:0 0 0 4px ${color}30,0 1px 4px rgba(0,0,0,0.3)` : ''}"></div>
        <div style="background:rgba(30,30,32,0.88);backdrop-filter:blur(8px);color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${label}</div>
      </div>`,
    })
  }
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid ${color};background:${color};box-shadow:0 1px 4px rgba(0,0,0,0.25)${isSelected ? `;box-shadow:0 0 0 4px ${color}30,0 1px 4px rgba(0,0,0,0.3)` : ''}"></div>`,
  })
}

function makeDestIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:28px;height:28px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>
    </div>`,
  })
}

const UCSD_CENTER: [number, number] = [32.8801, -117.2340]

// ── Map controls ──
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } else if (points.length === 1) {
      map.flyTo(points[0], 16, { duration: 0.6 })
    }
  }, [points, map])
  return null
}

// ── Main Component ──

export function Transit() {
  const [routes, setRoutes] = useState<TransitRoute[]>([])
  const [allStops, setAllStops] = useState<TransitStop[]>([])
  const [departures, setDepartures] = useState<Departure[]>([])
  const [routeStops, setRouteStops] = useState<RouteStopInfo[]>([])
  const [selectedRoute, setSelectedRoute] = useState<TransitRoute | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedStopId, setSelectedStopId] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [stopName, setStopName] = useState('')
  const [currentTime, setCurrentTime] = useState('')

  // Directions
  const [destSearch, setDestSearch] = useState('')
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [destination, setDestination] = useState<{ name: string; lat: number; lon: number } | null>(null)
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>([])
  const [directionsLoading, setDirectionsLoading] = useState(false)
  const [activeOptionIdx, setActiveOptionIdx] = useState(0)
  const geoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetchers ──

  const fetchRoutes = useCallback(() => {
    return fetch('/api/transit/routes').then(r => r.json()).then(d => { if (d.routes) setRoutes(d.routes) }).catch(() => {})
  }, [])

  const fetchStops = useCallback(() => {
    return fetch('/api/transit/stops').then(r => r.json()).then(d => { if (d.stops) setAllStops(d.stops) }).catch(() => {})
  }, [])

  const fetchDepartures = useCallback(() => {
    if (!selectedStopId) return
    fetch(`/api/transit/departures?stop_id=${selectedStopId}`)
      .then(r => r.json())
      .then(d => {
        setDepartures(d.departures || [])
        setStopName(d.stop_name || '')
        setCurrentTime(d.current_time || '')
      }).catch(() => {})
  }, [selectedStopId])

  const fetchRouteStops = useCallback(() => {
    if (!selectedRouteId) return
    fetch(`/api/transit/route/${selectedRouteId}/stops`)
      .then(r => r.json())
      .then(d => {
        setRouteStops(d.stops || [])
        if (d.route) setSelectedRoute(d.route)
      }).catch(() => {})
  }, [selectedRouteId])

  // ── Effects ──

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchRoutes(), fetchStops()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (selectedStopId) fetchDepartures() }, [selectedStopId, fetchDepartures])
  useEffect(() => { if (selectedRouteId) fetchRouteStops() }, [selectedRouteId, fetchRouteStops])

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedStopId) fetchDepartures()
      if (selectedRouteId) fetchRouteStops()
    }, 30000)
    return () => clearInterval(interval)
  }, [selectedStopId, selectedRouteId, fetchDepartures, fetchRouteStops])

  // Geocode destination search (Nominatim, debounced)
  useEffect(() => {
    if (geoTimeout.current) clearTimeout(geoTimeout.current)
    if (!destSearch || destSearch.length < 3) { setGeoResults([]); return }
    geoTimeout.current = setTimeout(() => {
      const q = encodeURIComponent(destSearch + ', San Diego, CA')
      fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&bounded=1&viewbox=-117.35,32.65,-117.05,33.05`, {
        headers: { 'Accept-Language': 'en' }
      })
        .then(r => r.json())
        .then(data => setGeoResults(data || []))
        .catch(() => setGeoResults([]))
    }, 400)
  }, [destSearch])

  // When destination is set, fetch directions from API
  useEffect(() => {
    if (!destination) { setDirectionOptions([]); return }
    setDirectionsLoading(true)
    fetch(`/api/transit/directions?dest_lat=${destination.lat}&dest_lon=${destination.lon}`)
      .then(r => r.json())
      .then(d => { setDirectionOptions(d.options || []); setActiveOptionIdx(0) })
      .catch(() => setDirectionOptions([]))
      .finally(() => setDirectionsLoading(false))
  }, [destination])

  // ── Handlers ──

  const selectStop = (stopId: string) => {
    setSelectedStopId(stopId)
    setDepartures([])
  }

  const selectRoute = (routeId: string) => {
    setSelectedRouteId(routeId)
    setSelectedStopId('')
    setDepartures([])
    setRouteStops([])
    setDestination(null)
  }

  const selectDestination = (geo: GeoResult) => {
    setDestination({ name: geo.display_name.split(',')[0], lat: parseFloat(geo.lat), lon: parseFloat(geo.lon) })
    setGeoResults([])
    setDestSearch(geo.display_name.split(',')[0])
    setSelectedRouteId('')
    setSelectedRoute(null)
    setRouteStops([])
    setSelectedStopId('')
  }

  const clearDestination = () => {
    setDestination(null)
    setDestSearch('')
    setNearestStops([])
    setGeoResults([])
  }

  // ── Derived data ──

  const enrichedRouteStops = useMemo(() => {
    return routeStops.map(rs => {
      if (rs.lat && rs.lon) return rs
      const found = allStops.find(s => s.stop_id === rs.stop_id)
      return { ...rs, lat: found?.lat ?? rs.lat, lon: found?.lon ?? rs.lon }
    })
  }, [routeStops, allStops])

  const routePolyline = useMemo((): [number, number][] => {
    return enrichedRouteStops.filter(s => s.lat && s.lon).map(s => [s.lat!, s.lon!])
  }, [enrichedRouteStops])

  const selectedStopObj = useMemo(() => {
    const fromAll = allStops.find(s => s.stop_id === selectedStopId)
    if (fromAll) return fromAll
    const fromRoute = enrichedRouteStops.find(s => s.stop_id === selectedStopId)
    if (fromRoute?.lat && fromRoute?.lon) return { stop_id: fromRoute.stop_id, name: fromRoute.name, lat: fromRoute.lat, lon: fromRoute.lon, routes: [] }
    return undefined
  }, [allStops, enrichedRouteStops, selectedStopId])

  // Active direction option for map drawing
  const activeOption = destination && directionOptions.length > 0 ? directionOptions[activeOptionIdx] : null

  // Route segments for map: walk line (dashed) + ride line (solid)
  const directionSegments = useMemo(() => {
    if (!activeOption || !destination) return { walkTo: [] as [number, number][], ride: [] as [number, number][], walkFrom: [] as [number, number][] }
    const walkTo: [number, number][] = []
    const ride: [number, number][] = []
    const walkFrom: [number, number][] = []

    if (activeOption.type === 'walk_only') {
      walkTo.push(UCSD_CENTER, [destination.lat, destination.lon])
    } else if (activeOption.board_lat && activeOption.board_lon) {
      walkTo.push(UCSD_CENTER, [activeOption.board_lat, activeOption.board_lon])
      if (activeOption.alight_lat && activeOption.alight_lon) {
        ride.push([activeOption.board_lat, activeOption.board_lon], [activeOption.alight_lat, activeOption.alight_lon])
        walkFrom.push([activeOption.alight_lat, activeOption.alight_lon], [destination.lat, destination.lon])
      } else {
        ride.push([activeOption.board_lat, activeOption.board_lon], [destination.lat, destination.lon])
      }
    }
    return { walkTo, ride, walkFrom }
  }, [activeOption, destination])

  const mapFocusPoints = useMemo((): [number, number][] => {
    if (destination) {
      const pts: [number, number][] = [[destination.lat, destination.lon]]
      if (activeOption?.board_lat) pts.push([activeOption.board_lat!, activeOption.board_lon!])
      pts.push(UCSD_CENTER)
      return pts
    }
    if (routePolyline.length > 0) return routePolyline
    if (selectedStopObj) return [[selectedStopObj.lat, selectedStopObj.lon]]
    return []
  }, [routePolyline, selectedStopObj, destination, directionOptions])

  const campusLoops = routes.filter(r => ['201', '202', '204', '237'].includes(r.route_id))
  const busRoutes = routes.filter(r => r.type === 3 && !['201', '202', '204', '237'].includes(r.route_id))
  const trolleyRoutes = routes.filter(r => r.type === 0)

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin block" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex">
      {/* ════ LEFT SIDEBAR ════ */}
      <div className="w-80 shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden z-10">
        {/* Header + Search */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-text">Transit</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                <span className="text-[11px] text-muted">{routes.length} routes &middot; Live</span>
              </div>
            </div>
            {currentTime && <span className="text-[11px] text-muted font-mono">{formatTime(currentTime)}</span>}
          </div>

          {/* Destination search */}
          <div className="relative">
            <div className="relative">
              <input
                value={destSearch}
                onChange={e => setDestSearch(e.target.value)}
                placeholder="Where are you going?"
                className="w-full bg-bg border border-border rounded-lg pl-9 pr-8 py-2.5 text-[13px] text-text outline-none focus:border-accent placeholder:text-muted"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {destSearch && (
                <button onClick={clearDestination} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer p-0.5">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {geoResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {geoResults.map((g, i) => (
                  <button key={i} onClick={() => selectDestination(g)}
                    className="w-full text-left px-3 py-2.5 text-[12px] text-text hover:bg-surface cursor-pointer transition-colors border-b border-border/50 last:border-0">
                    <div className="font-medium truncate">{g.display_name.split(',')[0]}</div>
                    <div className="text-[10px] text-muted truncate mt-0.5">{g.display_name.split(',').slice(1, 3).join(',')}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Directions panel ── */}
        {destination && (
          <div className="border-b border-border px-3 pb-3 mb-1 shrink-0">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[13px] font-semibold text-text">{destination.name}</div>
                <div className="text-[11px] text-muted mt-0.5">
                  {haversine(UCSD_CENTER[0], UCSD_CENTER[1], destination.lat, destination.lon).toFixed(1)} km from UCSD
                </div>
              </div>
              <button onClick={clearDestination} className="text-muted hover:text-text cursor-pointer p-1 shrink-0">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Route options */}
            {directionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span className="text-[12px] text-muted ml-2">Finding routes...</span>
              </div>
            ) : directionOptions.length > 0 ? (
              <div className="space-y-2">
                {directionOptions.map((opt, i) => {
                  const isActive = i === activeOptionIdx
                  return (
                  <div key={i} onClick={() => setActiveOptionIdx(i)}
                    className={`rounded-xl border overflow-hidden cursor-pointer transition-all ${
                      isActive ? 'border-accent/40 bg-accent/5 shadow-sm' : 'border-border bg-card hover:border-border2'
                    }`}>
                    {/* Option header */}
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {opt.type === 'transit' ? (
                          <span className="w-8 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: `#${opt.route_color || '888'}` }}>
                            {opt.route_type === 0 ? 'BL' : opt.route_name}
                          </span>
                        ) : (
                          <span className="w-8 h-5 rounded-md bg-green/15 text-green flex items-center justify-center text-[10px]">
                            {'\ud83d\udeb6'}
                          </span>
                        )}
                        <div>
                          <div className="text-[12px] font-medium text-text">
                            {opt.type === 'transit' ? (opt.route_long_name || opt.route_name) : 'Walk'}
                          </div>
                          {/* Timing note */}
                          {opt.timing_note && (
                            <div className={`text-[10px] font-semibold ${
                              opt.timing_note.includes('Hurry') ? 'text-red' :
                              opt.timing_note.includes('now') ? 'text-gold' : 'text-green'
                            }`}>
                              {opt.timing_note}
                              {opt.board_time && opt.type === 'transit' && (
                                <span className="text-muted font-normal ml-1">· departs {formatTime(opt.board_time)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[16px] font-bold ${isActive ? 'text-accent' : 'text-text'}`}>
                          ~{opt.total_minutes}<span className="text-[11px] font-medium text-muted ml-0.5">min</span>
                        </div>
                        {opt.arrive_by && (
                          <div className="text-[10px] text-muted">arrive {formatTime(opt.arrive_by)}</div>
                        )}
                      </div>
                    </div>

                    {/* Steps — only show for active option */}
                    {isActive && (
                      <div className="px-3 pb-2.5 space-y-1 border-t border-border/30 pt-2">
                        {opt.steps.map((step, j) => (
                          <div key={j} className="flex items-center gap-2 text-[11px]">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] ${
                              step.mode === 'walk' ? 'bg-green/15' :
                              step.mode === 'ride' ? 'bg-accent/15' :
                              'bg-gold/15'
                            }`}>
                              {step.mode === 'walk' ? '\ud83d\udeb6' : step.mode === 'ride' ? '\ud83d\ude8c' : '\u23f3'}
                            </span>
                            <span className="text-muted flex-1">{step.description}</span>
                            <span className="text-text font-semibold shrink-0">{step.minutes} min</span>
                          </div>
                        ))}

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-2 pt-2 border-t border-border/30">
                          <a href={googleMapsTransitUrl(destination.lat, destination.lon)} target="_blank" rel="noopener"
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-accent/10 text-accent text-[11px] font-semibold hover:bg-accent/20 transition-colors">
                            Google Maps &rarr;
                          </a>
                          <a href={appleMapsUrl(destination.lat, destination.lon)} target="_blank" rel="noopener"
                            className="px-3 py-1.5 rounded-lg bg-card border border-border text-[11px] text-muted hover:text-text transition-colors">
                            Apple Maps
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Departure panel ── */}
        {selectedStopId && departures.length > 0 && !destination && (
          <div className="border-b border-border px-3 pb-3 mb-1 max-h-[45%] overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-2 sticky top-0 bg-surface py-1 z-10">
              <div>
                <div className="text-[13px] font-semibold text-text">{stopName}</div>
                <div className="text-[11px] text-muted">{departures.length} departures</div>
              </div>
              <button onClick={() => { setSelectedStopId(''); setDepartures([]) }}
                className="text-muted hover:text-text cursor-pointer text-sm p-1">&times;</button>
            </div>
            <div className="space-y-1">
              {departures.slice(0, 10).map((dep, i) => (
                <div key={`${dep.route_id}-${i}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${dep.minutes_away <= 5 ? 'bg-green/8' : 'bg-card'}`}>
                  <span className="w-9 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: `#${dep.route_color}` }}>
                    {dep.route_type === 0 ? 'BL' : dep.route_name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-text truncate">{dep.headsign}</div>
                    <div className="text-[10px] text-muted">{formatTime(dep.scheduled_time)}</div>
                  </div>
                  <div className={`text-[14px] font-bold shrink-0 ${dep.minutes_away <= 5 ? 'text-green' : 'text-text'}`}>
                    {minutesLabel(dep.minutes_away)}
                  </div>
                </div>
              ))}
            </div>
            {/* Navigate to stop */}
            {selectedStopObj && (
              <div className="flex gap-2 mt-3">
                <a href={googleMapsWalkUrl(selectedStopObj.lat, selectedStopObj.lon)} target="_blank" rel="noopener"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-[12px] font-semibold cursor-pointer hover:bg-accent/90 transition-all">
                  Walk to Stop
                </a>
                <a href={appleMapsUrl(selectedStopObj.lat, selectedStopObj.lon)} target="_blank" rel="noopener"
                  className="px-3 py-2 rounded-lg bg-card border border-border text-[12px] font-medium text-muted hover:text-text cursor-pointer transition-all">
                  Apple Maps
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Route stop list ── */}
        {selectedRouteId && selectedRoute && enrichedRouteStops.length > 0 && !destination && !selectedStopId && (
          <div className="border-b border-border px-3 pb-3 mb-1 max-h-[50%] overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-2 sticky top-0 bg-surface py-1 z-10">
              <div className="flex items-center gap-2">
                <span className="w-8 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: `#${selectedRoute.color}` }}>
                  {selectedRoute.type === 0 ? 'BL' : selectedRoute.short_name}
                </span>
                <span className="text-[13px] font-semibold text-text">{selectedRoute.long_name.split(' - ')[0]}</span>
              </div>
              <button onClick={() => { setSelectedRouteId(''); setSelectedRoute(null); setRouteStops([]) }}
                className="text-muted hover:text-text cursor-pointer text-sm p-1">&times;</button>
            </div>
            <div className="space-y-0.5">
              {enrichedRouteStops.map((stop, i) => {
                const hasService = !!stop.next_departure
                return (
                  <button key={`${stop.stop_id}-${i}`} onClick={() => selectStop(stop.stop_id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer transition-all
                      ${selectedStopId === stop.stop_id ? 'bg-accent/10' : 'hover:bg-card'}`}>
                    <div className="w-3 h-3 rounded-full border-2 shrink-0"
                      style={{ borderColor: `#${selectedRoute.color}`, background: hasService ? `#${selectedRoute.color}` : 'transparent' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-text truncate">{stop.name}</div>
                    </div>
                    {hasService && (
                      <span className={`text-[12px] font-bold shrink-0 ${stop.next_departure!.minutes <= 5 ? 'text-green' : 'text-muted'}`}>
                        {minutesLabel(stop.next_departure!.minutes)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Route browser ── */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {campusLoops.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Campus Loops</div>
              {campusLoops.map(r => <RouteItem key={r.route_id} route={r} isSelected={selectedRouteId === r.route_id} onSelect={selectRoute} />)}
            </div>
          )}
          {busRoutes.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">City Buses</div>
              {busRoutes.map(r => <RouteItem key={r.route_id} route={r} isSelected={selectedRouteId === r.route_id} onSelect={selectRoute} />)}
            </div>
          )}
          {trolleyRoutes.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">Trolley</div>
              {trolleyRoutes.map(r => <RouteItem key={r.route_id} route={r} isSelected={selectedRouteId === r.route_id} onSelect={selectRoute} />)}
            </div>
          )}
        </div>
      </div>

      {/* ════ MAP ════ */}
      <div className="flex-1 relative">
        <MapContainer center={UCSD_CENTER} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          {/* Clean, readable map tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {mapFocusPoints.length > 0 && <FitBounds points={mapFocusPoints} />}

          {/* Route polyline */}
          {routePolyline.length > 1 && selectedRoute && (
            <>
              {/* Shadow line */}
              <Polyline positions={routePolyline} pathOptions={{ color: '#000', weight: 7, opacity: 0.15 }} />
              {/* Main line */}
              <Polyline positions={routePolyline} pathOptions={{ color: `#${selectedRoute.color}`, weight: 5, opacity: 0.9 }} />
            </>
          )}

          {/* Route stop markers WITH departure labels */}
          {selectedRouteId && enrichedRouteStops.map((stop, i) => {
            if (!stop.lat || !stop.lon) return null
            const hasService = !!stop.next_departure
            const isThisStop = selectedStopId === stop.stop_id
            const label = hasService ? minutesLabel(stop.next_departure!.minutes) : undefined
            return (
              <Marker
                key={`route-${stop.stop_id}-${i}`}
                position={[stop.lat, stop.lon]}
                icon={makeStopIcon(`#${selectedRoute?.color || '3b82f6'}`, isThisStop, label)}
                eventHandlers={{ click: () => selectStop(stop.stop_id) }}
              >
                <Popup>
                  <StopPopup name={stop.name} lat={stop.lat} lon={stop.lon}
                    nextMin={hasService ? stop.next_departure!.minutes : undefined}
                    nextTime={hasService ? stop.next_departure!.time : undefined} />
                </Popup>
              </Marker>
            )
          })}

          {/* All stops when no route selected (and no destination) */}
          {!selectedRouteId && !destination && allStops.map(stop => {
            if (!stop.lat || !stop.lon) return null
            const isThisStop = selectedStopId === stop.stop_id
            return (
              <Marker
                key={stop.stop_id}
                position={[stop.lat, stop.lon]}
                icon={makeStopIcon('#3b82f6', isThisStop)}
                eventHandlers={{ click: () => selectStop(stop.stop_id) }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95} permanent={false}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{stop.name}</span>
                </Tooltip>
              </Marker>
            )
          })}

          {/* Destination marker */}
          {destination && (
            <Marker position={[destination.lat, destination.lon]} icon={makeDestIcon()}>
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{destination.name}</div>
                  <a href={googleMapsTransitUrl(destination.lat, destination.lon)} target="_blank" rel="noopener"
                    style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                    Get transit directions &rarr;
                  </a>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ── Direction route visualization ── */}
          {destination && activeOption && (
            <>
              {/* Walk to stop — dashed green line */}
              {directionSegments.walkTo.length > 1 && (
                <Polyline positions={directionSegments.walkTo} pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.7, dashArray: '8, 10' }} />
              )}
              {/* Ride — solid colored line */}
              {directionSegments.ride.length > 1 && (
                <>
                  <Polyline positions={directionSegments.ride} pathOptions={{ color: '#000', weight: 7, opacity: 0.12 }} />
                  <Polyline positions={directionSegments.ride} pathOptions={{ color: `#${activeOption.route_color || '3b82f6'}`, weight: 5, opacity: 0.9 }} />
                </>
              )}
              {/* Walk from stop to destination — dashed green line */}
              {directionSegments.walkFrom.length > 1 && (
                <Polyline positions={directionSegments.walkFrom} pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.7, dashArray: '8, 10' }} />
              )}
            </>
          )}

          {/* Boarding stop marker for active option */}
          {destination && activeOption?.type === 'transit' && activeOption.board_lat && (
            <Marker
              position={[activeOption.board_lat!, activeOption.board_lon!]}
              icon={makeStopIcon(`#${activeOption.route_color || '3b82f6'}`, true,
                `Board ${activeOption.route_name}${activeOption.board_time ? ' at ' + formatTime(activeOption.board_time) : ''}`)}
            >
              <Popup>
                <StopPopup name={activeOption.board_stop || ''} lat={activeOption.board_lat!} lon={activeOption.board_lon!}
                  nextTime={activeOption.board_time || undefined} />
              </Popup>
            </Marker>
          )}

          {/* UCSD origin marker when showing directions */}
          {destination && (
            <Marker position={UCSD_CENTER} icon={makeStopIcon('#3b82f6', true, 'You (UCSD)')}>
              <Popup>
                <div style={{ fontFamily: 'system-ui', fontWeight: 600, fontSize: 14 }}>UCSD Campus</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Map legend overlay */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-lg text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ──

function StopPopup({ name, lat, lon, nextMin, nextTime, walkMin }: {
  name: string; lat: number; lon: number; nextMin?: number; nextTime?: string; walkMin?: number
}) {
  return (
    <div style={{ minWidth: 180, fontFamily: 'system-ui', lineHeight: 1.4 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#1c1c1e' }}>{name}</div>
      {nextMin !== undefined && (
        <div style={{ fontSize: 13, marginBottom: 2 }}>
          <span style={{ color: nextMin <= 5 ? '#16a34a' : '#1c1c1e', fontWeight: 600 }}>Next: {minutesLabel(nextMin)}</span>
          {nextTime && <span style={{ color: '#888', marginLeft: 6, fontSize: 12 }}>{formatTime(nextTime)}</span>}
        </div>
      )}
      {walkMin !== undefined && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{walkMin} min walk from destination</div>
      )}
      <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
        <a href={googleMapsWalkUrl(lat, lon)} target="_blank" rel="noopener"
          style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
          Walk here &rarr;
        </a>
        <a href={appleMapsUrl(lat, lon)} target="_blank" rel="noopener"
          style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>
          Apple Maps
        </a>
      </div>
    </div>
  )
}

function RouteItem({ route, isSelected, onSelect }: { route: TransitRoute; isSelected: boolean; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(route.route_id)}
      className={`w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-3 mb-0.5
        ${isSelected ? 'bg-accent/10' : 'hover:bg-card'}`}>
      <span className="w-10 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm"
        style={{ background: `#${route.color}` }}>
        {route.type === 0 ? '\ud83d\ude8a' : route.short_name}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[12px] font-medium truncate ${isSelected ? 'text-accent' : 'text-text'}`}>
          {route.long_name}
        </div>
        <div className="text-[10px] text-muted">{routeTypeLabel(route)}</div>
      </div>
    </button>
  )
}
