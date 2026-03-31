import { useState, useMemo } from 'react'
import { MAJOR_NAMES, calculateProgress, type ReqProgress } from '../lib/requirements'
import { socSearchUrl, courseCodeToSubject } from '../lib/links'

interface GradProgressProps {
  completedCodes: string[]
}

export function GradProgress({ completedCodes }: GradProgressProps) {
  const [selectedMajor, setSelectedMajor] = useState(() =>
    localStorage.getItem('ucsd-selected-major') || ''
  )

  const handleMajorChange = (major: string) => {
    setSelectedMajor(major)
    localStorage.setItem('ucsd-selected-major', major)
  }

  const completedSet = useMemo(() => new Set(completedCodes), [completedCodes])
  const progress = useMemo(
    () => selectedMajor ? calculateProgress(selectedMajor, completedSet) : null,
    [selectedMajor, completedSet],
  )

  if (!selectedMajor) {
    return (
      <div className="h-[calc(100vh-56px)] overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <h2 className="text-lg font-medium text-text mb-2">Graduation Progress</h2>
          <p className="text-[13px] text-muted mb-6">
            Select your intended major to see your progress toward Warren College graduation requirements.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MAJOR_NAMES.map((name) => (
              <button
                key={name}
                onClick={() => handleMajorChange(name)}
                className="text-left px-5 py-4 rounded-xl bg-card border border-border
                  hover:border-accent/30 hover:bg-accent/5
                  transition-all duration-150 cursor-pointer"
              >
                <div className="text-[14px] font-medium text-text">{name}</div>
                <div className="text-[11px] text-muted mt-1">Warren College</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!progress) return null

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-text">{selectedMajor}</h2>
              <span className="font-mono text-[11px] text-accent2 bg-accent2/10 px-2 py-0.5 rounded">
                Warren College
              </span>
              {progress.isEngineering && (
                <span className="font-mono text-[11px] text-gold bg-gold/10 px-2 py-0.5 rounded">
                  Engineering
                </span>
              )}
            </div>
            <div className="text-[13px] text-muted mt-1">
              {completedCodes.length} courses completed &middot; Add more in the History tab
            </div>
          </div>
          <button
            onClick={() => handleMajorChange('')}
            className="font-mono text-[11px] px-3 py-1.5 rounded-lg text-muted hover:text-text
              bg-surface border border-border hover:border-border2 transition-all cursor-pointer"
          >
            Change Major
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
          <div className="flex justify-between mt-2 font-mono text-[11px] text-muted">
            <span>{progress.totalCompleted} / {progress.totalRequired} requirements met</span>
            <span>{progress.totalRequired - progress.totalCompleted} remaining</span>
          </div>
        </div>

        {/* Major Requirements */}
        <div className="space-y-3">
          <h3 className="font-mono text-[12px] text-accent font-medium uppercase tracking-wide">
            Major Requirements — {selectedMajor}
          </h3>
          <ReqCard req={progress.lowerDiv} />
          <ReqCard req={progress.upperDiv} />
          {progress.electives && <ReqCard req={progress.electives} />}
        </div>

        {/* Warren GE */}
        <div className="space-y-3">
          <h3 className="font-mono text-[12px] text-accent2 font-medium uppercase tracking-wide">
            Warren College General Education
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
            <span key={c} className="font-mono text-[10px] px-2 py-0.5 rounded bg-green/10 text-green border border-green/20">
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
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-red/8 text-red/80 border border-red/15
                    hover:bg-red/15 hover:text-red transition-colors"
                >
                  {c}{j < Math.min(alts.length, 5) - 1 && alts.length > 1 ? '' : ''}
                </a>
              ))}
              {alts.length > 5 && (
                <span className="font-mono text-[9px] text-dim">+{alts.length - 5} more</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
