import { useState, useCallback, useRef } from 'react'
import type { Course, Section, ScrapeProgress } from '../types'
import { isTssTerm } from '../lib/links'

const BATCH_SIZE = 30

// Hardcoded fallback so scraping starts instantly without waiting for the server
const FALLBACK_SUBJECTS = [
  'AIP','AAS','AWP','ANES','ANBI','ANAR','ANTH','ANSC','ASTR','AUD',
  'BENG','BNFO','BIEB','BICD','BIPN','BIBC','BGGN','BGJC','BGRD','BGSE','BILD','BIMM','BISP','BIOM',
  'CMM','CENG','CHEM','CLX','CHIN','CLAS','CCS','CLIN','CLRE','COGS','COMM','COGR','CSS','CSE','COSE','CCE','CGS','CAT',
  'TDDM','TDHD','TDMV','TDPF','TDTR','DSC','DSE','DERM','DSGN','DOC','DDPM',
  'ECON','EAP','EDS','ERC','ECE','EMED','ENG','ENVR','ESYS','ETIM','ETHN','EXPR',
  'FPM','FILM',
  'GPCO','GPEC','GPGN','GPIM','GPLA','GPPA','GPPS','GLBH','GSS',
  'HITO','HIAF','HIEA','HIEU','HILA','HISC','HISA','HINE','HIUS','HIGL','HIGR','HILD','HDS','HUM',
  'INTL','JAPN','JWSP',
  'LATI','LISL','LIAB','LIDS','LIFR','LIGN','LIGM','LIHL','LIIT','LIPO','LISP',
  'LTAM','LTCO','LTCS','LTEU','LTFR','LTGM','LTGK','LTIT','LTKO','LTLA','LTRU','LTSP','LTTH','LTWR','LTEN','LTWL','LTEA',
  'MMW','MBC','MATS','MATH','MSED','MAE','MED','MUIR','MCWP','MUS',
  'NANO','NEU','NEUG','OBG','OPTH','ORTH',
  'PATH','PEDS','PHAR','SPPS','PHIL','PAE','PHYS','POLI','PSY','PSYC','PH','PHB',
  'RMAS','RAD','MGTF','MGT','MGTA','MGTP','RELI','RMED','REV',
  'SPPH','SOMI','SOMC','SIOC','SIOG','SIOB','SIO','SEV','SOCG','SOCE','SOCI','SE','SURG','SYN',
  'TDAC','TDDE','TDDR','TDGE','TDGR','TDHT','TDPW','TDPR','TMC',
  'USP','UROL','VIS','WARR','WCWP','WES',
]

const defaultProgress: ScrapeProgress = {
  status: 'idle',
  current: 0,
  total: 0,
  currentSubject: '',
  coursesFound: 0,
  errors: [],
}

// ── HTML parsing in the browser ─────────────────────────────────────────────

function clean(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim()
}

const VALID_TYPES = new Set(['LE', 'DI', 'LA', 'SE', 'IN', 'TA', 'TU', 'CL', 'ST'])

function parsePageHTML(html: string): Course[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const courses: Course[] = []
  let current: Course | null = null
  let currentSubject = ''

  for (const tr of doc.querySelectorAll('tr')) {
    const tds = tr.querySelectorAll(':scope > td')
    if (!tds.length) continue

    // Detect subject from <h2> like "Mathematics (MATH )"
    const h2 = tr.querySelector('h2')
    if (h2) {
      const m = clean(h2.textContent || '').match(/\(([A-Z]{2,6})\s*\)/)
      if (m) currentSubject = m[1]
      continue
    }

    const rowClass = tds[0].className || ''

    if (rowClass.includes('crsheader')) {
      const texts = Array.from(tds).map(td => clean(td.textContent || ''))
      if (texts.length < 3) continue
      const courseNum = texts[1]
      if (!/^\d/.test(courseNum)) continue

      const titleRaw = texts[2]
      const unitsMatch = titleRaw.match(/\(\s*(\d+\.?\d*)\s*(?:Units?)?\s*\)/i)
      const units = unitsMatch ? unitsMatch[1] : ''
      const title = titleRaw.replace(/\s*\(\s*\d+\.?\d*\s*(?:Units?)?\s*\)/i, '').trim()
      const courseCode = `${currentSubject} ${courseNum}`
      const restrictions = texts[0]

      if (current && current.course_code === courseCode) {
        if (units && !current.units) current.units = units
        if (restrictions && !current.restrictions) current.restrictions = restrictions
      } else {
        current = {
          subject: currentSubject,
          course_code: courseCode,
          title,
          units,
          restrictions,
          sections: [],
        }
        courses.push(current)
      }
      continue
    }

    if (!current || !rowClass.includes('brdr')) continue

    const texts = Array.from(tds).map(td => clean(td.textContent || ''))
    if (texts.length < 13) continue

    const sectionType = texts[3]
    if (!VALID_TYPES.has(sectionType)) continue

    const availableRaw = texts[10]
    const waitlistMatch = availableRaw.match(/Waitlist\((\d+)\)/)
    let available: string, waitlisted: string
    if (waitlistMatch) {
      available = '0'
      waitlisted = waitlistMatch[1]
    } else if (availableRaw.includes('FULL')) {
      available = '0'
      waitlisted = ''
    } else {
      available = availableRaw
      waitlisted = ''
    }

    const sec: Section = {
      section_id: texts[2],
      type: sectionType,
      section: texts[4],
      days: texts[5],
      time: texts[6],
      building: texts[7],
      room: texts[8],
      instructor: texts[9],
      available,
      limit: texts[11],
      waitlisted,
    }
    current.sections.push(sec)
  }

  return courses
}

