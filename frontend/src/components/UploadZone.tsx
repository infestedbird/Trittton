import { useCallback, useRef, useState, useEffect } from 'react'
import type { ScrapeProgress } from '../types'

interface UploadZoneProps {
  onFileLoad: (file: File) => void
  onServerLoad: () => void
  onScrape: () => void
  isLoading: boolean
  isScraping: boolean
  scrapeProgress: ScrapeProgress
  error: string | null
}

export function UploadZone({ onFileLoad, onServerLoad, onScrape, isLoading, isScraping, scrapeProgress, error }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f && f.name.endsWith('.json')) onFileLoad(f)
    },
    [onFileLoad],
  )

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [handleDragOver, handleDragLeave, handleDrop])

  // If scraping is in progress, show the inline progress view
  if (isScraping) {
    const pct = scrapeProgress.total > 0 ? (scrapeProgress.current / scrapeProgress.total) * 100 : 0
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <div className="rounded-2xl p-12 px-8 text-center flex flex-col items-center gap-5 w-full max-w-lg">
          <div className="w-14 h-14 rounded-[14px] bg-accent/12 flex items-center justify-center">
            <span className="w-6 h-6 border-[2.5px] border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>

          <h2 className="text-lg font-medium">Scraping UCSD Courses...</h2>

          <div className="w-full max-w-xs">
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 font-mono text-[11px] text-muted">
              <span>{scrapeProgress.current}/{scrapeProgress.total} departments</span>
              <span className="text-green">{scrapeProgress.coursesFound} courses</span>
            </div>
          </div>

          {scrapeProgress.currentSubject && (
            <div className="font-mono text-[12px] text-muted">
              Currently: <span className="text-accent">{scrapeProgress.currentSubject}</span>
            </div>
          )}

          {scrapeProgress.errors.length > 0 && (
            <div className="font-mono text-[11px] text-red">
              {scrapeProgress.errors.length} error{scrapeProgress.errors.length !== 1 ? 's' : ''}
            </div>
          )}

          <p className="text-muted text-[12px] mt-2">
            This takes a few minutes. Courses will load automatically when done.
          </p>
        </div>
      </div>
    )
  }

  // Loading state (auto-fetch in progress)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-[14px] bg-accent/12 flex items-center justify-center">
            <span className="w-6 h-6 border-[2.5px] border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
          <h2 className="text-lg font-medium">Loading courses...</h2>
          <div className="w-48 h-1 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  // Fallback: manual upload zone (shown if auto-load failed and no scrape running)
  return (
    <div className="flex items-center justify-center h-full animate-fade-in">
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`border-[1.5px] border-dashed rounded-2xl p-16 px-8 text-center cursor-pointer
          transition-all duration-200 flex flex-col items-center gap-4 w-full max-w-lg
          ${isDragging
            ? 'border-accent bg-accent/4 scale-[1.02]'
            : 'border-border2 hover:border-accent hover:bg-accent/4'
          }`}
      >
        <div className="w-14 h-14 rounded-[14px] bg-accent/12 flex items-center justify-center">
          <svg width="24" height="24" fill="none" stroke="#4f8ef7" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <h2 className="text-lg font-medium">No course data found</h2>
        <p className="text-muted text-[13px] leading-relaxed">
          Drag and drop{' '}
          <code className="bg-surface px-1.5 py-0.5 rounded text-[12px]">all_courses.json</code>{' '}
          here, or use one of the options below.
        </p>

        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onScrape()
            }}
            className="px-5 py-2.5 rounded-lg text-[13px] font-medium
              bg-accent text-white
              hover:bg-accent/90
              transition-all duration-150 cursor-pointer"
          >
            Scrape from UCSD
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onServerLoad()
            }}
            className="px-4 py-2.5 rounded-lg text-[13px] font-medium
              bg-surface text-muted border border-border
              hover:text-text hover:border-border2
              transition-all duration-150 cursor-pointer"
          >
            Load from server
          </button>
        </div>

        {error && (
          <div className="text-red text-[13px] bg-red/10 px-4 py-2 rounded-lg border border-red/20 mt-2">
            {error}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFileLoad(f)
          }}
        />
      </div>
    </div>
  )
}
