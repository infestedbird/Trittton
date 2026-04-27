import { useState } from 'react'

interface LoginPageProps {
  onGoogleSignIn: () => Promise<void>
}

export function LoginPage({ onGoogleSignIn }: LoginPageProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    try {
      await onGoogleSignIn()
    } catch {
      setError('Google sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5 shadow-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Trittton</h1>
          <p className="text-[14px] text-muted mt-1.5">UCSD Course Browser</p>
        </div>

        {/* Sign-in card */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
          <p className="text-[14px] text-muted text-center leading-relaxed mb-6">
            Sign in with your Google account to access AI-powered course planning.
          </p>

          {error && (
            <div className="text-[13px] text-red bg-red/8 border border-red/15 rounded-lg px-4 py-2.5 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 rounded-xl text-[14px] font-semibold
              bg-white text-[#1c1c1e] border border-[#d1d1d6]
              hover:bg-[#f5f5f7] hover:shadow-sm
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
              flex items-center justify-center gap-3 transition-all"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[12px] text-muted mt-6">
          Powered by Gemini AI
        </p>
      </div>
    </div>
  )
}
