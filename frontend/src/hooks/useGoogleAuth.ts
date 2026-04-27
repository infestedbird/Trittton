import { useState, useEffect, useCallback } from 'react'
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

export interface GoogleUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

export function useGoogleAuth() {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = useCallback(async () => {
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string }
      const code = firebaseErr.code || 'unknown'
      const msg = firebaseErr.message || 'Unknown error'
      console.error('Google sign-in failed:', code, msg)
      setAuthError(`${code}: ${msg}`)
      throw err
    }
  }, [])

  const logOut = useCallback(async () => {
    await signOut(auth)
  }, [])

  return { user, loading, signIn, logOut, authError }
}

// ── Gemini API Key helpers (keyed per UID) ──

export function getGeminiKey(uid: string): string | null {
  return localStorage.getItem(`api_key_${uid}`)
}

export function setGeminiKey(uid: string, key: string) {
  localStorage.setItem(`api_key_${uid}`, key)
}

export function removeGeminiKey(uid: string) {
  localStorage.removeItem(`api_key_${uid}`)
}
