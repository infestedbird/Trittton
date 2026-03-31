import { useEffect, useState } from 'react'
import type { CourseInfoBlock } from '../lib/chat-blocks'
import { rmpUrl, capeUrl, socSearchUrl, courseCodeToSubject } from '../lib/links'

interface CourseInfoCardProps {
  info: CourseInfoBlock
  onAddToSchedule?: (courseCode: string) => void
}

interface RmpData {
  name: string
  rating: number
  difficulty: number
  wouldTakeAgain: number
  numRatings: number
  rmpUrl: string
}

export function CourseInfoCard({ info, onAddToSchedule }: CourseInfoCardProps) {
  const [rmp, setRmp] = useState<RmpData | null>(null)
  const [loading, setLoading] = useState(false)

  // Try to fetch live RMP data
  useEffect(() => {
    if (!info.instructor || info.instructor === 'TBA') return
    // Use inline data if provided by AI
    if (info.rating) {
      setRmp({
        name: info.instructor,
        rating: info.rating,
        difficulty: info.difficulty || 0,
        wouldTakeAgain: info.would_take_again || 0,
        numRatings: info.num_ratings || 0,
        rmpUrl: rmpUrl(info.instructor),
      })
      return
    }
    // Otherwise try the backend proxy
    setLoading(true)
    fetch(`/api/rmp?instructor=${encodeURIComponent(info.instructor)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && !data.error) setRmp(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [info.instructor, info.rating, info.difficulty, info.would_take_again, info.num_ratings])

  const subject = courseCodeToSubject(info.course_code)

  return (
    <div className="my-2 bg-card rounded-xl border border-border p-4 max-w-md">
      {/* Course header */}
      <div className="flex items-center gap-3 mb-3">
        <a
          href={socSearchUrl(subject)}
          target="_blank"
          rel="noopener"
          className="font-mono text-[13px] font-medium bg-accent/12 text-accent rounded-md px-2.5 py-1 hover:bg-accent/20 transition-colors"
        >
          {info.course_code}
        </a>
        <div className="flex-1">
          <div className="text-[13px] font-medium text-text">{info.title}</div>
          <div className="font-mono text-[10px] text-gold">{info.units} units</div>
        </div>
        {onAddToSchedule && (
          <button
            onClick={() => onAddToSchedule(info.course_code)}
            className="font-mono text-[11px] font-medium px-2.5 py-1 rounded-md
              bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20
              transition-all cursor-pointer shrink-0"
          >
            View Sections
          </button>
        )}
      </div>

      {/* Instructor + RMP */}
      {info.instructor && info.instructor !== 'TBA' && (
        <div className="bg-surface rounded-lg p-3 border border-border">
          <div className="flex items-center justify-between mb-2">
            <a
              href={rmpUrl(info.instructor)}
              target="_blank"
              rel="noopener"
              className="text-[13px] font-medium text-text hover:text-accent transition-colors"
            >
              {info.instructor}
            </a>
            <div className="flex gap-1.5">
              <a href={rmpUrl(info.instructor)} target="_blank" rel="noopener" className="font-mono text-[9px] text-green hover:underline">RMP</a>
              <a href={capeUrl(info.course_code)} target="_blank" rel="noopener" className="font-mono text-[9px] text-accent2 hover:underline">CAPEs</a>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              Loading ratings...
            </div>
          )}

          {rmp && (
            <div className="flex gap-4">
              {/* Rating */}
              <div className="text-center">
                <div className={`font-mono text-xl font-bold ${rmp.rating >= 4 ? 'text-green' : rmp.rating >= 3 ? 'text-gold' : 'text-red'}`}>
                  {rmp.rating.toFixed(1)}
                </div>
                <div className="text-[9px] text-muted font-mono">rating</div>
                <Stars rating={rmp.rating} />
              </div>
              {/* Difficulty */}
              <div className="text-center">
                <div className={`font-mono text-xl font-bold ${rmp.difficulty <= 2.5 ? 'text-green' : rmp.difficulty <= 3.5 ? 'text-gold' : 'text-red'}`}>
                  {rmp.difficulty.toFixed(1)}
                </div>
                <div className="text-[9px] text-muted font-mono">difficulty</div>
              </div>
              {/* Would take again */}
              {rmp.wouldTakeAgain > 0 && (
                <div className="text-center">
                  <div className={`font-mono text-xl font-bold ${rmp.wouldTakeAgain >= 70 ? 'text-green' : rmp.wouldTakeAgain >= 50 ? 'text-gold' : 'text-red'}`}>
                    {Math.round(rmp.wouldTakeAgain)}%
                  </div>
                  <div className="text-[9px] text-muted font-mono">again</div>
                </div>
              )}
              {/* Num ratings */}
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-muted">{rmp.numRatings}</div>
                <div className="text-[9px] text-muted font-mono">reviews</div>
              </div>
            </div>
          )}

          {!rmp && !loading && (
            <a
              href={rmpUrl(info.instructor)}
              target="_blank"
              rel="noopener"
              className="text-[11px] text-accent hover:underline font-mono"
            >
              View on RateMyProfessors
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const partial = rating - full
  return (
    <div className="flex gap-px mt-0.5 justify-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="text-[10px]"
          style={{ opacity: i <= full ? 1 : i === full + 1 && partial > 0.3 ? 0.5 : 0.15 }}
        >
          ★
        </span>
      ))}
    </div>
  )
}
