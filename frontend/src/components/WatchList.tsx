import type { SeatAlert, WatchInfo } from '../hooks/useSeatWatch'
import type { Course } from '../types'
import type { RmpRating } from '../hooks/useRmpRatings'
import type { SavedCourse } from '../hooks/useMySchedule'
import { CourseCard } from './CourseCard'
import { webRegUrl } from '../lib/links'

interface WatchListProps {
  watches: Record<string, WatchInfo>
  alerts: SeatAlert[]
  onUnwatch: (sectionId: string, courseCode: string, section: string) => void
  onDismissAlert: (index: number) => void
  notifPermission: NotificationPermission
  onRequestNotifications: () => void
  courses: Course[]
  getRating?: (instructor: string) => RmpRating | null | undefined
  onAddToSchedule?: (course: SavedCourse) => void
  hasCourse?: (courseCode: string) => boolean
  hasSection?: (courseCode: string, sectionCode: string, sectionType: string) => boolean
  hasCompleted?: (courseCode: string) => boolean
  isWatching?: (sectionId: string) => boolean
  onWatch?: (sectionId: string, courseCode: string, section: string, meta?: Record<string, unknown>) => void
}

function chancePercent(info: WatchInfo): number {
  if (info.last_available > 0) return 100
  const limit = info.limit || 0
  const waitlisted = info.waitlisted || 0
  if (limit === 0) return 15
  if (waitlisted === 0) return 40
  return Math.max(5, Math.min(85, 60 - waitlisted * 8))
}

function chanceColor(pct: number): string {
  if (pct >= 70) return 'text-green'
  if (pct >= 35) return 'text-gold'
  return 'text-red'
}

function chanceBg(pct: number): string {
  if (pct >= 70) return 'bg-green'
  if (pct >= 35) return 'bg-gold'
  return 'bg-red'
}

