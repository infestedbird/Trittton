import type { ScrapeProgress } from '../types'

interface ScrapePanelProps {
  progress: ScrapeProgress
  show: boolean
  onClose: () => void
  onLoadResults: () => void
}

export function ScrapePanel({ progress, show, onClose, onLoadResults }: ScrapePanelProps) {
  if (!show) return null

  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">
            {progress.status === 'running' && 'Scraping UCSD Courses...'}
            {progress.status === 'done' && 'Scrape Complete'}
            {progress.status === 'error' && 'Scrape Failed'}
            {progress.status === 'idle' && 'Ready to Scrape'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors text-lg cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progress.status === 'error' ? 'bg-red' : progress.status === 'done' ? 'bg-green' : 'bg-accent'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-surface rounded-lg p-3 text-center">
            <div className="font-mono text-lg font-medium text-text">
              {progress.current}/{progress.total}
            </div>
            <div className="font-mono text-[10px] text-muted mt-0.5">departments</div>
          </div>
          <div className="bg-surface rounded-lg p-3 text-center">
            <div className="font-mono text-lg font-medium text-green">
              {progress.coursesFound}
            </div>
            <div className="font-mono text-[10px] text-muted mt-0.5">courses found</div>
          </div>
          <div className="bg-surface rounded-lg p-3 text-center">
            <div className="font-mono text-lg font-medium text-red">
              {progress.errors.length}
            </div>
            <div className="font-mono text-[10px] text-muted mt-0.5">errors</div>
          </div>
        </div>

        {/* Current subject */}
        {progress.status === 'running' && progress.currentSubject && (
          <div className="text-[12px] text-muted font-mono mb-4">
            Currently scraping: <span className="text-accent">{progress.currentSubject}</span>
          </div>
        )}

        {/* Error log */}
        {progress.errors.length > 0 && (
          <div className="max-h-24 overflow-y-auto bg-surface rounded-lg p-3 mb-4">
            {progress.errors.map((e, i) => (
              <div key={i} className="text-[11px] text-red font-mono">
                {e}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {progress.status === 'done' && (
            <button
              onClick={onLoadResults}
              className="px-4 py-2 rounded-lg text-[13px] font-medium
                bg-green/10 text-green border border-green/20
                hover:bg-green/20 transition-all cursor-pointer"
            >
              Load Results
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium
              bg-surface text-muted border border-border
              hover:text-text hover:border-border2 transition-all cursor-pointer"
          >
            {progress.status === 'done' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
