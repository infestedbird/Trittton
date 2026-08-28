import { useMemo } from 'react'
import type { Course } from '../types'
import type { SavedCourse } from '../hooks/useMySchedule'
import type { ScheduleProposal } from '../lib/schedule'
import { buildCalendarBlocks, detectConflicts } from '../lib/schedule'
import { buildSectionBundles } from '../lib/tssBundles'
import { sectionAvailStatus } from '../lib/availability'
import { TssHandoff } from './TssHandoff'

type CheckTone = 'ready' | 'warning' | 'blocked'
interface ReadinessCheck { tone: CheckTone; title: string; detail: string }

export function EnrollmentCenter({
  term,
  schedule,
  proposal,
  allCourses,
  completedCodes,
  onBrowse,
}: {
  term: string
  schedule: SavedCourse[]
  proposal: ScheduleProposal
  allCourses: Course[]
  completedCodes: string[]
  onBrowse: () => void
}) {
  const analysis = useMemo(() => analyzeReadiness(schedule, proposal, allCourses, completedCodes), [schedule, proposal, allCourses, completedCodes])

  if (schedule.length === 0) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto p-6">
        <div className="max-w-lg rounded-3xl border border-border bg-card/80 p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-2xl text-accent">✓</div>
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.025em] text-text">Build your booking queue</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">Plan at least one compatible course option, then return here for conflict, seat, prerequisite, and TSS readiness checks.</p>
          <button onClick={onBrowse} className="mt-6 rounded-xl bg-accent px-5 py-3 text-[12px] font-bold text-white shadow-[0_10px_26px_rgba(100,136,255,0.28)]">Browse course options →</button>
        </div>
      </div>
    )
  }

  const ringColor = analysis.blocked > 0 ? 'text-red' : analysis.warnings > 0 ? 'text-gold' : 'text-green'
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-9">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Enroll</div>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-text">Enrollment Center</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">One last check before UCSD TSS: compatible sections, schedule conflicts, seats, prerequisites, units, and exact booking links.</p>
          </div>
          <TssHandoff term={term} schedule={schedule} />
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[300px_1fr]">
          <section className="rounded-2xl border border-border bg-card/85 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.16)]">
            <div className="flex items-center gap-4">
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-current/15 bg-surface text-2xl font-bold ${ringColor}`}>{analysis.score}</div>
              <div>
                <div className="text-[15px] font-bold text-text">Readiness score</div>
                <div className="mt-1 text-[11px] text-muted">{analysis.blocked > 0 ? `${analysis.blocked} item${analysis.blocked === 1 ? '' : 's'} blocking a clean handoff` : analysis.warnings > 0 ? `${analysis.warnings} item${analysis.warnings === 1 ? '' : 's'} to review` : 'Your planned queue looks ready'}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Metric label="Courses" value={schedule.length} />
              <Metric label="Units" value={proposal.total_units} />
              <Metric label="Checks" value={analysis.checks.length} />
            </div>
            <a href="https://sis.ucsd.edu/" target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface/70 px-3 py-2.5 text-[11px] font-semibold text-muted hover:border-accent/30 hover:text-text">
              Check assigned booking time <span className="text-accent">↗</span>
            </a>
          </section>

          <section className="rounded-2xl border border-border bg-card/65 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-text">Readiness checks</h2>
              <span className="text-[10px] text-muted">Student-specific holds are confirmed in TSS</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.checks.map((check) => <CheckCard key={`${check.title}-${check.detail}`} check={check} />)}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-text">Booking queue</h2>
              <p className="mt-1 text-[11px] text-muted">Open seats first, active waitlists second, unavailable options last.</p>
            </div>
            <button onClick={onBrowse} className="text-[11px] font-semibold text-accent hover:underline">Edit course options</button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {analysis.queue.map((item, index) => (
              <article key={item.course.course_code} className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 font-mono text-[10px] font-bold text-accent">{index + 1}</span>
                    <div>
                      <div className="font-mono text-[11px] font-bold text-accent">{item.course.course_code}</div>
                      <div className="mt-0.5 text-[12px] font-semibold text-text">{item.course.title}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase ${item.tone === 'ready' ? 'border-green/20 bg-green/10 text-green' : item.tone === 'warning' ? 'border-gold/20 bg-gold/10 text-gold' : 'border-red/20 bg-red/10 text-red'}`}>{item.label}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.course.sections.map((section) => (
                    <span key={`${section.type}-${section.section}`} className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[9px] text-muted"><b className="text-text">{section.type}</b> {section.section}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function analyzeReadiness(schedule: SavedCourse[], proposal: ScheduleProposal, allCourses: Course[], completedCodes: string[]) {
  const checks: ReadinessCheck[] = []
  const normalizedCompleted = new Set(completedCodes.map(normalizeCode))
  const blocks = buildCalendarBlocks(proposal)
  const conflicts = detectConflicts(blocks)
  checks.push(conflicts.length > 0
    ? { tone: 'blocked', title: 'Schedule conflicts', detail: `${conflicts.length} overlapping meeting${conflicts.length === 1 ? '' : 's'} need attention.` }
    : { tone: 'ready', title: 'Schedule conflicts', detail: 'No overlapping class meetings detected.' })

  checks.push(proposal.total_units > 18
    ? { tone: 'warning', title: 'Unit load', detail: `${proposal.total_units} units may require college approval.` }
    : proposal.total_units < 12
      ? { tone: 'warning', title: 'Unit load', detail: `${proposal.total_units} units is below the usual full-time threshold.` }
      : { tone: 'ready', title: 'Unit load', detail: `${proposal.total_units} units is within the normal full-time range.` })

  let missingIds = 0
  let incompatible = 0
  let incomplete = 0
  let missingPrereqs = 0
  for (const saved of schedule) {
    if (saved.sections.some((section) => !section.section_id)) missingIds += 1
    const packageSets = saved.sections.map((section) => new Set(section.event_package_ids || []))
    if (packageSets.length > 1 && packageSets.every((set) => set.size > 0)) {
      const common = [...packageSets[0]].filter((id) => packageSets.slice(1).every((set) => set.has(id)))
      if (common.length === 0) incompatible += 1
    }
    const catalogCourse = allCourses.find((course) => normalizeCode(course.course_code) === normalizeCode(saved.course_code))
    if (catalogCourse) {
      const bundles = buildSectionBundles(catalogCourse.sections)
      if (bundles.length > 0 && !bundles.some((bundle) => {
        const selected = new Set(saved.sections.map((section) => section.section_id))
        return bundle.sections.every((section) => selected.has(section.section_id))
      })) incomplete += 1
      for (const prereq of catalogCourse.prerequisites || []) {
        const codes = String(prereq).match(/[A-Z]{2,5}[ -]?\d{1,3}[A-Z]*/g) || []
        if (codes.some((code) => !normalizedCompleted.has(normalizeCode(code)))) missingPrereqs += 1
      }
    }
  }
  checks.push(missingIds > 0
    ? { tone: 'blocked', title: 'TSS identifiers', detail: `${missingIds} course${missingIds === 1 ? '' : 's'} need exact FA26 section IDs.` }
    : { tone: 'ready', title: 'TSS identifiers', detail: 'Every selected section has an exact UCSD identifier.' })
  checks.push(incompatible > 0
    ? { tone: 'blocked', title: 'Section compatibility', detail: `${incompatible} course${incompatible === 1 ? '' : 's'} mix sections from different TSS packages.` }
    : incomplete > 0
      ? { tone: 'warning', title: 'Section compatibility', detail: `${incomplete} course${incomplete === 1 ? '' : 's'} may be missing a linked lecture, discussion, or lab.` }
      : { tone: 'ready', title: 'Section compatibility', detail: 'Selected components match compatible TSS packages.' })
  checks.push(missingPrereqs > 0
    ? { tone: 'warning', title: 'Prerequisites', detail: `${missingPrereqs} prerequisite requirement${missingPrereqs === 1 ? '' : 's'} could not be confirmed from Course History.` }
    : { tone: 'ready', title: 'Prerequisites', detail: 'No unconfirmed catalog prerequisites were found.' })

  const queue = schedule.map((course) => {
    const sectionStates = course.sections.map(sectionAvailStatus)
    const allOpen = sectionStates.every((section) => section.status === 'open')
    const waitlist = sectionStates.some((section) => section.status === 'waitlist')
    return { course, tone: allOpen ? 'ready' as const : waitlist ? 'warning' as const : 'blocked' as const, label: allOpen ? 'Open' : waitlist ? 'Waitlist' : 'Full' }
  }).sort((a, b) => toneRank(a.tone) - toneRank(b.tone))
  const blocked = checks.filter((check) => check.tone === 'blocked').length
  const warnings = checks.filter((check) => check.tone === 'warning').length
  return { checks, queue, blocked, warnings, score: Math.max(0, 100 - blocked * 18 - warnings * 7) }
}

function normalizeCode(code: string) { return code.replace(/[\s-]+/g, '').toUpperCase().replace(/^([A-Z]+)0+/, '$1') }
function toneRank(tone: CheckTone) { return tone === 'ready' ? 0 : tone === 'warning' ? 1 : 2 }

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border bg-surface/65 p-2.5 text-center"><div className="text-lg font-bold text-text">{value}</div><div className="text-[9px] font-semibold uppercase tracking-wider text-dim">{label}</div></div> }
function CheckCard({ check }: { check: ReadinessCheck }) {
  const style = check.tone === 'ready' ? 'border-green/15 bg-green/6 text-green' : check.tone === 'warning' ? 'border-gold/15 bg-gold/6 text-gold' : 'border-red/15 bg-red/6 text-red'
  return <div className={`rounded-xl border p-3 ${style}`}><div className="flex items-center gap-2 text-[11px] font-bold"><span>{check.tone === 'ready' ? '✓' : check.tone === 'warning' ? '!' : '×'}</span>{check.title}</div><p className="mt-1.5 text-[10px] leading-relaxed text-muted">{check.detail}</p></div>
}
