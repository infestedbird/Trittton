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
  return (
    <aside className="border-r border-border overflow-y-auto p-5 px-4 flex flex-col gap-5">
      <div>
        <div className="font-mono text-[10px] tracking-widest uppercase text-muted mb-2">
          Department
        </div>
        <div className="flex flex-col gap-0.5">
          <DeptButton
            code="ALL"
            label="All Departments"
            count={totalCourses}
            active={activeDept === 'ALL'}
            onClick={() => onDeptClick('ALL')}
          />
          {departments.map((d, i) => (
            <DeptButton
              key={d.code}
              code={d.code}
              label={d.code}
              count={d.count}
              active={activeDept === d.code}
              onClick={() => onDeptClick(d.code)}
              delay={i}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function DeptButton({
  label,
  count,
  active,
  onClick,
  delay = 0,
}: {
  code: string
  label: string
  count: number
  active: boolean
  onClick: () => void
  delay?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex justify-between items-center px-2.5 py-1.5 rounded-md font-mono text-[12px]
        cursor-pointer border-none text-left transition-all duration-100 animate-slide-in
        ${active
          ? 'bg-accent/12 text-accent'
          : 'text-muted hover:bg-surface hover:text-text'
        }`}
      style={{ animationDelay: `${Math.min(delay * 15, 300)}ms` }}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] rounded px-1.5 py-px ${
          active ? 'bg-accent/20 text-accent' : 'bg-surface text-dim'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