// ── Scraping orchestration ──────────────────────────────────────────────────

async function fetchBatch(term: string, subjects: string[]): Promise<Course[]> {
  const res = await fetch('/api/proxy/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term, subjects }),
  })
  if (!res.ok) throw new Error(`Batch failed: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)

  const courses: Course[] = []
  for (const html of data.pages) {
    courses.push(...parsePageHTML(html))
  }
  return courses
}

async function fetchSubjectsLive(term: string): Promise<string[] | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`/api/proxy/subjects?term=${term}`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const codes = data.map((s: { code: string }) => s.code.trim()).filter(Boolean)
    return codes.length > 0 ? codes : null
  } catch {
    return null
  }
}

export function useClientScraper(onComplete?: (courses: Course[]) => void) {
  const [progress, setProgress] = useState<ScrapeProgress>(defaultProgress)
  const [showPanel, setShowPanel] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const startScrape = useCallback(async (term: string = 'FA26') => {
    // Abort any previous scrape
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setShowPanel(true)
    setProgress({ ...defaultProgress, status: 'running' })

    try {
      if (isTssTerm(term)) {
        setProgress({
          ...defaultProgress,
          status: 'running',
          currentSubject: 'TSS catalog',
        })
        const response = await fetch(`/api/courses?term=${encodeURIComponent(term)}&refresh=true`, {
          signal: abort.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `TSS catalog failed: ${response.status}`)
        if (!Array.isArray(data)) throw new Error('TSS catalog returned an unexpected response')
        setProgress({
          status: 'done',
          current: data.length,
          total: data.length,
          currentSubject: '',
          coursesFound: data.length,
          errors: [],
        })
        onComplete?.(data)
        setShowPanel(false)
        return
      }

      // Use fallback subjects immediately — don't wait for server
      const subjects = [...FALLBACK_SUBJECTS]
      const batches: string[][] = []
      for (let i = 0; i < subjects.length; i += BATCH_SIZE) {
        batches.push(subjects.slice(i, i + BATCH_SIZE))
      }

      setProgress(p => ({ ...p, total: subjects.length }))

      // Also try to get live subject list in background — if it arrives
      // before we finish, we'll use any extra subjects it has
      const livePromise = fetchSubjectsLive(term)

      // Send first batch alone to warm up the server, then fire the rest
      const allCourses: Course[] = []
      let completedSubjects = 0
      const errors: string[] = []

      const updateProgress = (batch: string[]) => {
        completedSubjects += batch.length
        setProgress({
          status: 'running',
          current: completedSubjects,
          total: subjects.length,
          currentSubject: batch[batch.length - 1],
          coursesFound: allCourses.length,
          errors,
        })
      }

      const processBatch = (batch: string[], idx: number) =>
        fetchBatch(term, batch).then(
          (courses) => { allCourses.push(...courses); updateProgress(batch) },
          (err) => {
            errors.push(`Batch ${idx + 1} failed: ${err instanceof Error ? err.message : 'unknown'}`)
            updateProgress(batch)
          }
        )

      // Warm-up: send batch 1 first so Render wakes up
      await processBatch(batches[0], 0)

      // Fire remaining batches all at once
      if (batches.length > 1) {
        await Promise.all(batches.slice(1).map((b, i) => processBatch(b, i + 1)))
      }

      // Check if live subject list had extra subjects we missed
      const liveSubjects = await livePromise
      if (liveSubjects) {
        const existing = new Set(subjects)
        const extra = liveSubjects.filter(s => !existing.has(s))
        if (extra.length > 0) {
          // Fetch the extra subjects we didn't have in our fallback
          const extraBatches: string[][] = []
          for (let i = 0; i < extra.length; i += BATCH_SIZE) {
            extraBatches.push(extra.slice(i, i + BATCH_SIZE))
          }
          await Promise.all(extraBatches.map((b, i) => processBatch(b, batches.length + i)))
        }
      }

      // 4. Save to server (signed-in users only — the endpoint requires a Firebase ID token)
      try {
        const { authFetch } = await import('../lib/auth')
        const res = await authFetch('/api/courses/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courses: allCourses, term }),
        })
        if (!res.ok && res.status !== 401) {
          // 401 just means "not signed in" — that's fine, we keep the local copy.
          // Other failures may be worth surfacing to the user.
          console.warn('save_courses failed', res.status, await res.text().catch(() => ''))
        }
      } catch {
        // Save failed, but we still have the data locally
      }

      setProgress({
        status: 'done',
        current: subjects.length,
        total: subjects.length,
        currentSubject: '',
        coursesFound: allCourses.length,
        errors,
      })

      onComplete?.(allCourses)
      setShowPanel(false)
    } catch (err) {
      setProgress(p => ({
        ...p,
        status: 'error',
        errors: [...p.errors, err instanceof Error ? err.message : 'Unknown error'],
      }))
    }
  }, [onComplete])

  const stopScrape = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setProgress(p => ({ ...p, status: 'idle' }))
  }, [])

  return { progress, showPanel, setShowPanel, startScrape, stopScrape }
}
