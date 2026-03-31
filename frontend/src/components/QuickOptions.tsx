interface QuickOptionsProps {
  options: string[]
  onSelect: (option: string) => void
  disabled?: boolean
}

export function QuickOptions({ options, onSelect, disabled }: QuickOptionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => !disabled && onSelect(opt)}
          disabled={disabled}
          className="px-4 py-2 rounded-xl text-[13px] font-medium
            bg-accent/10 text-accent border border-accent/20
            hover:bg-accent/20 hover:border-accent/30 hover:scale-[1.02]
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
            transition-all duration-150 cursor-pointer"
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
