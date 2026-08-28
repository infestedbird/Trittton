import { useState, useEffect } from 'react'
import type { ViewType } from './Header'
import { useIsMobile } from '../hooks/useMediaQuery'

interface SideNavProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  scheduleCount: number
  completedCount: number
  watchCount: number
  collapsed: boolean
  onToggleCollapse: () => void
  // Mobile drawer state — controlled from the parent so the Header hamburger can toggle it.
  mobileOpen?: boolean
  onMobileClose?: () => void
}

interface NavGroup {
  label: string
  defaultOpen: boolean
  items: NavItem[]
}

interface NavItem {
  view: ViewType
  label: string
  icon: React.ReactNode
  badge?: number
}

const GROUPS: (scheduleCount: number, completedCount: number, watchCount: number) => NavGroup[] = (scheduleCount, completedCount, watchCount) => [
  {
    label: 'Explore',
    defaultOpen: true,
    items: [
      { view: 'browse', label: 'Browse', icon: <MagnifyIcon /> },
    ],
  },
  {
    label: 'Plan',
    defaultOpen: true,
    items: [
      { view: 'schedule', label: 'My Schedule', icon: <CalendarIcon />, badge: scheduleCount },
      { view: 'planner', label: '4-Year Plan', icon: <AcademicIcon /> },
      { view: 'ai', label: 'AI Planner', icon: <SparkleIcon /> },
    ],
  },
  {
    label: 'Enroll',
    defaultOpen: true,
    items: [
      { view: 'enrollment', label: 'Enrollment Center', icon: <EnrollIcon /> },
      { view: 'watching', label: 'Seat Alerts', icon: <BellIcon />, badge: watchCount },
    ],
  },
  {
    label: 'Track',
    defaultOpen: true,
    items: [
      { view: 'completed', label: 'Course History', icon: <HistoryIcon />, badge: completedCount },
      { view: 'prereqs', label: 'Prereq Chains', icon: <NodesIcon /> },
    ],
  },
  {
    label: 'Resources',
    defaultOpen: true,
    items: [
      { view: 'campus', label: 'Campus & More', icon: <GridIcon /> },
    ],
  },
]

const STORAGE_KEY = 'sidenav-collapsed-groups'

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}

export function SideNav({ activeView, onViewChange, scheduleCount, completedCount, watchCount, collapsed, onToggleCollapse, mobileOpen = false, onMobileClose }: SideNavProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(loadCollapsed)
  const groups = GROUPS(scheduleCount, completedCount, watchCount)
  const isMobile = useIsMobile()

  const toggleGroup = (label: string) => {
    const next = { ...collapsedGroups, [label]: !collapsedGroups[label] }
    setCollapsedGroups(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  // Selecting a view on mobile closes the drawer.
  const handleViewChange = (view: ViewType) => {
    onViewChange(view)
    if (isMobile && onMobileClose) onMobileClose()
  }

  // Close on Escape when drawer is open on mobile.
  useEffect(() => {
    if (!isMobile || !mobileOpen || !onMobileClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile, mobileOpen, onMobileClose])

  // ── Mobile: full-screen drawer with backdrop ──
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onMobileClose}
          aria-hidden
        />
        {/* Drawer */}
        <nav
          className={`fixed top-0 left-0 bottom-0 w-[260px] max-w-[80vw] z-50 bg-surface border-r border-border flex flex-col overflow-y-auto transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Navigation</span>
            {onMobileClose && (
              <button onClick={onMobileClose} className="p-1 rounded-md text-muted hover:text-text hover:bg-card cursor-pointer">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {groups.map((group) => {
            const isCollapsed = collapsedGroups[group.label]
            return (
              <div key={group.label} className="mb-0.5">
                <button onClick={() => toggleGroup(group.label)} className="w-full flex items-center justify-between px-4 py-1.5 cursor-pointer group">
                  <span className="text-[11px] font-medium text-dim uppercase tracking-wider group-hover:text-muted">{group.label}</span>
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className={`text-dim transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0' : 'max-h-96'}`}>
                  <div className="px-2 pb-1.5 space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = activeView === item.view
                      return (
                        <button
                          key={item.view}
                          onClick={() => handleViewChange(item.view)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left cursor-pointer transition-all relative ${
                            isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-card hover:text-text'
                          }`}
                        >
                          <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
                          <span className={`text-[14px] flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className={`min-w-[20px] h-5 text-[11px] font-semibold rounded-full flex items-center justify-center px-1.5 ${isActive ? 'bg-accent/20 text-accent' : 'bg-card text-muted'}`}>
                              {item.badge}
                            </span>
                          )}
                          {isActive && <span className="w-[3px] h-4 rounded-full bg-accent absolute left-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>
      </>
    )
  }

  // ── Desktop: existing inline behavior ──
  if (collapsed) {
    return (
      <nav className="w-[64px] border-r border-border/80 bg-surface/75 backdrop-blur-xl flex flex-col items-center py-3 gap-1.5 shrink-0">
        <button onClick={onToggleCollapse} className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-card cursor-pointer mb-2">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        {groups.flatMap(g => g.items).map(item => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={`relative p-2 rounded-lg cursor-pointer transition-all ${
              activeView === item.view
                ? 'bg-accent/12 text-accent'
                : 'text-muted hover:text-text hover:bg-card'
            }`}
            title={item.label}
          >
            {item.icon}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[10px] font-bold rounded-full flex items-center justify-center px-1 bg-accent text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    )
  }

  return (
    <nav className="w-[240px] border-r border-border/80 bg-surface/75 backdrop-blur-xl flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 pt-5 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Navigation</span>
        <button onClick={onToggleCollapse} className="p-1 rounded-md text-muted hover:text-text hover:bg-card cursor-pointer">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsedGroups[group.label]
        return (
          <div key={group.label} className="mb-1.5">
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-4 py-2 cursor-pointer group"
            >
              <span className="text-[11px] font-medium text-dim uppercase tracking-wider group-hover:text-muted">
                {group.label}
              </span>
              <svg
                width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                className={`text-dim transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0' : 'max-h-96'}`}>
              <div className="px-2.5 pb-2 space-y-1">
                {group.items.map((item) => {
                  const isActive = activeView === item.view
                  return (
                    <button
                      key={item.view}
                      onClick={() => onViewChange(item.view)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all relative ${
                        isActive
                          ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(100,136,255,0.15),0_8px_18px_rgba(0,0,0,0.1)]'
                          : 'text-muted hover:bg-card/80 hover:text-text'
                      }`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0">
                        {item.icon}
                      </span>
                      <span className={`text-[13px] flex-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`min-w-[20px] h-5 text-[11px] font-semibold rounded-full flex items-center justify-center px-1.5 ${
                            isActive ? 'bg-accent/20 text-accent' : 'bg-card text-muted'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="w-[3px] h-4 rounded-full bg-accent absolute left-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

// ── Icons (18x18 SVG) ──

function MagnifyIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
}
function CalendarIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
}
function AcademicIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
}
function SparkleIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
}
function HistoryIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
}
function BellIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
}
function NodesIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="5" cy="6" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" /><path strokeLinecap="round" d="M7 6 L10 11 M14 11 L17 6 M7 18 L10 13 M14 13 L17 18" /></svg>
}
function EnrollIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M12 2.25c-2.172 1.25-4.594 2-7.125 2.25v6.75c0 5.043 3.438 9.284 8.1 10.5 4.662-1.216 8.1-5.457 8.1-10.5V4.5A18.64 18.64 0 0112 2.25z" /></svg>
}
function GridIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" /><rect x="14" y="14" width="6.5" height="6.5" rx="1.5" /></svg>
}
