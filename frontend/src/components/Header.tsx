export type ViewType = 'browse' | 'ai' | 'councillor' | 'schedule' | 'planner' | 'live' | 'scheduler' | 'events' | 'completed' | 'progress'

interface HeaderProps {
  termOptions: { value: string; label: string }[]
  onLogout?: () => void
  isLoaded: boolean
  stats: { totalCourses: number; totalSections: number; totalDepts: number }
  onScrapeClick: () => void
  scrapeRunning: boolean
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  model: string
  onModelChange: (model: string) => void
  term: string
  onTermChange: (term: string) => void
  scheduleCount: number
  completedCount: number
}

export function Header({ isLoaded, stats, onScrapeClick, scrapeRunning, activeView, onViewChange, model, onModelChange, term, onTermChange, scheduleCount, completedCount, termOptions, onLogout }: HeaderProps) {
  return (
    <header className="border-b border-border/80 h-[56px] px-6 flex items-center justify-between sticky top-0 z-50"
      style={{ background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(16px) saturate(1.4)' }}
    >
      <div className="flex items-center gap-5">
        {/* Logo */}
        <div className="font-mono text-[14px] tracking-wide font-semibold text-accent flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/12 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          trittton
        </div>

        {isLoaded && (
          <nav className="flex items-center gap-1 ml-1">
            <TabBtn active={activeView === 'browse'} onClick={() => onViewChange('browse')}>
              Browse
            </TabBtn>
            <TabBtn active={activeView === 'ai'} onClick={() => onViewChange('ai')} color="accent2">
              AI Planner
            </TabBtn>
            <TabBtn active={activeView === 'councillor'} onClick={() => onViewChange('councillor')} color="accent2">
              Councillor
            </TabBtn>
            <TabBtn active={activeView === 'schedule'} onClick={() => onViewChange('schedule')} color="green" badge={scheduleCount}>
              Schedule
            </TabBtn>
            <TabBtn active={activeView === 'planner'} onClick={() => onViewChange('planner')} color="accent">
              4-Year Plan
            </TabBtn>
            <TabBtn active={activeView === 'live'} onClick={() => onViewChange('live')} color="green">
              Live Status
            </TabBtn>
            <TabBtn active={activeView === 'scheduler'} onClick={() => onViewChange('scheduler')} color="accent2">
              Scheduler
            </TabBtn>
            <TabBtn active={activeView === 'events'} onClick={() => onViewChange('events')} color="gold">
              Dates
            </TabBtn>
            <TabBtn active={activeView === 'completed'} onClick={() => onViewChange('completed')} color="accent2" badge={completedCount}>
              History
            </TabBtn>
            <TabBtn active={activeView === 'progress'} onClick={() => onViewChange('progress')} color="gold">
              Progress
            </TabBtn>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {isLoaded && (
          <div className="flex gap-4 font-mono text-[11px] text-dim mr-1">
            <span><b className="text-muted font-medium">{stats.totalCourses.toLocaleString()}</b> courses</span>
            <span><b className="text-muted font-medium">{stats.totalSections.toLocaleString()}</b> sections</span>
          </div>
        )}

        <select
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
          className="bg-surface border border-border rounded-lg text-[11px] font-mono text-muted
            px-2.5 py-1.5 outline-none cursor-pointer focus:border-accent hover:border-border2"
        >
          {termOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {isLoaded && (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="bg-surface border border-border rounded-lg text-[11px] font-mono text-muted
              px-2.5 py-1.5 outline-none cursor-pointer focus:border-accent hover:border-border2"
          >
            <option value="sonnet">Sonnet 4.6</option>
            <option value="opus">Opus 4.6</option>
            <option value="gemini">Gemini 2.5 Flash (Free)</option>
          </select>
        )}

        <button
          onClick={onScrapeClick}
          disabled={scrapeRunning}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold font-mono
                     bg-accent text-white
                     hover:bg-accent/90 hover:shadow-[0_0_16px_rgba(79,142,247,0.3)]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     cursor-pointer"
        >
          {scrapeRunning ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Scrape
            </>
          )}
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-dim hover:text-red hover:bg-red/10 cursor-pointer"
            title="Sign out"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}

function TabBtn({ active, onClick, children, color, badge }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string; badge?: number }) {
  const colors: Record<string, { text: string; bg: string; indicator: string; glow: string }> = {
    accent: { text: 'text-accent', bg: 'bg-accent/10', indicator: 'bg-accent', glow: 'shadow-[0_0_8px_rgba(79,142,247,0.25)]' },
    accent2: { text: 'text-accent2', bg: 'bg-accent2/10', indicator: 'bg-accent2', glow: 'shadow-[0_0_8px_rgba(124,92,252,0.25)]' },
    green: { text: 'text-green', bg: 'bg-green/10', indicator: 'bg-green', glow: 'shadow-[0_0_8px_rgba(61,214,140,0.25)]' },
    gold: { text: 'text-gold', bg: 'bg-gold/10', indicator: 'bg-gold', glow: 'shadow-[0_0_8px_rgba(245,200,66,0.2)]' },
    default: { text: 'text-text', bg: 'bg-surface', indicator: 'bg-accent', glow: '' },
  }
  const c = colors[color || 'default']

  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-lg text-[12px] font-medium font-mono cursor-pointer flex items-center gap-1.5
        ${active ? `${c.bg} ${c.text} ${c.glow}` : 'text-dim hover:text-muted hover:bg-white/[0.03]'}`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-0.5 min-w-[18px] text-center px-1 py-px text-[9px] rounded-full font-semibold ${
          active ? `bg-white/10 ${c.text}` : 'bg-surface text-dim'
        }`}>
          {badge}
        </span>
      )}
      {active && (
        <span className={`absolute -bottom-[1px] left-2.5 right-2.5 h-[2px] rounded-full ${c.indicator}`} />
      )}
    </button>
  )
}
