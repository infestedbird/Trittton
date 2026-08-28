import { tssHomeUrl } from '../lib/links'

export function EnrollCountdown() {
  return (
    <a
      href={tssHomeUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="h-10 flex items-center gap-2 px-3.5 rounded-xl text-[12px] font-semibold
        text-muted hover:text-text bg-card/80 border border-border hover:border-accent/40 shadow-sm
        transition-all whitespace-nowrap"
      title="TSS Student Overview shows your personalized booking window"
    >
      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Check booking window
    </a>
  )
}
