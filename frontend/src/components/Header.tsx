import { EnrollCountdown } from './EnrollCountdown'
import { ThemeToggle } from './ThemeToggle'
import type { CloudSyncStatus } from '../hooks/useCloudSync'
import { isTssTerm } from '../lib/links'

export type ViewType = 'browse' | 'ai' | 'schedule' | 'planner' | 'enrollment' | 'campus' | 'live' | 'scheduler' | 'events' | 'completed' | 'watching' | 'dining' | 'rooms' | 'internships' | 'prereqs'

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
  cloudStatus?: CloudSyncStatus
}

function CloudIndicator({ status }: { status: CloudSyncStatus }) {
  const styles: Record<CloudSyncStatus, { color: string; label: string; icon: 'cloud' | 'spin' | 'warn' | 'off' }> = {
    idle:    { color: 'text-dim',    label: 'Idle',    icon: 'cloud' },
    loading: { color: 'text-muted',  label: 'Loading sync…', icon: 'spin' },
    syncing: { color: 'text-accent', label: 'Syncing…', icon: 'spin' },
    synced:  { color: 'text-green',  label: 'Synced',  icon: 'cloud' },
    error:   { color: 'text-red',    label: 'Sync error', icon: 'warn' },
    offline: { color: 'text-dim',    label: 'Local only', icon: 'off' },
  }
  const s = styles[status]
  return (
    <span title={`Cross-device sync · ${s.label}`} className={`p-1.5 ${s.color}`}>
      {s.icon === 'spin' ? (
        <span className="block w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      ) : s.icon === 'warn' ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ) : s.icon === 'off' ? (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.288 7.69A4.5 4.5 0 0112 6a4.5 4.5 0 014.5 4.5c0 .07-.002.139-.005.207A4.5 4.5 0 0119.5 15c0 .995-.323 1.916-.87 2.665M5.4 18.6A4.5 4.5 0 014.5 15c0-2.485 2.015-4.5 4.5-4.5h.158" />
        </svg>
      ) : (
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
        </svg>
      )}
    </span>
  )
}

export function Header({ onScrapeClick, scrapeRunning, term, onTermChange, termOptions, onLogout, userDisplayName, userPhotoURL, onToggleSidebar, theme, onToggleTheme, cloudStatus }: HeaderProps) {
  const tssTerm = isTssTerm(term)
  return (
    <header className="h-16 px-3 sm:px-5 flex items-center justify-between sticky top-0 z-50 border-b border-border/80 shadow-[0_10px_35px_rgba(0,0,0,0.16)]"
      style={{
        background: theme === 'light' ? 'rgba(255,255,255,0.86)' : 'rgba(8,12,20,0.86)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
      }}
    >
      {/* Left — brand */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} aria-label="Toggle navigation" className="p-2 rounded-xl border border-transparent text-muted hover:text-text hover:bg-card hover:border-border cursor-pointer shrink-0">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shrink-0 shadow-[0_8px_24px_rgba(100,136,255,0.3)] ring-1 ring-white/10">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <div className="min-w-0 leading-none">
            <div className="font-bold text-[16px] text-text tracking-[-0.02em] truncate">Trittton</div>
            <div className="hidden sm:block mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-dim">UC San Diego</div>
          </div>
        </div>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <span className="hidden lg:inline-flex"><EnrollCountdown /></span>

        <select
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
          aria-label="Academic term"
          className="h-10 bg-card/80 border border-border rounded-xl text-[12px] sm:text-[13px] font-semibold text-text
            px-2.5 sm:px-3.5 outline-none cursor-pointer focus:border-accent hover:border-border2 max-w-[128px] sm:max-w-none truncate shadow-sm"
        >
          {termOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <button
          onClick={onScrapeClick}
          disabled={scrapeRunning}
          aria-label={scrapeRunning ? 'Refreshing course data…' : `Refresh latest ${tssTerm ? 'TSS' : 'course'} data`}
          className="h-10 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border border-border text-[12px] sm:text-[13px] font-semibold
                     bg-card/75 text-muted
                     hover:bg-card hover:text-text hover:border-border2
                     disabled:opacity-50 disabled:cursor-not-allowed
                     cursor-pointer"
        >
          {scrapeRunning ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="hidden sm:inline">Refreshing...</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              <span className="hidden xl:inline">Refresh data</span>
            </>
          )}
        </button>

        <span className="hidden sm:inline-flex"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></span>

        {cloudStatus && <CloudIndicator status={cloudStatus} />}

        {onLogout && (
          <div className="flex items-center gap-1 sm:gap-1.5 ml-0.5">
            {userPhotoURL ? (
              <img src={userPhotoURL} alt="" className="w-8 h-8 rounded-full ring-2 ring-border shadow-sm" referrerPolicy="no-referrer" />
            ) : userDisplayName ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent2 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-border">
                {userDisplayName.charAt(0).toUpperCase()}
              </div>
            ) : null}
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-muted hover:text-red hover:bg-red/10 cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
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
