import { useState, useEffect, useCallback, useRef } from 'react'

interface Assignment {
  id: string; name: string; dueDate: string; difficulty: number; done: boolean
}
interface Leisure {
  id: string; name: string; preferredDay: string; preferredTime: string; duration: number
}
interface TimeBlock {
  start: string; end: string; title: string
  type: 'fixed' | 'suggested' | 'free' | 'leisure'
  assignment?: string; difficulty?: number; calendar?: string
}
interface ScheduleResult {
  busy_blocks: TimeBlock[]; study_blocks: TimeBlock[]; guilt_free: TimeBlock[]; leisure_blocks: TimeBlock[]
  effort_summary: { name: string; hours: number; difficulty: number; due: string }[]
}
interface ChatMsg { role: 'user' | 'assistant'; content: string }

const ASSIGN_KEY = 'ucsd-scheduler-assignments'
const LEISURE_KEY = 'ucsd-scheduler-leisure'
const EFFORT_HOURS: Record<number, number> = { 1: 1.2, 2: 2.4, 3: 4.2, 4: 6.0, 5: 9.0 }
const DIFF_LABELS = ['', 'Quick', 'Light', 'Moderate', 'Heavy', 'Major']
const DIFF_COLORS = ['', '#3dd68c', '#3dd68c', '#f5c842', '#ff9f43', '#f25f5c']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const START_HOUR = 7; const END_HOUR = 23; const HOUR_HEIGHT = 40

