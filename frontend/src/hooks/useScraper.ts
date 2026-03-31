import { useState, useCallback, useRef, useEffect } from 'react'
import type { ScrapeProgress } from '../types'

const defaultProgress: ScrapeProgress = {
  status: 'idle',
  current: 0,
  total: 0,
  currentSubject: '',
  coursesFound: 0,
  errors: [],
}

export function useScraper(onComplete?: () => void) {
  const [progress, setProgress] = useState<ScrapeProgress>(defaultProgress)
  const [showPanel, setShowPanel] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Auto-load results when scrape completes
  useEffect(() => {
    if (progress.status === 'done' && onCompleteRef.current) {
      onCompleteRef.current()
    }
  }, [progress.status])

  const startScrape = useCallback(async (term: string = 'SP26') => {
    setShowPanel(true)
    setProgress({ ...defaultProgress, status: 'running' })

    try {
      const startRes = await fetch(`/api/scrape/start?term=${term}`)
      if (!startRes.ok) throw new Error('Failed to start scrape')

      const abort = new AbortController()
      abortRef.current = abort

      const res = await fetch('/api/scrape/progress', { signal: abort.signal })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setProgress((prev) => ({
                ...prev,
                ...data,
                errors: data.error ? [...prev.errors, data.error] : prev.errors,
              }))
            } catch {
              // skip malformed SSE data
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, err instanceof Error ? err.message : 'Unknown error'],
      }))
    }
  }, [])

  const stopScrape = useCallback(() => {
    abortRef.current?.abort()
    setProgress((prev) => ({ ...prev, status: 'idle' }))
  }, [])

  return { progress, showPanel, setShowPanel, startScrape, stopScrape }
}
