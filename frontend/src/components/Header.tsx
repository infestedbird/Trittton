import { EnrollCountdown } from './EnrollCountdown'
import { ThemeToggle } from './ThemeToggle'

export type ViewType = 'browse' | 'ai' | 'councillor' | 'schedule' | 'planner' | 'live' | 'scheduler' | 'events' | 'completed' | 'progress' | 'watching' | 'dining' | 'rooms' | 'transit' | 'internships' | 'textbooks' | 'parking'

interface HeaderProps {
  termOptions: { value: string; label: string }[]
  onLogout?: () => void
  onScrapeClick: () => void
  scrapeRunning: boolean
  term: string
  onTermChange: (term: string) => void
  userDisplayName?: string | null
  userPhotoURL?: string | null
  onToggleSidebar?: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function Header({ onScrapeClick, scrapeRunning, term, onTermChange, termOptions, onLogout, userDisplayName, userPhotoURL, onToggleSidebar, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="h-14 px-4 flex items-center justify-between sticky top-0 z-50 border-b border-border"
      style={{
        background: theme === 'light' ? 'rgba(255,255,255,0.82)' : 'rgba(28,28,30,0.82)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
      }}
    >
      {/* Left — brand */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-card cursor-pointer">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <span className="font-semibold text-[15px] text-text tracking-tight">Trittton</span>
        </div>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-2">
        <EnrollCountdown />

        <select
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
          className="bg-card border border-border rounded-lg text-[13px] text-text
            px-3 py-1.5 outline-none cursor-pointer focus:border-accent hover:border-border2"
        >
          {termOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <button
          onClick={onScrapeClick}
          disabled={scrapeRunning}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold
                     bg-accent text-white shadow-sm
                     hover:bg-accent/90
                     disabled:opacity-50 disabled:cursor-not-allowed
                     cursor-pointer"
        >
          {scrapeRunning ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Scrape
            </>
          )}
        </button>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />

        {onLogout && (
          <div className="flex items-center gap-1.5 ml-0.5">
            {userPhotoURL ? (
              <img src={userPhotoURL} alt="" className="w-7 h-7 rounded-full ring-1 ring-border" referrerPolicy="no-referrer" />
            ) : userDisplayName ? (
              <div className="w-7 h-7 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
            ) : null}
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-muted hover:text-red hover:bg-red/10 cursor-pointer"
              title="Sign out"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