function uid() { return Math.random().toString(36).slice(2, 9) }
function getToday() { return new Date().toISOString().split('T')[0] }
function getWeekEnd() { const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] }
function fmtDur(h: number) { return h < 1 ? `${Math.round(h * 60)}m` : `${Math.floor(h)}h${Math.round((h % 1) * 60) > 0 ? `${Math.round((h % 1) * 60)}m` : ''}` }
function fmtHour(h: number) { return h === 0 || h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p` }
function load<T>(key: string, fallback: T): T { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback } }

function getWeekDates() {
  const today = new Date(); const dow = today.getDay()
  const mon = new Date(today); mon.setDate(today.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return { day: DAYS[i], date: d.toISOString().split('T')[0], dateObj: d }
  })
}

function blockPos(block: TimeBlock, weekDates: { date: string }[]) {
  const s = new Date(block.start), e = new Date(block.end)
  const dayIdx = weekDates.findIndex((d) => d.date === s.toISOString().split('T')[0])
  if (dayIdx < 0) return null
  const sh = s.getHours() + s.getMinutes() / 60, eh = e.getHours() + e.getMinutes() / 60
  return { dayIdx, top: (sh - START_HOUR) * HOUR_HEIGHT, height: Math.max((eh - sh) * HOUR_HEIGHT, 16) }
}

type LeftTab = 'assignments' | 'leisure' | 'chat'

export function AutoScheduler({ model }: { model: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>(load(ASSIGN_KEY, []))
  const [leisure, setLeisure] = useState<Leisure[]>(load(LEISURE_KEY, []))
  const [result, setResult] = useState<ScheduleResult | null>(null)
  const [calEvents, setCalEvents] = useState<TimeBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>('assignments')

  // Form states
  const [aName, setAName] = useState(''); const [aDue, setADue] = useState(''); const [aDiff, setADiff] = useState(3)
  const [lName, setLName] = useState(''); const [lDay, setLDay] = useState(''); const [lTime, setLTime] = useState(''); const [lDur, setLDur] = useState(1)

  // Chat states
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const weekDates = getWeekDates()

  // Persist
  useEffect(() => { localStorage.setItem(ASSIGN_KEY, JSON.stringify(assignments)) }, [assignments])
  useEffect(() => { localStorage.setItem(LEISURE_KEY, JSON.stringify(leisure)) }, [leisure])

  // Fetch GCal events
  useEffect(() => {
    fetch(`/api/scheduler/events?start=${weekDates[0].date}&end=${weekDates[6].date}`)
      .then((r) => r.json()).then((d) => { if (d.events) setCalEvents(d.events) }).catch(() => {})
  }, []) // eslint-disable-line

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])

  const addAssignment = () => {
    if (!aName.trim() || !aDue) return
    setAssignments((p) => [...p, { id: uid(), name: aName.trim(), dueDate: aDue, difficulty: aDiff, done: false }])
    setAName(''); setADue(''); setADiff(3)
  }
  const addLeisure = () => {
    if (!lName.trim()) return
    setLeisure((p) => [...p, { id: uid(), name: lName.trim(), preferredDay: lDay, preferredTime: lTime, duration: lDur }])
    setLName(''); setLDay(''); setLTime(''); setLDur(1)
  }

  const generatePlan = useCallback(async () => {
    const pending = assignments.filter((a) => !a.done)
    if (pending.length === 0 && leisure.length === 0) return
    setLoading(true); setMsg(null)
    try {
      const res = await fetch('/api/scheduler/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: pending.map((a) => ({ name: a.name, due_date: a.dueDate, difficulty: a.difficulty })),
          leisure: leisure.map((l) => ({ name: l.name, preferred_day: l.preferredDay, preferred_time: l.preferredTime, duration: l.duration })),
          start_date: getToday(), end_date: getWeekEnd(), model,
        }),
      })
      const data = await res.json()
      setResult(data)
      if (data.busy_blocks?.length) setCalEvents(data.busy_blocks)
    } catch { setMsg('Failed to generate') }
    finally { setLoading(false) }
  }, [assignments, leisure, model])

  const pushToCalendar = useCallback(async () => {
    if (!result) return; setPushing(true)
    try {
      const blocks = [...result.study_blocks, ...result.guilt_free, ...result.leisure_blocks]
      const res = await fetch('/api/scheduler/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }) })
      const data = await res.json()
      setMsg(data.success ? `Added ${data.events_created} blocks to "${data.calendar}"` : (data.error || 'Failed'))
    } catch { setMsg('Failed to push') }
    finally { setPushing(false) }
  }, [result])

  // Chat send
  const sendChat = useCallback(async () => {
    const text = chatInput.trim(); if (!text || chatStreaming) return
    setChatInput('')
    const newMsgs: ChatMsg[] = [...chatMsgs, { role: 'user', content: text }]
    setChatMsgs([...newMsgs, { role: 'assistant', content: '' }])
    setChatStreaming(true)

    try {
      const res = await fetch('/api/scheduler/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs, model,
          current_plan: result,
          assignments: assignments.filter((a) => !a.done),
          leisure,
        }),
      })
      const reader = res.body?.getReader(); const decoder = new TextDecoder()
      if (!reader) return
      let buf = '', fullText = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6))
              if (d.text) {
                fullText += d.text
                setChatMsgs((p) => { const u = [...p]; u[u.length - 1] = { role: 'assistant', content: fullText }; return u })
              }
            } catch { /* */ }
          }
        }
      }
      // Parse scheduler-json from response
      const jsonMatch = fullText.match(/```scheduler-json\s*\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        try {
          const blocks = JSON.parse(jsonMatch[1]) as TimeBlock[]
          const study = blocks.filter((b) => b.type === 'suggested')
          const free = blocks.filter((b) => b.type === 'free')
          const leis = blocks.filter((b) => b.type === 'leisure')
          setResult((prev) => prev ? { ...prev, study_blocks: study, guilt_free: free, leisure_blocks: leis } : { busy_blocks: calEvents, study_blocks: study, guilt_free: free, leisure_blocks: leis, effort_summary: [] })
        } catch { /* */ }
      }
    } catch { /* */ }
    finally { setChatStreaming(false) }
  }, [chatInput, chatMsgs, chatStreaming, model, result, assignments, leisure, calEvents])

  const pending = assignments.filter((a) => !a.done).length
  const totalEffort = assignments.filter((a) => !a.done).reduce((s, a) => s + (EFFORT_HOURS[a.difficulty] || 3), 0)
  const allBlocks: TimeBlock[] = [...calEvents, ...(result?.study_blocks || []), ...(result?.guilt_free || []), ...(result?.leisure_blocks || [])]

  return (
    <div className="h-[calc(100vh-56px)] overflow-hidden">
      <div className="h-full max-w-[1400px] mx-auto px-5 py-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text">Smart Scheduler</h2>
            <div className="font-mono text-[11px] text-muted mt-0.5">
              {pending > 0 && <><b className="text-text">{pending}</b> pending · <b className="text-gold">{fmtDur(totalEffort)}</b> effort · </>}
              {leisure.length > 0 && <><b className="text-green">{leisure.length}</b> leisure · </>}
              Using <b className="text-accent2">{model === 'gemini' ? 'Gemini' : model === 'opus' ? 'Opus' : 'Sonnet'}</b>
            </div>
          </div>
          <div className="flex gap-2">
            {result && (
              <button onClick={pushToCalendar} disabled={pushing}
                className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-green text-white hover:bg-green/85 disabled:opacity-50 cursor-pointer flex items-center gap-1.5">
                {pushing ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                Push to Calendar
              </button>
            )}
            <button onClick={generatePlan} disabled={loading || (pending === 0 && leisure.length === 0)}
              className="px-4 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-accent2 text-white hover:bg-accent2/85 hover:shadow-[0_0_14px_rgba(124,92,252,0.3)] disabled:opacity-40 cursor-pointer flex items-center gap-1.5">
              {loading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              )}
              {loading ? 'Planning...' : 'Generate Plan'}
            </button>
          </div>
        </div>

        {msg && <div className={`text-[11px] font-mono mb-2 px-3 py-1.5 rounded-lg shrink-0 ${msg.includes('Added') ? 'text-green bg-green/8' : 'text-red bg-red/8'}`}>{msg}</div>}

        {/* Main grid */}
        <div className="grid grid-cols-[280px_1fr] gap-3 flex-1 min-h-0">
          {/* LEFT panel */}
          <div className="flex flex-col min-h-0">
            {/* Left tabs */}
            <div className="flex gap-0.5 bg-surface rounded-lg p-0.5 mb-3 shrink-0">
              {([['assignments', 'Tasks'], ['leisure', 'Leisure'], ['chat', 'Chat']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setLeftTab(k)}
                  className={`flex-1 py-1.5 rounded-md text-[11px] font-mono font-medium cursor-pointer
                    ${leftTab === k ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}
                >{label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {/* ASSIGNMENTS TAB */}
              {leftTab === 'assignments' && (
                <>
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Assignment name..."
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-text outline-none focus:border-accent/50 placeholder:text-dim"
                      onKeyDown={(e) => e.key === 'Enter' && addAssignment()} />
                    <input type="date" value={aDue} onChange={(e) => setADue(e.target.value)} min={getToday()}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[11px] text-text font-mono outline-none focus:border-accent/50" />
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((d) => (
                        <button key={d} onClick={() => setADiff(d)}
                          className={`flex-1 py-1 rounded-lg font-mono text-[10px] font-semibold cursor-pointer ${d === aDiff ? 'text-white' : 'bg-surface text-muted border border-border'}`}
                          style={d === aDiff ? { background: DIFF_COLORS[d] } : {}}>{d}</button>
                      ))}
                    </div>
                    <button onClick={addAssignment} disabled={!aName.trim() || !aDue}
                      className="w-full py-1.5 rounded-lg font-mono text-[11px] font-semibold bg-accent text-white hover:bg-accent/85 disabled:opacity-30 cursor-pointer">+ Add</button>
                  </div>
                  {assignments.map((a) => (
                    <div key={a.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card ${a.done ? 'opacity-35' : ''}`}>
                      <button onClick={() => setAssignments((p) => p.map((x) => x.id === a.id ? { ...x, done: !x.done } : x))}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer ${a.done ? 'bg-green border-green' : 'border-dim'}`}>
                        {a.done && <span className="text-white text-[8px]">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-medium truncate ${a.done ? 'line-through text-muted' : 'text-text'}`}>{a.name}</div>
                        <div className="font-mono text-[9px] text-muted">{new Date(a.dueDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · <span style={{ color: DIFF_COLORS[a.difficulty] }}>{DIFF_LABELS[a.difficulty]}</span></div>
                      </div>
                      <button onClick={() => setAssignments((p) => p.filter((x) => x.id !== a.id))} className="text-dim hover:text-red text-[12px] cursor-pointer">×</button>
                    </div>
                  ))}
                </>
              )}

              {/* LEISURE TAB */}
              {leftTab === 'leisure' && (
                <>
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <input value={lName} onChange={(e) => setLName(e.target.value)} placeholder="Activity (Gym, Gaming, Walk...)"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-text outline-none focus:border-accent/50 placeholder:text-dim"
                      onKeyDown={(e) => e.key === 'Enter' && addLeisure()} />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={lDay} onChange={(e) => setLDay(e.target.value)}
                        className="bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-text font-mono outline-none">
                        <option value="">Any day</option>
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <select value={lTime} onChange={(e) => setLTime(e.target.value)}
                        className="bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-text font-mono outline-none">
                        <option value="">Any time</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                      </select>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-muted mb-1">Duration: <b className="text-text">{lDur}h</b></div>
                      <input type="range" min={0.5} max={3} step={0.5} value={lDur} onChange={(e) => setLDur(parseFloat(e.target.value))}
                        className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green" />
                    </div>
                    <button onClick={addLeisure} disabled={!lName.trim()}
                      className="w-full py-1.5 rounded-lg font-mono text-[11px] font-semibold bg-green text-white hover:bg-green/85 disabled:opacity-30 cursor-pointer">+ Add Leisure</button>
                  </div>
                  {leisure.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green/15 bg-green/5">
                      <div className="w-2 h-6 rounded-full bg-green/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-text truncate">{l.name}</div>
                        <div className="font-mono text-[9px] text-muted">
                          {l.duration}h{l.preferredDay && ` · ${l.preferredDay}`}{l.preferredTime && ` · ${l.preferredTime}`}
                        </div>
                      </div>
                      <button onClick={() => setLeisure((p) => p.filter((x) => x.id !== l.id))} className="text-dim hover:text-red text-[12px] cursor-pointer">×</button>
                    </div>
                  ))}
                  {leisure.length === 0 && (
                    <div className="text-center py-6 text-[11px] text-dim font-mono">
                      Add activities you enjoy — gym, gaming, walks, cooking, etc. The AI will protect time for them.
                    </div>
                  )}
                </>
              )}

              {/* CHAT TAB */}
              {leftTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto space-y-2 mb-2">
                    {chatMsgs.length === 0 && (
                      <div className="text-center py-6 text-[11px] text-dim font-mono leading-relaxed">
                        Chat with AI to adjust your plan.<br />
                        Try: "Move my gym to evening" or "Add a 2h gaming session on Saturday"
                      </div>
                    )}
                    {chatMsgs.map((m, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                        m.role === 'user' ? 'bg-accent2/10 text-text ml-6' : 'bg-surface text-muted mr-2'
                      }`}>
                        {m.content.replace(/```scheduler-json[\s\S]*?```/g, '[Plan updated ✓]')}
                      </div>
                    ))}
                    {chatStreaming && !chatMsgs[chatMsgs.length - 1]?.content && (
                      <div className="flex gap-1 px-3 py-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                      placeholder="Adjust the plan..."
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-text outline-none focus:border-accent2/50 placeholder:text-dim" />
                    <button onClick={sendChat} disabled={!chatInput.trim() || chatStreaming}
                      className="px-3 py-2 rounded-lg text-[11px] font-mono font-semibold bg-accent2 text-white hover:bg-accent2/85 disabled:opacity-30 cursor-pointer shrink-0">
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="shrink-0 mt-2 rounded-lg border border-border bg-card px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted"><div className="w-3 h-2 rounded-sm border-l-2 border-accent bg-accent/20" />Fixed</div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted"><div className="w-3 h-2 rounded-sm border-l-2 border-dashed border-accent2 bg-accent2/20" />Study</div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted"><div className="w-3 h-2 rounded-sm border-l-2 border-dashed border-green bg-green/20" />Leisure</div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted"><div className="w-3 h-2 rounded-sm border-l-2 border-dashed border-gold bg-gold/20" />Break</div>
            </div>
          </div>

          {/* RIGHT: Calendar */}
          <div className="rounded-xl border border-border overflow-hidden bg-card flex flex-col min-h-0">
            <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
              <div className="bg-surface p-1.5" />
              {weekDates.map((d) => {
                const isToday = d.date === getToday()
                return (
                  <div key={d.day} className={`px-1 py-1.5 text-center border-l border-border ${isToday ? 'bg-accent/5' : 'bg-surface'}`}>
                    <div className={`font-mono text-[9px] font-medium ${isToday ? 'text-accent' : 'text-dim'}`}>{d.day}</div>
                    <div className={`font-mono text-[12px] font-semibold ${isToday ? 'text-accent' : 'text-text'}`}>{d.dateObj.getDate()}</div>
                  </div>
                )
              })}
            </div>
            <div className="relative grid overflow-y-auto flex-1" style={{ gridTemplateColumns: '40px repeat(7, 1fr)' }}>
              <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="absolute w-full text-right pr-1 font-mono text-[8px] text-dim" style={{ top: i * HOUR_HEIGHT - 4 }}>{fmtHour(START_HOUR + i)}</div>
                ))}
              </div>
              {weekDates.map((wd, dayIdx) => {
                const isToday = wd.date === getToday()
                const dayBlocks = allBlocks.map((b) => ({ block: b, pos: blockPos(b, weekDates) })).filter((x) => x.pos && x.pos.dayIdx === dayIdx)
                return (
                  <div key={wd.day} className={`relative border-l border-border ${isToday ? 'bg-accent/[0.02]' : ''}`} style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <div key={i} className="absolute w-full border-t border-border/25" style={{ top: i * HOUR_HEIGHT }} />
                    ))}
                    {isToday && (() => { const n = new Date(), h = n.getHours() + n.getMinutes() / 60; if (h < START_HOUR || h > END_HOUR) return null; return <div className="absolute left-0 right-0 border-t-2 border-red z-20" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}><div className="w-1.5 h-1.5 rounded-full bg-red -mt-[3px] -ml-[1px]" /></div> })()}
                    {dayBlocks.map(({ block, pos }, i) => {
                      if (!pos) return null
                      const isFixed = block.type === 'fixed'
                      const isLeisure = block.type === 'leisure'
                      const isFree = block.type === 'free'
                      const color = isFixed ? '#4f8ef7' : isLeisure ? '#3dd68c' : isFree ? '#f5c842' : (block.difficulty ? DIFF_COLORS[block.difficulty] : '#7c5cfc')
                      return (
                        <div key={`${block.start}-${i}`}
                          className="absolute left-[2px] right-[2px] rounded px-1 py-0.5 overflow-hidden z-10 hover:z-20 hover:shadow-lg transition-shadow"
                          style={{ top: pos.top, height: pos.height, background: `${color}20`, borderLeft: isFixed ? `2px solid ${color}` : `2px dashed ${color}` }}
                          title={`${block.title}\n${new Date(block.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${new Date(block.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}>
                          <div className="font-mono text-[8px] font-semibold truncate" style={{ color }}>{block.title}</div>
                          {pos.height > 24 && <div className="font-mono text-[7px] text-muted truncate">{new Date(block.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
