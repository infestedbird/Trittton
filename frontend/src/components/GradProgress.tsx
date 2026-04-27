import { useState, useMemo } from 'react'
import { MAJOR_NAMES, COLLEGE_NAMES, COLLEGES, calculateProgress, type ReqProgress } from '../lib/requirements'
import { socSearchUrl, courseCodeToSubject } from '../lib/links'

interface GradProgressProps {
  completedCodes: string[]
}

export function GradProgress({ completedCodes }: GradProgressProps) {
  const [selectedCollege, setSelectedCollege] = useState(() =>
    localStorage.getItem('ucsd-selected-college') || ''
  )
  const [selectedMajor, setSelectedMajor] = useState(() =>
    localStorage.getItem('ucsd-selected-major') || ''
  )
  const [majorSearch, setMajorSearch] = useState('')

  const handleCollegeChange = (college: string) => {
    setSelectedCollege(college)
    localStorage.setItem('ucsd-selected-college', college)
  }

  const handleMajorChange = (major: string) => {
    setSelectedMajor(major)
    localStorage.setItem('ucsd-selected-major', major)
  }

  const handleReset = () => {
    setSelectedCollege('')
    setSelectedMajor('')
    setMajorSearch('')
    localStorage.removeItem('ucsd-selected-college')
    localStorage.removeItem('ucsd-selected-major')
  }

  const completedSet = useMemo(() => new Set(completedCodes), [completedCodes])
  const progress = useMemo(
    () => (selectedMajor && selectedCollege) ? calculateProgress(selectedMajor, selectedCollege, completedSet) : null,
    [selectedMajor, selectedCollege, completedSet],
  )

  const filteredMajors = useMemo(() => {
    if (!majorSearch.trim()) return MAJOR_NAMES
    const q = majorSearch.toLowerCase()
    return MAJOR_NAMES.filter((name) => name.toLowerCase().includes(q))
  }, [majorSearch])

  // Step 1: Select college
  if (!selectedCollege) {
    return (
      <div className="h-[calc(100vh-64px)] overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
          <h2 className="text-lg font-semibold text-text mb-2">Graduation Progress</h2>
          <p className="text-[13px] text-muted mb-6">
            Select your college to get started.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {COLLEGE_NAMES.map((name) => {
              const college = COLLEGES[name]
              return (
                <button
                  key={name}
                  onClick={() => handleCollegeChange(name)}
                  className="text-left px-5 py-4 rounded-xl bg-card border border-border
                    hover:border-accent/30 hover:bg-accent/5
                    transition-all duration-150 cursor-pointer"
                >
                  <div className="text-[14px] font-medium text-text">{college.name}</div>
                  <div className="text-[11px] text-muted mt-1">{college.ge.length} GE requirement areas</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Select major
  if (!selectedMajor) {
    const college = COLLEGES[selectedCollege]
    return (
      <div className="h-[calc(100vh-64px)] overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">Select Your Major</h2>
              <p className="text-[13px] text-muted">
                <span className="text-accent2">{college.name}</span> &middot; {MAJOR_NAMES.length} majors available
              </p>
            </div>
            <button
              onClick={() => handleCollegeChange('')}
              className="text-[11px] px-3 py-1.5 rounded-lg text-muted hover:text-text
                bg-surface border border-border hover:border-border2 transition-all cursor-pointer"
            >
              Change College
            </button>
          </div>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={majorSearch}
              onChange={(e) => setMajorSearch(e.target.value)}
              placeholder="Search majors..."
              className="w-full bg-surface border border-border rounded-lg text-text text-[13px]
                px-3 py-2 pl-9 outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {filteredMajors.map((name) => (
              <button
                key={name}
                onClick={() => handleMajorChange(name)}
                className="text-left px-5 py-4 rounded-xl bg-card border border-border
                  hover:border-accent/30 hover:bg-accent/5
                  transition-all duration-150 cursor-pointer"
              >
                <div className="text-[14px] font-medium text-text">{name}</div>
                <div className="text-[11px] text-muted mt-1">{college.name}</div>
              </button>
            ))}
            {filteredMajors.length === 0 && (
              <div className="col-span-2 text-center py-8 text-muted text-[13px]">
                No majors match your search.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!progress) return null

  const college = COLLEGES[selectedCollege]

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-text">{selectedMajor}</h2>
              <span className="text-[11px] text-accent2 bg-accent2/10 px-2 py-0.5 rounded">
                {college.name}
              </span>
              {progress.isEngineering && (
                <span className="text-[11px] text-gold bg-gold/10 px-2 py-0.5 rounded">
                  Engineering
                </span>
              )}
            </div>
            <div className="text-[13px] text-muted mt-1">
              {completedCodes.length} courses completed &middot; Add more in the History tab
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-[11px] px-3 py-1.5 rounded-lg text-muted hover:text-text
              bg-surface border border-border hover:border-border2 transition-all cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Overall progress */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-medium text-text">Overall Progress</span>
            <span className={`font-mono text-2xl font-bold ${
              progress.overallPct >= 75 ? 'text-green' : progress.overallPct >= 40 ? 'text-gold' : 'text-accent'
            }`}>
              {progress.overallPct}%
            </span>
          </div>
          <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress.overallPct >= 75 ? 'bg-green' : progress.overallPct >= 40 ? 'bg-gold' : 'bg-accent'
              }`}
              style={{ width: `${progress.overallPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-muted">
            <span>{progress.totalCompleted} / {progress.totalRequired} requirements met</span>
            <span>{progress.totalRequired - progress.totalCompleted} remaining</span>
          </div>
        </div>

        {/* Major Requirements */}
        <div className="space-y-3">
          <h3 className="text-[12px] text-accent font-medium uppercase tracking-wide">
            Major Requirements — {selectedMajor}
          </h3>
          <ReqCard req={progress.lowerDiv} />
          <ReqCard req={progress.upperDiv} />
          {progress.electives && <ReqCard req={progress.electives} />}
        </div>

        {/* College GE */}
        <div className="space-y-3">
          <h3 className="text-[12px] text-accent2 font-medium uppercase tracking-wide">
            {college.name} General Education
          </h3>
          {progress.ge.map((g) => (
            <ReqCard key={g.id} req={g} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ReqCard({ req }: { req: ReqProgress }) {
  const pct = req.required > 0 ? Math.round((req.completed / req.required) * 100) : 0
  const isDone = req.completed >= req.required

  return (
    <div className={`rounded-xl border p-4 ${isDone ? 'bg-green/5 border-green/20' : 'bg-card border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isDone ? (
            <span className="text-green text-sm">&#10003;</span>
          ) : (
            <span className="font-mono text-[12px] text-muted">{req.completed}/{req.required}</span>
          )}
          <span className="text-[13px] font-medium text-text">{req.name}</span>
        </div>
        <span className={`font-mono text-[12px] font-medium ${isDone ? 'text-green' : 'text-muted'}`}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-green' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-[11px] text-muted mb-2">{req.description}</div>

      {/* Completed courses */}
      {req.completedCourses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {req.completedCourses.map((c) => (
            <span key={c} className="font-mono text-[11px] px-2 py-0.5 rounded bg-green/10 text-green border border-green/20">
              {c} &#10003;
            </span>
          ))}
        </div>
      )}

      {/* Missing courses */}
      {req.missingOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {req.missingOptions.map((alts, i) => (
            <div key={i} className="flex items-center gap-1">
              {alts.slice(0, 5).map((c, j) => (
                <a
                  key={c}
                  href={socSearchUrl(courseCodeToSubject(c))}
                  target="_blank"
                  rel="noopener"
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-red/8 text-red/80 border border-red/15
                    hover:bg-red/15 hover:text-red transition-colors"
                >
                  {c}{j < Math.min(alts.length, 5) - 1 && alts.length > 1 ? '' : ''}
                </a>
              ))}
              {alts.length > 5 && (
                <span className="font-mono text-[11px] text-dim">+{alts.length - 5} more</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
