import { TERM_OPTIONS } from '../lib/links'

export type ViewType = 'browse' | 'ai' | 'schedule' | 'completed' | 'progress'

interface HeaderProps {
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

export function Header({ isLoaded, stats, onScrapeClick, scrapeRunning, activeView, onViewChange, model, onModelChange, term, onTermChange, scheduleCount, completedCount }: HeaderProps) {
  return (
    <header className="border-b border-border h-14 px-8 flex items-center justify-between sticky top-0 bg-bg/92 backdrop-blur-xl z-50">
      <div className="flex items-center gap-6">
        <div className="font-mono text-[13px] tracking-wide font-medium text-accent">
          UCSD <span className="text-muted">/</span> course browser
        </div>

        {isLoaded && (
          <div className="flex bg-surface rounded-lg p-0.5 border border-border">
            <TabBtn active={activeView === 'browse'} onClick={() => onViewChange('browse')}>
              Browse
            </TabBtn>
            <TabBtn active={activeView === 'ai'} onClick={() => onViewChange('ai')} color="accent2">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              AI Planner
            </TabBtn>
            <TabBtn active={activeView === 'schedule'} onClick={() => onViewChange('schedule')} color="green">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              My Schedule
              {scheduleCount > 0 && (
                <span className="ml-1 px-1.5 py-px text-[9px] rounded-full bg-green/20 text-green font-medium">
                  {scheduleCount}
                </span>
              )}
            </TabBtn>
            <TabBtn active={activeView === 'completed'} onClick={() => onViewChange('completed')} color="accent2">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
              History
              {completedCount > 0 && (
                <span className="ml-1 px-1.5 py-px text-[9px] rounded-full bg-accent2/20 text-accent2 font-medium">
                  {completedCount}
                </span>
              )}
            </TabBtn>
            <TabBtn active={activeView === 'progress'} onClick={() => onViewChange('progress')} color="gold">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Grad Progress
            </TabBtn>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isLoaded && (
          <div className="flex gap-5 font-mono text-[11px] text-muted">
            <span><b className="text-text font-medium">{stats.totalCourses.toLocaleString()}</b> courses</span>
            <span><b className="text-text font-medium">{stats.totalSections.toLocaleString()}</b> sections</span>
          </div>
        )}

        {/* Term selector */}
        <select
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
          className="bg-surface border border-border rounded-lg text-[11px] font-mono text-muted
            px-2 py-1 outline-none cursor-pointer focus:border-accent"
        >
          {TERM_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Model selector */}
        {isLoaded && (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="bg-surface border border-border rounded-lg text-[11px] font-mono text-muted
              px-2 py-1 outline-none cursor-pointer focus:border-accent"
          >
            <option value="sonnet">Sonnet 4.6</option>
            <option value="opus">Opus 4.6</option>
          </select>
        )}

        <button
          onClick={onScrapeClick}
          disabled={scrapeRunning}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium font-mono
                     bg-accent/10 text-accent border border-accent/20
                     hover:bg-accent/20 hover:border-accent/30
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-150 cursor-pointer"
        >
          {scrapeRunning ? (
            <>
              <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5" />
              </svg>
              Scrape
            </>
          )}
        </button>
      </div>
    </header>
  )
}

function TabBtn({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  const activeColor = color === 'accent2' ? 'text-accent2' : color === 'green' ? 'text-green' : color === 'gold' ? 'text-gold' : 'text-text'
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-[12px] font-medium font-mono transition-all duration-150 cursor-pointer flex items-center gap-1.5
        ${active ? `bg-card ${activeColor} shadow-sm` : 'text-muted hover:text-text'}`}
    >
      {children}
    </button>
  )
}
