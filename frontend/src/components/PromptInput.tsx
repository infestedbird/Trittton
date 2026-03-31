import { useState } from 'react'

interface PromptInputProps {
  label: string
  placeholder: string
  onSubmit: (value: string) => void
  disabled?: boolean
}

export function PromptInput({ label, placeholder, onSubmit, disabled }: PromptInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim() || disabled) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <div className="mt-3 bg-card rounded-xl border border-border p-3">
      <div className="font-mono text-[11px] text-muted mb-2">{label}</div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-surface border border-border rounded-lg text-text font-sans text-[13px]
            px-3 py-2 outline-none transition-colors focus:border-accent placeholder:text-dim
            disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="px-4 py-2 rounded-lg text-[13px] font-medium font-mono
            bg-accent text-white hover:bg-accent/85
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all cursor-pointer"
        >
          Send
        </button>
      </div>
    </div>
  )
}
