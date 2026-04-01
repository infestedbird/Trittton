import { useState } from 'react'

interface LoginPageProps {
  onLogin: (token: string) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        onLogin(data.token)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <h1 className="font-mono text-[20px] font-bold text-accent tracking-wide">trittton</h1>
          <p className="text-[13px] text-muted mt-1">UCSD Course Browser</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ucsd.edu"
              autoComplete="email"
              autoFocus
              className="w-full bg-surface border border-border rounded-xl px-4 py-3
                text-[14px] text-text font-sans outline-none
                focus:border-accent/50 placeholder:text-dim"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3
                text-[14px] text-text font-sans outline-none
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
            disabled={loading || !email.trim() || !password}
            className="w-full py-3 rounded-xl font-mono text-[13px] font-semibold
              bg-accent text-white hover:bg-accent/85 hover:shadow-[0_0_20px_rgba(79,142,247,0.3)]
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-dim font-mono mt-4">
          Private instance &middot; Authorized users only
        </p>
      </div>
    </div>
  )
}
