import { useState, useEffect } from 'react'

interface AdvisingOffice {
  id: string
  college: string
  office: string
  email: string
  phone: string
  vac_url: string
  appointment_url: string
  website: string
  hours: string
  drop_in: string
}

interface Resource {
  label: string
  url: string
  description: string
}

interface AdvisingEvent {
  id: number
  title: string
  description: string
  start: string
  end: string
  location: string
  venue: string
  url: string
  photo_url: string
}

interface AdvisingSlot {
  summary: string
  start: string
  end: string
  location: string
  mode: 'remote' | 'in-person' | 'both'
}

function formatEventDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatSlotTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatSlotDay(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isTomorrow(iso: string): boolean {
  const d = new Date(iso)
  const tom = new Date()
  tom.setDate(tom.getDate() + 1)
  return d.getFullYear() === tom.getFullYear() && d.getMonth() === tom.getMonth() && d.getDate() === tom.getDate()
}

const COLLEGE_COLORS: Record<string, string> = {
  revelle: '#4f8ef7', muir: '#3dd68c', marshall: '#f25f5c', warren: '#f5c842',
  erc: '#7c5cfc', sixth: '#4f8ef7', seventh: '#3dd68c', eighth: '#f5c842',
}

export function Advising() {
  const [offices, setOffices] = useState<AdvisingOffice[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [events, setEvents] = useState<AdvisingEvent[]>([])
  const [slots, setSlots] = useState<Record<string, AdvisingSlot[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedOffice, setSelectedOffice] = useState<AdvisingOffice | null>(null)
  const [tab, setTab] = useState<'offices' | 'events' | 'resources'>('offices')

  useEffect(() => {
    Promise.all([
      fetch('/api/advising/offices').then(r => r.json()),
      fetch('/api/advising/events').then(r => r.json()),
      fetch('/api/advising/slots').then(r => r.json()),
    ]).then(([officeData, eventData, slotsData]) => {
      setOffices(officeData.offices || [])
      setResources(officeData.resources || [])
      setEvents(eventData.events || [])
      setSlots(slotsData.slots || {})
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-text">Advising & Counselor Meetings</h2>
          <p className="text-[12px] text-muted mt-1">Book appointments, find drop-in hours, and discover academic events</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-surface rounded-lg p-0.5 w-fit border border-border">
          {([['offices', 'College Advisors'], ['events', `Events (${events.length})`], ['resources', 'Resources']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-[12px] font-medium cursor-pointer
                ${tab === key ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ════ OFFICES TAB ════ */}
        {tab === 'offices' && (
          <div className="space-y-4">
            {/* Quick action */}
            <a href="https://vac.ucsd.edu" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-accent/8 border border-accent/20 hover:bg-accent/12 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <span className="text-2xl">{'\ud83d\udcc5'}</span>
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold text-text group-hover:text-accent">Virtual Advising Center (VAC)</div>
                <div className="text-[12px] text-muted mt-0.5">Book an appointment with your college advisor online</div>
              </div>
              <svg className="w-5 h-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>

            {/* College cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {offices.map(office => {
                const color = COLLEGE_COLORS[office.id] || '#4f8ef7'
                const isExpanded = selectedOffice?.id === office.id

                return (
                  <div key={office.id}
                    className="rounded-2xl bg-card border border-border overflow-hidden transition-all hover:border-border2">
                    {/* Card header */}
                    <button onClick={() => setSelectedOffice(isExpanded ? null : office)}
                      className="w-full text-left px-5 py-4 cursor-pointer flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-10 rounded-full shrink-0" style={{ background: color }} />
                        <div>
                          <div className="text-[14px] font-bold text-text">{office.college}</div>
                          <div className="text-[11px] text-muted">{office.office}</div>
                        </div>
                      </div>
                      {(slots[office.id] || []).length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green/10 text-green font-semibold border border-green/15">
                          {slots[office.id].length} slots
                        </span>
                      )}
                      <span className={`text-dim text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>&#x25BC;</span>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border/50 px-5 py-4 space-y-3 animate-fade-in">
                        {/* Hours */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] text-dim uppercase font-semibold mb-1">Office Hours</div>
                            <div className="text-[12px] text-text">{office.hours}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-dim uppercase font-semibold mb-1">Drop-In</div>
                            <div className="text-[12px] text-green font-medium">{office.drop_in}</div>
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] text-dim uppercase font-semibold mb-1">Email</div>
                            <a href={`mailto:${office.email}`} className="text-[12px] text-accent hover:underline">{office.email}</a>
                          </div>
                          <div>
                            <div className="text-[10px] text-dim uppercase font-semibold mb-1">Phone</div>
                            <a href={`tel:${office.phone}`} className="text-[12px] text-accent hover:underline">{office.phone}</a>
                          </div>
                        </div>

                        {/* Available slots */}
                        {(slots[office.id] || []).length > 0 && (
                          <div>
                            <div className="text-[10px] text-dim uppercase font-semibold mb-2">Upcoming Available Times</div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {(slots[office.id] || []).map((slot, si) => (
                                <div key={si} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${isToday(slot.start) ? 'bg-green/5 border-green/20' : 'bg-surface/50 border-border'}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[12px] font-semibold ${isToday(slot.start) ? 'text-green' : isTomorrow(slot.start) ? 'text-accent' : 'text-text'}`}>
                                        {isToday(slot.start) ? 'Today' : isTomorrow(slot.start) ? 'Tomorrow' : formatSlotDay(slot.start)}
                                      </span>
                                      <span className="text-[12px] text-muted">
                                        {formatSlotTime(slot.start)} - {formatSlotTime(slot.end)}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-dim mt-0.5">{slot.summary}</div>
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                    slot.mode === 'remote' ? 'bg-accent2/10 text-accent2 border border-accent2/15' :
                                    slot.mode === 'in-person' ? 'bg-green/10 text-green border border-green/15' :
                                    'bg-accent/10 text-accent border border-accent/15'
                                  }`}>
                                    {slot.mode === 'remote' ? 'Remote' : slot.mode === 'in-person' ? 'In-Person' : 'Both'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1">
                          <a href={office.appointment_url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold bg-accent text-white hover:bg-accent/85 cursor-pointer transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Book Appointment
                          </a>
                          <a href={office.website} target="_blank" rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-xl text-[12px] font-medium bg-surface text-muted border border-border hover:text-text hover:border-border2 cursor-pointer transition-all flex items-center gap-1.5">
                            Website
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════ EVENTS TAB ════ */}
        {tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted text-[13px]">No advising events in the next 30 days</div>
            ) : (
              events.map(evt => (
                <div key={evt.id} className="flex items-start gap-4 px-5 py-4 rounded-xl bg-card border border-border hover:border-border2 transition-all">
                  {/* Date badge */}
                  <div className="w-14 text-center shrink-0 pt-0.5">
                    <div className="font-mono text-[18px] font-medium text-text leading-tight">
                      {evt.start ? new Date(evt.start).getDate() : '?'}
                    </div>
                    <div className="font-mono text-[11px] text-muted uppercase">
                      {evt.start ? new Date(evt.start).toLocaleDateString('en-US', { month: 'short' }) : ''}
                    </div>
                  </div>

                  {/* Event info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text">{evt.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                      <span>{formatEventDate(evt.start)}</span>
                      {evt.location && (
                        <>
                          <span className="text-dim">{'\u00b7'}</span>
                          <span>{evt.location}</span>
                        </>
                      )}
                    </div>
                    {evt.description && (
                      <div className="text-[12px] text-dim mt-1.5 line-clamp-2">{evt.description}</div>
                    )}
                  </div>

                  {/* Action */}
                  <a href={evt.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 cursor-pointer transition-all flex items-center gap-1.5">
                    View
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              ))
            )}
          </div>
        )}

        {/* ════ RESOURCES TAB ════ */}
        {tab === 'resources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resources.map(r => (
              <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 px-5 py-4 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-sm cursor-pointer transition-all group">
                <div className="w-10 h-10 rounded-xl bg-accent2/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-accent2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text group-hover:text-accent transition-colors">{r.label}</div>
                  <div className="text-[11px] text-muted mt-0.5">{r.description}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
