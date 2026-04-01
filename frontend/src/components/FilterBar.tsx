interface FilterBarProps {
  search: string
  sectionType: string
  availability: string
  resultCount: number
  onSearchChange: (v: string) => void
  onTypeChange: (v: string) => void
  onAvailChange: (v: string) => void
}

export function FilterBar({
  search,
  sectionType,
  availability,
  resultCount,
  onSearchChange,
  onTypeChange,
  onAvailChange,
}: FilterBarProps) {
  const hasFilters = search || sectionType || availability

  const clearAll = () => {
    onSearchChange('')
    onTypeChange('')
    onAvailChange('')
  }

  return (
    <div className="flex gap-2 items-center flex-wrap animate-fade-in">
      {/* Search */}
      <div className="relative flex-1 max-w-[360px]">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
          width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search courses, titles, instructors..."
          data-testid="search-input"
          className="w-full bg-surface border border-border rounded-lg text-text font-sans text-[13px]
            pl-8 pr-3 py-2 outline-none
            focus:border-accent/60 placeholder:text-dim"
        />
      </div>

      {/* Type filter */}
      <select
        value={sectionType}
        onChange={(e) => onTypeChange(e.target.value)}
        data-testid="type-filter"
        className={`bg-surface border rounded-lg text-[13px] font-sans
          px-2.5 py-2 outline-none cursor-pointer
          focus:border-accent/60
          ${sectionType ? 'border-accent/30 text-accent' : 'border-border text-text'}`}
      >
        <option value="">All types</option>
        <option value="LE">Lecture (LE)</option>
        <option value="DI">Discussion (DI)</option>
        <option value="LA">Lab (LA)</option>
        <option value="SE">Seminar (SE)</option>
      </select>

      {/* Availability filter */}
      <select
        value={availability}
        onChange={(e) => onAvailChange(e.target.value)}
        data-testid="avail-filter"
        className={`bg-surface border rounded-lg text-[13px] font-sans
          px-2.5 py-2 outline-none cursor-pointer
          focus:border-accent/60
          ${availability ? 'border-accent/30 text-accent' : 'border-border text-text'}`}
      >
        <option value="">All seats</option>
        <option value="open">Open seats</option>
        <option value="waitlist">Waitlist</option>
        <option value="full">Full</option>
      </select>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="font-mono text-[11px] text-muted hover:text-text px-2 py-1 rounded-md
            hover:bg-surface cursor-pointer"
        >
          Reset
        </button>
      )}

      {/* Result count */}
      <div className="ml-auto font-mono text-[11px] text-muted" data-testid="result-count">
        <b className="text-text font-medium">{resultCount.toLocaleString()}</b> course{resultCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
