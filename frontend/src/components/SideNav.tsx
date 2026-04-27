import { useState } from 'react'
import type { ViewType } from './Header'

interface SideNavProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  scheduleCount: number
  completedCount: number
  watchCount: number
  collapsed: boolean
  onToggleCollapse: () => void
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
    label: 'Courses',
    defaultOpen: true,
    items: [
      { view: 'browse', label: 'Browse', icon: <MagnifyIcon /> },
      { view: 'schedule', label: 'My Schedule', icon: <CalendarIcon />, badge: scheduleCount },
      { view: 'watching', label: 'Seat Alerts', icon: <BellIcon />, badge: watchCount },
      { view: 'planner', label: '4-Year Plan', icon: <AcademicIcon /> },
    ],
  },
  {
    label: 'AI Tools',
    defaultOpen: true,
    items: [
      { view: 'ai', label: 'AI Planner', icon: <SparkleIcon /> },
      { view: 'councillor', label: 'Councillor', icon: <ChatIcon /> },
      { view: 'scheduler', label: 'Scheduler', icon: <ClockIcon /> },
    ],
  },
  {
    label: 'Campus',
    defaultOpen: true,
    items: [
      { view: 'live', label: 'Live Status', icon: <PulseIcon /> },
      { view: 'rooms', label: 'Empty Rooms', icon: <BuildingIcon /> },
      { view: 'transit', label: 'Transit', icon: <TransitIcon /> },
      { view: 'dining', label: 'Dining', icon: <DiningIcon /> },
      { view: 'textbooks', label: 'Textbooks', icon: <BookIcon /> },
      { view: 'parking', label: 'Parking', icon: <ParkingIcon /> },
      { view: 'events', label: 'Dates', icon: <EventIcon /> },
    ],
  },
  {
    label: 'Career',
    defaultOpen: true,
    items: [
      { view: 'internships', label: 'Internships', icon: <BriefcaseIcon /> },
    ],
  },
  {
    label: 'Profile',
    defaultOpen: true,
    items: [
      { view: 'completed', label: 'History', icon: <HistoryIcon />, badge: completedCount },
      { view: 'progress', label: 'Progress', icon: <ChartIcon /> },
    ],
  },
]

const STORAGE_KEY = 'sidenav-collapsed-groups'

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch { return {} }
}

export function SideNav({ activeView, onViewChange, scheduleCount, completedCount, watchCount, collapsed, onToggleCollapse }: SideNavProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(loadCollapsed)
  const groups = GROUPS(scheduleCount, completedCount, watchCount)

  const toggleGroup = (label: string) => {
    const next = { ...collapsedGroups, [label]: !collapsedGroups[label] }
    setCollapsedGroups(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  if (collapsed) {
    return (
      <nav className="w-[56px] border-r border-border bg-surface flex flex-col items-center py-3 gap-1 shrink-0">
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
    <nav className="w-[220px] border-r border-border bg-surface flex flex-col overflow-y-auto shrink-0">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Navigation</span>
        <button onClick={onToggleCollapse} className="p-1 rounded-md text-muted hover:text-text hover:bg-card cursor-pointer">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsedGroups[group.label]
        return (
          <div key={group.label} className="mb-0.5">
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-4 py-1.5 cursor-pointer group"
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
              <div className="px-2 pb-1.5 space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeView === item.view
                  return (
                    <button
                      key={item.view}
                      onClick={() => onViewChange(item.view)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-all relative ${
                        isActive
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted hover:bg-card hover:text-text'
                      }`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0">
                        {item.icon}
                      </span>
                      <span className={`text-[13px] flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
function ChatIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
}
function ClockIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function PulseIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l3-9 4 18 3-9h5" /></svg>
}
function EventIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function HistoryIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
}
function DiningIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12" /></svg>
}
function BellIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
}
function TransitIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17a1 1 0 110-2 1 1 0 010 2zm8 0a1 1 0 110-2 1 1 0 010 2zM6 17H4V6a2 2 0 012-2h8a2 2 0 012 2h2l3 5v6h-2M6 9h10" /></svg>
}
function BuildingIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3 0h.008v.008H18V7.5z" /></svg>
}
function BookIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
}
function ParkingIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-9.5h5a2.5 2.5 0 000-5h-5v10" /></svg>
}
function BriefcaseIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
function ChartIcon() {
  return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
}
