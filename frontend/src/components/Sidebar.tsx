import { useState, useMemo } from 'react'

interface Dept {
  code: string
  count: number
}

interface SidebarProps {
  departments: Dept[]
  activeDept: string
  totalCourses: number
  onDeptClick: (dept: string) => void
}

export function Sidebar({ departments, activeDept, totalCourses, onDeptClick }: SidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return departments
    const q = search.trim().toUpperCase()
    return departments.filter((d) => d.code.includes(q))
  }, [departments, search])

  return (
    <aside className="border-r border-border overflow-y-auto flex flex-col">
      {/* Header + search */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur-sm z-10 px-4 pt-4 pb-2 border-b border-border/50">
        <div className="font-mono text-[10px] tracking-widest uppercase text-muted mb-2.5">
          Departments
        </div>
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 text-dim"
            width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter..."
            className="w-full bg-surface border border-border rounded-lg text-[11px] font-mono
              pl-7 pr-2 py-1.5 outline-none text-text placeholder:text-dim
              focus:border-accent/50"
          />
        </div>
      </div>

      {/* Department list */}
      <div className="flex flex-col gap-px px-2 py-2">
        <DeptButton
          code="ALL"
          label="All Departments"
          count={totalCourses}
          active={activeDept === 'ALL'}
          onClick={() => onDeptClick('ALL')}
        />
        {filtered.map((d) => (
          <DeptButton
            key={d.code}
            code={d.code}
            label={d.code}
            count={d.count}
            active={activeDept === d.code}
            onClick={() => onDeptClick(d.code)}
          />
        ))}
        {filtered.length === 0 && search && (
          <div className="text-center py-4 text-[11px] text-dim font-mono">
            No departments match "{search}"
          </div>
        )}
      </div>
    </aside>
  )
}

function DeptButton({
  label,
  count,
  active,
  onClick,
}: {
  code: string
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex justify-between items-center px-3 py-[8px] rounded-lg font-mono text-[12px]
        cursor-pointer border-none text-left
        ${active
          ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(79,142,247,0.15)]'
          : 'text-muted hover:bg-white/[0.03] hover:text-text'
        }`}
    >
      <span className={active ? 'font-semibold' : ''}>{label}</span>
      <span
        className={`text-[10px] rounded-full px-2 py-0.5 ${
          active ? 'bg-accent/20 text-accent font-semibold' : 'bg-surface text-dim'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
