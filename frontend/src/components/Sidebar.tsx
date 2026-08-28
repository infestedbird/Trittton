import { useState, useMemo, useEffect } from 'react'

interface Dept {
  code: string
  count: number
}

interface SidebarProps {
  departments: Dept[]
  activeDept: string
  totalCourses: number
  onDeptClick: (dept: string) => void
  // Mobile drawer controls. When provided, the sidebar renders as an overlay drawer on small screens.
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ departments, activeDept, totalCourses, onDeptClick, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return departments
    const q = search.trim().toUpperCase()
    return departments.filter((d) => d.code.includes(q))
  }, [departments, search])

  const handleDeptClick = (dept: string) => {
    onDeptClick(dept)
    if (onMobileClose) onMobileClose()
  }

  // Close on Escape when open as a drawer.
  useEffect(() => {
    if (!mobileOpen || !onMobileClose) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  return (
    <>
    {/* Backdrop — mobile only */}
    <div
      className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
        mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onMobileClose}
      aria-hidden
    />
    <aside className={`border-r border-border/80 overflow-y-auto flex flex-col bg-surface/55 backdrop-blur-xl
        md:static md:translate-x-0 md:w-[220px] md:shrink-0 md:z-auto
        fixed top-16 bottom-0 left-0 w-[280px] max-w-[84vw] z-50 transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Header + search */}
      <div className="sticky top-0 bg-surface/90 backdrop-blur-xl z-10 px-4 pt-5 pb-3 border-b border-border/60">
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted mb-3">
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
            className="h-9 w-full bg-card/75 border border-border rounded-xl text-[11px]
              pl-8 pr-2 outline-none text-text placeholder:text-dim
              focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(100,136,255,0.08)]"
          />
        </div>
      </div>

      {/* Department list */}
      <div className="flex flex-col gap-1 px-2.5 py-3">
        <DeptButton
          code="ALL"
          label="All Departments"
          count={totalCourses}
          active={activeDept === 'ALL'}
          onClick={() => handleDeptClick('ALL')}
        />
        {filtered.map((d) => (
          <DeptButton
            key={d.code}
            code={d.code}
            label={d.code}
            count={d.count}
            active={activeDept === d.code}
            onClick={() => handleDeptClick(d.code)}
          />
        ))}
        {filtered.length === 0 && search && (
          <div className="text-center py-4 text-[11px] text-dim">
            No departments match "{search}"
          </div>
        )}
      </div>
    </aside>
    </>
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
      className={`flex justify-between items-center px-3 py-2.5 rounded-xl text-[12px]
        cursor-pointer border-none text-left
        ${active
          ? 'bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(100,136,255,0.18),0_8px_20px_rgba(0,0,0,0.12)]'
          : 'text-muted hover:bg-card/70 hover:text-text'
        }`}
    >
      <span className={active ? 'font-semibold' : ''}>{label}</span>
      <span
        className={`text-[11px] rounded-full px-2 py-0.5 ${
          active ? 'bg-accent/20 text-accent font-semibold' : 'bg-card/80 text-dim'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
