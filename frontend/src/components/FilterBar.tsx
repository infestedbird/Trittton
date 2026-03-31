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
  return (
    <div className="flex gap-2.5 items-center flex-wrap animate-fade-in">
      <div className="relative flex-1 max-w-[340px]">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
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
            pl-8 pr-3 py-2 outline-none transition-colors duration-150
            focus:border-accent placeholder:text-dim"
        />
      </div>

      <select
        value={sectionType}
        onChange={(e) => onTypeChange(e.target.value)}
        data-testid="type-filter"
        className="bg-surface border border-border rounded-lg text-text font-sans text-[13px]
          px-2.5 py-2 outline-none cursor-pointer transition-colors duration-150
          focus:border-accent"
      >
        <option value="">All types</option>
        <option value="LE">Lecture (LE)</option>
        <option value="DI">Discussion (DI)</option>
        <option value="LA">Lab (LA)</option>
      </select>

      <select
        value={availability}
        onChange={(e) => onAvailChange(e.target.value)}
        data-testid="avail-filter"
        className="bg-surface border border-border rounded-lg text-text font-sans text-[13px]
          px-2.5 py-2 outline-none cursor-pointer transition-colors duration-150
          focus:border-accent"
      >
        <option value="">All availability</option>
        <option value="open">Has open seats</option>
        <option value="waitlist">Waitlist available</option>
        <option value="full">Full / closed</option>
      </select>

      <div className="ml-auto font-mono text-[11px] text-muted" data-testid="result-count">
        {resultCount.toLocaleString()} course{resultCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
