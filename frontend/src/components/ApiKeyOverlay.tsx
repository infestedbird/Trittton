import { useState } from 'react'

interface ApiKeyOverlayProps {
  onSubmit: (key: string) => void
}

export function ApiKeyOverlay({ onSubmit }: ApiKeyOverlayProps) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      setError('Please enter your API key')
      return
    }
    if (!trimmed.startsWith('AIza')) {
      setError('That doesn\u2019t look like a valid Gemini API key')
      return
    }
    onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-8 space-y-5 shadow-2xl"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gold/12 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f5c842" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-text">Set Up Your Gemini API Key</h2>
            <p className="text-[13px] text-muted mt-2 leading-relaxed">
              To use AI features, you need a free Google Gemini API key.
              Your key is stored locally in this browser and never sent to our servers.
            </p>
          </div>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
              bg-accent/10 border border-accent/20 text-accent text-[13px] font-semibold font-mono
              hover:bg-accent/15 hover:border-accent/30 transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Get your free key here
          </a>

          <div>
            <label className="block font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">
              Gemini API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError('') }}
              placeholder="AIza..."
              autoFocus
              className="w-full bg-surface border border-border rounded-xl px-4 py-3
                text-[14px] text-text font-mono outline-none
                focus:border-accent/50 placeholder:text-dim"
            />
          </div>

          {error && (
            <div className="text-[12px] text-red font-mono bg-red/8 border border-red/15 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full py-3 rounded-xl font-mono text-[13px] font-semibold
              bg-gold text-bg hover:opacity-90
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
              transition-all"
          >
            Save Key &amp; Continue
          </button>

          <p className="text-[10px] text-dim font-mono text-center">
            Stored in localStorage &middot; Never leaves your browser
          </p>
        </form>
      </div>
    </div>
  )
}
