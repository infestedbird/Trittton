import { useState, useEffect } from 'react'

interface ParkingSpot {
  id: string; name: string; area: string; permits: string[]; approx_spots: number
  nearby: string[]; tips: string; floors?: number; lat?: number; lon?: number
}
interface PermitInfo {
  type: string; name: string; daily: string; quarterly: string; access: string; color: string
}
interface ParkingData {
  structures: ParkingSpot[]; lots: ParkingSpot[]; permit_info: PermitInfo[]; tips: string[]
}

const AREA_COLORS: Record<string, string> = {
  'West Campus': '#4f8ef7', 'East Campus': '#3dd68c', 'East Campus Remote': '#f5c842',
  'North Campus': '#7c5cfc', 'South Campus': '#f25f5c',
  'Revelle': '#4f8ef7', 'Muir': '#3dd68c', 'Warren': '#f5c842',
  'ERC': '#7c5cfc', 'Sixth': '#4f8ef7',
}

export function Parking() {
  const [data, setData] = useState<ParkingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'structures' | 'lots' | 'permits'>('structures')
  const [permitFilter, setPermitFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parking').then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  const filterByPermit = (spots: ParkingSpot[]) =>
    permitFilter ? spots.filter(s => s.permits.includes(permitFilter)) : spots

  const structures = filterByPermit(data.structures)
  const lots = filterByPermit(data.lots)

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-text">Campus Parking</h2>
          <p className="text-[12px] text-muted mt-1">
            {data.structures.length} structures &middot; {data.lots.length} lots &middot; ~{(data.structures.reduce((s, p) => s + p.approx_spots, 0) + data.lots.reduce((s, p) => s + p.approx_spots, 0)).toLocaleString()} total spaces
          </p>
        </div>

        {/* Tabs + Permit filter */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-0.5 bg-surface rounded-lg p-0.5 border border-border">
            {([['structures', 'Structures'], ['lots', 'Surface Lots'], ['permits', 'Permits & Pricing']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-md text-[12px] font-medium cursor-pointer
                  ${tab === key ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab !== 'permits' && (
            <div className="flex gap-1.5">
              <button onClick={() => setPermitFilter('')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${!permitFilter ? 'bg-accent/12 text-accent' : 'bg-surface text-muted hover:text-text'}`}>
                All
              </button>
              {data.permit_info.map(p => (
                <button key={p.type} onClick={() => setPermitFilter(permitFilter === p.type ? '' : p.type)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all`}
                  style={{
                    background: permitFilter === p.type ? p.color + '20' : 'var(--color-surface)',
                    color: permitFilter === p.type ? p.color : 'var(--color-muted)',
                    border: `1px solid ${permitFilter === p.type ? p.color + '40' : 'transparent'}`,
                  }}>
                  {p.type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tips banner */}
        {tab !== 'permits' && (
          <div className="px-4 py-3 rounded-xl bg-gold/5 border border-gold/15">
            <div className="text-[11px] text-gold font-semibold mb-1.5">Parking Tips</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {data.tips.map((tip, i) => (
                <div key={i} className="text-[11px] text-muted flex items-start gap-1.5">
                  <span className="text-gold shrink-0 mt-0.5">{'\u2022'}</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ STRUCTURES TAB ════ */}
        {tab === 'structures' && (
          <div className="space-y-3">
            {structures.length === 0 ? (
              <div className="text-center py-12 text-muted text-[13px]">No structures match the "{permitFilter}" permit filter</div>
            ) : structures.map(s => {
              const isOpen = expanded === s.id
              const color = AREA_COLORS[s.area] || '#4f8ef7'
              return (
                <div key={s.id} className="rounded-2xl bg-card border border-border overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full text-left px-5 py-4 cursor-pointer flex items-center justify-between hover:bg-surface/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl"
                        style={{ background: color + '15' }}>
                        {'\ud83c\udfdb\ufe0f'}
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-text">{s.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted">{s.area}</span>
                          <span className="text-dim text-[10px]">{'\u00b7'}</span>
                          <span className="text-[11px] text-muted">{s.floors} floors</span>
                          <span className="text-dim text-[10px]">{'\u00b7'}</span>
                          <span className="text-[11px] text-muted">~{s.approx_spots.toLocaleString()} spots</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.permits.map(p => {
                        const pi = data.permit_info.find(x => x.type === p)
                        return (
                          <span key={p} className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                            style={{ background: pi?.color || '#999' }}>{p}</span>
                        )
                      })}
                      <span className={`text-dim text-xs ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>&#x25BC;</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/50 px-5 py-4 space-y-3 animate-fade-in">
                      <div className="text-[12px] text-muted">{s.tips}</div>
                      <div>
                        <div className="text-[10px] text-dim uppercase font-semibold mb-1">Near</div>
                        <div className="flex flex-wrap gap-1.5">
                          {s.nearby.map(n => (
                            <span key={n} className="text-[11px] px-2.5 py-1 rounded-lg bg-surface border border-border text-muted">{n}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ════ LOTS TAB ════ */}
        {tab === 'lots' && (
          <div className="space-y-2">
            {lots.length === 0 ? (
              <div className="text-center py-12 text-muted text-[13px]">No lots match the "{permitFilter}" permit filter</div>
            ) : lots.map(lot => {
              const color = AREA_COLORS[lot.area] || '#4f8ef7'
              return (
                <div key={lot.id}
                  className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-card border border-border hover:border-border2 transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                    style={{ background: color }}>
                    {lot.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text">{lot.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted">{lot.area}</span>
                      <span className="text-dim text-[10px]">{'\u00b7'}</span>
                      <span className="text-[11px] text-dim">~{lot.approx_spots} spots</span>
                      <span className="text-dim text-[10px]">{'\u00b7'}</span>
                      <span className="text-[11px] text-dim">{lot.tips}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {lot.permits.map(p => {
                      const pi = data.permit_info.find(x => x.type === p)
                      return (
                        <span key={p} className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ background: pi?.color || '#999' }}>{p}</span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ════ PERMITS TAB ════ */}
        {tab === 'permits' && (
          <div className="space-y-3">
            {data.permit_info.map(p => (
              <div key={p.type} className="flex items-center gap-4 px-5 py-4 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-[18px] font-black text-white"
                  style={{ background: p.color }}>
                  {p.type}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-text">{p.name} Permit</div>
                  <div className="text-[12px] text-muted mt-0.5">{p.access}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-bold text-text">{p.daily}</div>
                  <div className="text-[11px] text-dim">{p.quarterly !== 'N/A' ? p.quarterly : 'Pay per use'}</div>
                </div>
              </div>
            ))}

            <a href="https://transportation.ucsd.edu/commute/permits/index.html" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[12px] font-bold bg-accent text-white hover:bg-accent/85 cursor-pointer transition-all mt-4">
              Buy Permits on UCSD Transportation
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
