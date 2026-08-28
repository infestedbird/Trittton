import type { ViewType } from './Header'

interface CampusTool {
  view: ViewType
  title: string
  description: string
  accent: string
  icon: React.ReactNode
}

const TOOLS: CampusTool[] = [
  { view: 'live', title: 'Campus Live', description: 'Transit, library, weather, parking, and recreation status.', accent: 'text-green bg-green/10 border-green/20', icon: <PulseIcon /> },
  { view: 'rooms', title: 'Empty Rooms', description: 'Find an available classroom or study space nearby.', accent: 'text-accent bg-accent/10 border-accent/20', icon: <BuildingIcon /> },
  { view: 'dining', title: 'Dining', description: 'Browse current HDH menus, nutrition, and open locations.', accent: 'text-gold bg-gold/10 border-gold/20', icon: <DiningIcon /> },
  { view: 'events', title: 'Academic Dates', description: 'Keep enrollment, deadline, and campus dates in one place.', accent: 'text-accent2 bg-accent2/10 border-accent2/20', icon: <CalendarIcon /> },
  { view: 'internships', title: 'Career Resources', description: 'Search internships and opportunities outside course planning.', accent: 'text-red bg-red/10 border-red/20', icon: <BriefcaseIcon /> },
]

export function CampusHub({ onOpen }: { onOpen: (view: ViewType) => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="max-w-2xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Resources</div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-text">Campus & more</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Useful campus tools are still here, without competing with the core Explore → Plan → Enroll flow.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.view}
              onClick={() => onOpen(tool.view)}
              className="group flex min-h-[150px] items-start gap-4 rounded-2xl border border-border bg-card/80 p-5 text-left shadow-[0_12px_32px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-1 hover:border-accent/30 hover:bg-card-hover"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tool.accent}`}>{tool.icon}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[16px] font-bold text-text">
                  {tool.title}
                  <span className="text-accent transition-transform group-hover:translate-x-1">→</span>
                </span>
                <span className="mt-2 block text-[13px] leading-relaxed text-muted">{tool.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PulseIcon() { return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l3-9 4 18 3-9h5" /></svg> }
function BuildingIcon() { return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m3-3h.75m-.75 3h.75M3 3h12m-.75 4.5H21" /></svg> }
function DiningIcon() { return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 3v7.5a3 3 0 003 3V21m0-18v18M19.5 3v18m0-18c-2 0-3.5 2.2-3.5 5s1.5 4 3.5 4" /></svg> }
function CalendarIcon() { return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 9h18M5.25 5.25h13.5A2.25 2.25 0 0121 7.5v11.25A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V7.5a2.25 2.25 0 012.25-2.25z" /></svg> }
function BriefcaseIcon() { return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V6m6 6.75A23.9 23.9 0 0112 15a23.9 23.9 0 01-9-2.25M5.25 6h13.5A2.25 2.25 0 0121 8.25v10.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6z" /></svg> }