export function WatchList({ watches, alerts, onUnwatch, onDismissAlert, notifPermission, onRequestNotifications,
  courses, getRating, onAddToSchedule, hasCourse, hasSection, hasCompleted, isWatching, onWatch }: WatchListProps) {
  const entries = Object.entries(watches)

  // Group watches by course_code so we show each course once
  const watchedCourseCodes = [...new Set(entries.map(([, info]) => info.course_code))]
  const watchedCourses = watchedCourseCodes
    .map(code => courses.find(c => c.course_code === code))
    .filter((c): c is Course => c !== undefined)

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text">Seat Alerts</h1>
            <p className="text-sm text-muted mt-1">
              Watching {entries.length} section{entries.length !== 1 ? 's' : ''} across {watchedCourseCodes.length} course{watchedCourseCodes.length !== 1 ? 's' : ''}
            </p>
          </div>
          {notifPermission !== 'granted' ? (
            <button onClick={onRequestNotifications}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gold text-bg hover:opacity-90 cursor-pointer transition-all">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              Enable Notifications
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm text-green font-medium">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Notifications on
            </span>
          )}
        </div>

        {/* Recent alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-green flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
              Seats Just Opened
            </h2>
            {alerts.map((alert, i) => (
              <div key={`${alert.section_id}-${alert.timestamp}`}
                className="flex items-center justify-between px-5 py-4 rounded-2xl bg-green/8 border border-green/20 animate-fade-in">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green/15 flex items-center justify-center">
                    <svg width="24" height="24" fill="none" stroke="#3dd68c" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-base font-bold text-text">{alert.course_code} — {alert.section}</div>
                    <div className="text-sm text-green font-semibold">
                      {alert.available} seat{alert.available !== 1 ? 's' : ''} just opened — enroll now!
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a href={webRegUrl(alert.section_id)} target="_blank" rel="noopener"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-green text-white hover:bg-green/85 cursor-pointer transition-all">
                    Enroll Now
                  </a>
                  <span className="text-xs text-muted">{new Date(alert.timestamp * 1000).toLocaleTimeString()}</span>
                  <button onClick={() => onDismissAlert(i)} className="p-1.5 rounded-lg text-dim hover:text-text hover:bg-surface cursor-pointer">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Watched courses — full course cards with inline chance strip */}
        {watchedCourses.length > 0 ? (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Watched Courses</h2>
            {watchedCourses.map((course, i) => {
              const courseSectionWatches = entries.filter(([, info]) => info.course_code === course.course_code)

              return (
                <div key={course.course_code} className="rounded-2xl border border-border overflow-hidden bg-card">
                  {/* Integrated chance strip inside the card */}
                  <div className="px-5 py-3 bg-surface/50 flex items-center gap-4 flex-wrap border-b border-border/50">
                    <svg width="16" height="16" fill="#f5c842" viewBox="0 0 24 24" className="shrink-0">
                      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {courseSectionWatches.map(([sectionId, info]) => {
                      const pct = chancePercent(info)
                      return (
                        <div key={sectionId} className="flex items-center gap-2 h-7">
                          <span className="text-xs text-muted">{info.type} {info.section}</span>
                          {/* Single inline bar with percentage inside */}
                          <div className="relative w-28 h-5 bg-card rounded-full overflow-hidden border border-border/50">
                            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${chanceBg(pct)}/30`}
                              style={{ width: `${pct}%` }} />
                            <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${chanceColor(pct)}`}>
                              {pct}% — {pct >= 70 ? 'Good' : pct >= 35 ? 'Moderate' : 'Low'}
                            </span>
                          </div>
                          {(info.waitlisted || 0) > 0 && (
                            <span className="text-[11px] text-gold">{info.waitlisted} waitlisted</span>
                          )}
                          <button onClick={() => onUnwatch(sectionId, info.course_code, info.section)}
                            className="p-1 rounded text-dim hover:text-red cursor-pointer" title="Unwatch this section">
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Full course card content — same as browse, rendered without its own border */}
                  <div className="-mx-px -mb-px">
                    <CourseCard
                      course={course}
                      index={i}
                      onAddToSchedule={onAddToSchedule}
                      isInSchedule={hasCourse?.(course.course_code)}
                      hasSection={hasSection}
                      hasCompleted={hasCompleted}
                      getRating={getRating}
                      isWatching={isWatching}
                      onWatch={onWatch}
                      onUnwatch={onUnwatch}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : entries.length > 0 ? (
          /* Watches exist but courses not loaded yet */
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Watched Sections</h2>
            <p className="text-sm text-muted">Course data is still loading. Section details will appear once courses are scraped.</p>
            {entries.map(([sectionId, info]) => {
              const pct = chancePercent(info)
              return (
                <div key={sectionId} className="flex items-center justify-between px-5 py-4 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-4">
                    <div className={`text-xl font-bold ${chanceColor(pct)}`}>{pct}%</div>
                    <div>
                      <div className="font-mono text-sm font-bold text-accent">{info.course_code} <span className="text-muted">{info.section}</span></div>
                      <div className="text-xs text-muted">{info.type} {info.days} {info.time} {info.instructor}</div>
                    </div>
                  </div>
                  <button onClick={() => onUnwatch(sectionId, info.course_code, info.section)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-red/10 text-red hover:bg-red/20 cursor-pointer">
                    Unwatch
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gold/10 flex items-center justify-center mb-5">
              <svg width="36" height="36" fill="none" stroke="#f5c842" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text mb-2">No Sections Watched</h2>
            <p className="text-sm text-muted max-w-md leading-relaxed">
              When a section is full, click the <strong className="text-gold">Watch</strong> button next to it in the course browser.
              You'll get a notification the moment a seat opens up.
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="rounded-2xl bg-surface/30 border border-border p-6 space-y-3">
          <h3 className="text-sm font-semibold text-text">How Seat Alerts Work</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
                <span className="text-accent text-lg font-bold">1</span>
              </div>
              <p className="text-xs text-muted">Find a full section and click <strong className="text-gold">Watch</strong></p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-accent2/10 flex items-center justify-center mx-auto mb-2">
                <span className="text-accent2 text-lg font-bold">2</span>
              </div>
              <p className="text-xs text-muted">We poll UCSD every 45 seconds for seat changes</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center mx-auto mb-2">
                <span className="text-green text-lg font-bold">3</span>
              </div>
              <p className="text-xs text-muted">Browser notification + alert here when a seat opens</p>
            </div>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="rounded-2xl bg-surface/20 border border-border/50 px-5 py-4 text-xs text-dim leading-relaxed">
            <strong className="text-muted">About "chance" estimates:</strong> Based on waitlist length and section capacity.
            Full sections with no waitlist have higher chances (students drop without waitlisting). Heavy waitlists lower the odds. Enroll immediately when seats open.
          </div>
        )}
      </div>
    </div>
  )
}
