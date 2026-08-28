import { useMemo, useState } from 'react'
import type { SavedCourse } from '../hooks/useMySchedule'
import { isTssTerm, tssHomeUrl } from '../lib/links'

interface HandoffSection {
  section_id: string
  section: string
  type: string
  status?: string | null
  seats: string | null
  waitlist: string | null
}

interface HandoffCourse {
  course_code: string
  title: string
  instructor?: string | null
  tss_booking_url?: string | null
  sections: HandoffSection[]
}

interface HandoffResponse {
  valid: boolean
  schedule_ref: string
  planner_url?: string
  courses: HandoffCourse[]
  issues?: unknown[]
  tss_home_url: string
  disclaimer: string
  error?: string
}

type BookingOutcome = 'pending' | 'booked' | 'waitlisted' | 'skipped'

const outcomeStyle: Record<BookingOutcome, string> = {
  pending: 'border-border bg-card text-muted',
  booked: 'border-green/30 bg-green/10 text-green',
  waitlisted: 'border-gold/30 bg-gold/10 text-gold',
  skipped: 'border-border bg-surface text-dim',
}

export function TssHandoff({ term, schedule }: { term: string; schedule: SavedCourse[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<HandoffResponse | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [outcomes, setOutcomes] = useState<Record<number, BookingOutcome>>({})
  const [tssSessionStarted, setTssSessionStarted] = useState(false)
  const [courseOpened, setCourseOpened] = useState(false)

  const sectionIds = useMemo(
    () => schedule.flatMap((course) => course.sections.map((section) => section.section_id).filter((id): id is string => Boolean(id))),
    [schedule],
  )

  const missingIds = schedule.some((course) => course.sections.some((section) => !section.section_id))
  const activeCourse = handoff?.courses[activeIndex]
  const finishedCount = handoff?.courses.reduce(
    (count, _course, index) => count + ((outcomes[index] || 'pending') !== 'pending' ? 1 : 0),
    0,
  ) || 0
  const progress = handoff?.courses.length ? Math.round((finishedCount / handoff.courses.length) * 100) : 0

  if (!isTssTerm(term)) return null

  const selectCourse = (index: number) => {
    setActiveIndex(index)
    setCourseOpened(false)
  }

  const prepare = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setHandoff(null)
    setOutcomes({})
    setActiveIndex(0)
    setTssSessionStarted(false)
    setCourseOpened(false)
    try {
      const response = await fetch('/api/tss/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, section_ids: sectionIds }),
      })
      const data = await response.json() as HandoffResponse
      if (!response.ok) throw new Error(data.error || `TSS handoff failed: ${response.status}`)
      setHandoff(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the TSS handoff')
    } finally {
      setLoading(false)
    }
  }

  const openTssWindow = (url: string) => {
    // A stable name reuses the same TSS window for every course. UCSD advises
    // students not to keep several TSS tabs open during booking.
    const isDesktop = window.innerWidth >= 1024
    const width = Math.min(1100, Math.max(720, Math.round(window.screen.availWidth * 0.56)))
    const height = Math.max(700, window.screen.availHeight)
    const left = Math.max(0, window.screenX + window.outerWidth - width)
    const features = isDesktop
      ? `popup=yes,width=${width},height=${height},left=${left},top=0,resizable=yes,scrollbars=yes`
      : undefined
    const tssWindow = window.open(url, 'trittton-tss-booking', features)
    tssWindow?.focus()
    return Boolean(tssWindow)
  }

  const openTssLogin = () => {
    if (openTssWindow(tssHomeUrl())) setTssSessionStarted(true)
  }

  const openCourseInTss = () => {
    if (!activeCourse?.tss_booking_url) return
    if (openTssWindow(activeCourse.tss_booking_url)) {
      setTssSessionStarted(true)
      setCourseOpened(true)
    }
  }

  const markOutcome = (outcome: BookingOutcome) => {
    if (!handoff) return
    setOutcomes((current) => ({ ...current, [activeIndex]: outcome }))
    const next = handoff.courses.findIndex(
      (_course, index) => index > activeIndex && (outcomes[index] || 'pending') === 'pending',
    )
    if (next >= 0) {
      selectCourse(next)
      return
    }
    const firstPending = handoff.courses.findIndex(
      (_course, index) => index !== activeIndex && (outcomes[index] || 'pending') === 'pending',
    )
    if (firstPending >= 0) selectCourse(firstPending)
  }

  return (
    <>
      <button
        onClick={prepare}
        disabled={sectionIds.length === 0}
        title={sectionIds.length === 0 ? 'Add exact TSS sections before booking' : 'Review and book your selected courses in TSS'}
        className="group inline-flex items-center gap-2 rounded-xl border border-accent bg-accent px-4 py-2 text-[12px] font-bold text-white shadow-[0_8px_24px_rgba(79,142,247,0.22)] transition-all hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[0_12px_30px_rgba(79,142,247,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M12 2.25c-2.172 1.25-4.594 2-7.125 2.25v6.75c0 5.043 3.438 9.284 8.1 10.5 4.662-1.216 8.1-5.457 8.1-10.5V4.5A18.64 18.64 0 0112 2.25z" />
        </svg>
        Book / Join Waitlist
        <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#060914]/85 p-2 backdrop-blur-md sm:p-4" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tss-booking-title"
            className="flex h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg shadow-[0_30px_100px_rgba(0,0,0,0.65)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M12 2.25c-2.172 1.25-4.594 2-7.125 2.25v6.75c0 5.043 3.438 9.284 8.1 10.5 4.662-1.216 8.1-5.457 8.1-10.5V4.5A18.64 18.64 0 0112 2.25z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 id="tss-booking-title" className="truncate text-[15px] font-semibold text-text sm:text-base">TSS Booking Assistant</h2>
                    <span className="rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-accent">{term}</span>
                  </div>
                  <p className="truncate text-[11px] text-muted">Trittton guides the schedule. UCSD securely completes the booking.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {handoff && handoff.courses.length > 0 && (
                  <div className="hidden items-center gap-2 sm:flex">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-green transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted">{finishedCount}/{handoff.courses.length}</span>
                  </div>
                )}
                <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-muted transition-colors hover:bg-surface hover:text-text" aria-label="Close booking assistant">&times;</button>
              </div>
            </header>

            {loading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <span className="h-8 w-8 rounded-full border-2 border-accent/25 border-t-accent animate-spin" />
                <div className="text-center">
                  <div className="text-sm font-medium text-text">Preparing your TSS booking</div>
                  <div className="mt-1 text-[12px] text-muted">Validating section groups and refreshing availability…</div>
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-md rounded-2xl border border-red/25 bg-red/8 p-5 text-center">
                  <div className="text-sm font-semibold text-red">We couldn’t prepare this booking</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">{error}</p>
                  <button onClick={prepare} className="mt-4 rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white">Try again</button>
                </div>
              </div>
            )}

            {!loading && handoff && (
              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <aside className="w-full shrink-0 overflow-y-auto border-b border-border bg-card/55 lg:w-[330px] lg:border-b-0 lg:border-r">
                  <div className="border-b border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-dim">Your booking queue</span>
                      <span className="text-[10px] text-muted">{handoff.courses.length} course{handoff.courses.length === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">Finish one course at a time and mark the result shown by TSS.</p>
                  </div>

                  {(missingIds || !handoff.valid) && (
                    <div className="m-3 rounded-xl border border-gold/25 bg-gold/8 p-3 text-[11px] leading-relaxed text-gold">
                      {missingIds
                        ? 'Some saved sections are missing TSS IDs. Re-add them from the FA26 browser for a complete handoff.'
                        : 'TSS reported an incomplete or incompatible section group. Review the selected events before booking.'}
                    </div>
                  )}

                  <div className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-2">
                    {handoff.courses.map((course, index) => {
                      const outcome = outcomes[index] || 'pending'
                      const isActive = index === activeIndex
                      return (
                        <button
                          key={`${course.course_code}-${index}`}
                          onClick={() => selectCourse(index)}
                          className={`min-w-[260px] rounded-xl border p-3 text-left transition-all lg:min-w-0 lg:w-full ${
                            isActive ? 'border-accent/50 bg-accent/10 shadow-[0_0_0_1px_rgba(79,142,247,0.12)]' : 'border-border bg-card hover:border-border2 hover:bg-surface/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-mono text-[11px] font-bold text-accent">{course.course_code}</div>
                              <div className="mt-0.5 truncate text-[12px] font-semibold text-text">{course.title}</div>
                            </div>
                            <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${outcomeStyle[outcome]}`}>
                              {outcome}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {course.sections.map((section) => (
                              <span key={section.section_id} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[9px] text-muted">
                                {section.type} {section.section}
                              </span>
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="m-3 rounded-xl border border-border bg-surface/35 p-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-text">
                      <span className="h-2 w-2 rounded-full bg-green shadow-[0_0_8px_rgba(61,214,140,0.7)]" />
                      Private by design
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-dim">Trittton cannot see your UCSD password, TSS screen, or booking actions. You mark the result after TSS confirms it.</p>
                  </div>
                </aside>

                <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#090d18]">
                  {activeCourse ? (
                    <>
                      <div className="shrink-0 border-b border-border bg-card/70 px-4 py-3">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[12px] font-bold text-accent">{activeCourse.course_code}</span>
                              <span className="truncate text-[13px] font-semibold text-text">{activeCourse.title}</span>
                              {activeCourse.instructor && <span className="text-[11px] text-muted">with {activeCourse.instructor}</span>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {activeCourse.sections.map((section) => (
                                <span key={section.section_id} className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[9px] text-muted">
                                  {section.type} {section.section}
                                  {section.status === 'waitlist_only' ? ' · waitlist only' : section.seats ? ` · ${section.seats} seats` : ''}
                                  {section.waitlist && section.waitlist !== '0' ? ` · ${section.waitlist} waitlisted` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${
                              courseOpened ? 'border-green/25 bg-green/10 text-green' : tssSessionStarted ? 'border-accent/25 bg-accent/10 text-accent' : 'border-border bg-surface text-muted'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${courseOpened ? 'bg-green' : tssSessionStarted ? 'bg-accent' : 'bg-dim'}`} />
                              {courseOpened ? 'Course opened in TSS' : tssSessionStarted ? 'TSS sign-in opened' : 'UCSD sign-in needed'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-5 sm:p-8">
                        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 50% 10%, rgba(79,142,247,0.16), transparent 45%)' }} />
                        <div className="relative w-full max-w-2xl">
                          <div className="text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/12 text-accent shadow-[0_0_35px_rgba(79,142,247,0.16)]">
                              <svg width="27" height="27" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-6.75 6.75M6.75 3.75h3.375c.621 0 1.125.504 1.125 1.125v2.25m-4.5-3.375h-1.5A2.25 2.25 0 003 6v12.75A2.25 2.25 0 005.25 21H18a2.25 2.25 0 002.25-2.25v-1.5" />
                              </svg>
                            </div>
                            <div className="mt-4 text-lg font-semibold text-text">Sign in, then book {activeCourse.course_code}</div>
                            <p className="mx-auto mt-1.5 max-w-lg text-[12px] leading-relaxed text-muted">
                              First establish your UCSD session. Then Trittton reuses that exact window and sends it straight to this course's TSS booking page.
                            </p>
                          </div>

                          <div className="mt-6 grid gap-2 sm:grid-cols-3">
                            {[
                              ['1', 'UCSD sign-in', 'Use your student account'],
                              ['2', 'Open this course', 'Reuse the signed-in window'],
                              ['3', 'Book or waitlist', 'Confirm the result in TSS'],
                            ].map(([number, title, detail]) => (
                              <div key={number} className="rounded-xl border border-border bg-card/75 p-3 backdrop-blur">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 font-mono text-[9px] font-bold text-accent">{number}</span>
                                  <span className="text-[11px] font-semibold text-text">{title}</span>
                                </div>
                                <div className="mt-1.5 text-[10px] text-dim">{detail}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-5 grid gap-2 sm:grid-cols-2">
                            <button
                              onClick={openTssLogin}
                              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[12px] font-bold transition-all ${
                                tssSessionStarted
                                  ? 'border-green/25 bg-green/10 text-green hover:bg-green/15'
                                  : 'border-border bg-card text-text hover:border-accent/35 hover:bg-accent/8'
                              }`}
                            >
                              {tssSessionStarted ? '✓ UCSD sign-in opened' : '1. Sign in to UCSD TSS'}
                              <span>↗</span>
                            </button>
                            <button
                              onClick={openCourseInTss}
                              disabled={!activeCourse.tss_booking_url}
                              className="group flex items-center justify-center gap-2 rounded-xl border border-accent bg-accent px-4 py-3 text-[12px] font-bold text-white shadow-[0_12px_35px_rgba(79,142,247,0.28)] transition-all hover:-translate-y-0.5 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {courseOpened ? `Refocus ${activeCourse.course_code}` : `2. Open ${activeCourse.course_code}`}
                              <span className="transition-transform group-hover:translate-x-0.5">↗</span>
                            </button>
                          </div>
                          <p className="mt-2 text-center text-[9px] leading-relaxed text-dim">
                            Finish UCSD sign-in before step 2. Already signed in? Go straight to the course. Every course reuses one TSS window.
                          </p>
                          {handoff.planner_url && (
                            <div className="mt-3 text-center">
                              <a href={handoff.planner_url} target="trittton-class-planner" rel="noopener noreferrer" className="text-[10px] font-medium text-muted underline decoration-border underline-offset-4 hover:text-accent">
                                Course link not loading? Open UCSD's official saved-schedule handoff
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      <footer className="shrink-0 border-t border-border bg-card px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-[11px] font-semibold text-text">What did TSS confirm?</div>
                            <div className="mt-0.5 text-[10px] text-dim">Marking a result only updates this checklist—it does not submit anything.</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => markOutcome('skipped')} className="rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted hover:bg-surface">Skip for now</button>
                            <button onClick={() => markOutcome('waitlisted')} className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-[11px] font-bold text-gold hover:bg-gold/15">Joined waitlist</button>
                            <button onClick={() => markOutcome('booked')} className="rounded-lg border border-green/30 bg-green/10 px-3 py-2 text-[11px] font-bold text-green hover:bg-green/15">Booked successfully ✓</button>
                          </div>
                        </div>
                      </footer>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-6 text-center">
                      <div>
                        <div className="text-sm font-semibold text-text">No bookable TSS course was found</div>
                        <p className="mt-2 text-[12px] text-muted">Review the selected section groups and try again.</p>
                      </div>
                    </div>
                  )}
                </main>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
