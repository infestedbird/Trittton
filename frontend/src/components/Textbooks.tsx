import { useState, useEffect, useMemo } from 'react'

// ── Types ──

interface FreeLink {
  source: string
  url: string
  type: 'free_pdf' | 'borrow' | 'preview' | 'library' | 'buy' | 'rental'
  note: string
}

interface BookResult {
  title: string
  author: string
  isbn: string
  required: boolean
  no_textbook: boolean
  free_links: FreeLink[]
  open_library: { title: string; author: string; year: number; open_library_url: string; borrowable: boolean }[]
}

interface SearchResult {
  course: string
  books: BookResult[]
  source: string
  message?: string
  course_title?: string
}

interface CourseEntry {
  code: string
  title: string
  book_count: number
  curated: boolean
}

// ── Helpers ──

function linkIcon(type: string): string {
  switch (type) {
    case 'free_pdf': return '\ud83d\udcbe'
    case 'borrow': return '\ud83d\udcda'
    case 'preview': return '\ud83d\udc41\ufe0f'
    case 'library': return '\ud83c\udfeb'
    case 'buy': return '\ud83d\uded2'
    case 'rental': return '\ud83d\udce6'
    default: return '\ud83d\udd17'
  }
}

// ── Component ──

export function Textbooks() {
  const [courses, setCourses] = useState<CourseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [filter, setFilter] = useState('')
  const [sidebarTab, setSidebarTab] = useState<'all' | 'curated'>('curated')

  // Load course list
  useEffect(() => {
    setLoading(true)
    fetch('/api/textbooks/courses')
      .then(r => r.json())
      .then(d => setCourses(d.courses || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Search when course selected
  useEffect(() => {
    if (!selectedCourse) { setSearchResult(null); return }
    setSearching(true)
    fetch(`/api/textbooks/search?course=${encodeURIComponent(selectedCourse)}`)
      .then(r => r.json())
      .then(d => setSearchResult(d))
      .catch(() => setSearchResult(null))
      .finally(() => setSearching(false))
  }, [selectedCourse])

  const filteredCourses = useMemo(() => {
    let list = courses
    if (sidebarTab === 'curated') list = list.filter(c => c.curated)
    if (filter) {
      const q = filter.toLowerCase()
      list = list.filter(c => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
    }
    return list
  }, [courses, filter, sidebarTab])

  const curatedCount = courses.filter(c => c.curated).length

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin block" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex">
      {/* ═══ LEFT — Course List ═══ */}
      <div className="w-72 shrink-0 border-r border-border bg-surface flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-bold text-text">Textbooks</h2>
          <div className="text-[11px] text-muted mt-0.5">{courses.length} courses &middot; {curatedCount} with known books</div>
        </div>

        <div className="px-3 mb-2">
          <div className="relative">
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search courses..."
              className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-[12px] text-text outline-none focus:border-accent/50 placeholder:text-muted" />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
        </div>

        <div className="px-3 mb-2">
          <div className="flex gap-1 bg-bg rounded-lg p-0.5">
            <button onClick={() => setSidebarTab('curated')}
              className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                sidebarTab === 'curated' ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              Known Books
            </button>
            <button onClick={() => setSidebarTab('all')}
              className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                sidebarTab === 'all' ? 'bg-card text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              All Courses
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredCourses.map(c => {
            const isActive = selectedCourse === c.code
            return (
              <button key={c.code} onClick={() => setSelectedCourse(c.code)}
                className={`w-full text-left px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-0.5 ${
                  isActive ? 'bg-accent/10' : 'hover:bg-card'}`}>
                <div className={`text-[13px] font-semibold ${isActive ? 'text-accent' : 'text-text'}`}>{c.code}</div>
                <div className="text-[11px] text-muted truncate">{c.title}</div>
              </button>
            )
          })}
          {filteredCourses.length === 0 && (
            <div className="text-center py-8 text-[12px] text-muted">No courses found</div>
          )}
        </div>
      </div>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCourse && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-accent">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-text mb-2">Textbook Finder</h2>
              <p className="text-[13px] text-muted leading-relaxed mb-6">
                Find textbooks for any course. Get free PDF downloads, library copies, and the best prices for buying or renting.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['CSE 12', 'MATH 20A', 'PHYS 2A', 'CHEM 6A', 'ECON 1', 'BILD 1', 'CSE 30', 'ECE 15'].map(code => (
                  <button key={code} onClick={() => setSelectedCourse(code)}
                    className="px-3 py-1.5 rounded-lg bg-card border border-border text-[12px] text-muted hover:text-text hover:border-accent/30 cursor-pointer transition-all">
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedCourse && searching && (
          <div className="flex items-center justify-center h-full">
            <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin block" />
          </div>
        )}

        {selectedCourse && !searching && searchResult && (
          <div className="p-6 max-w-3xl">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text">{searchResult.course}</h1>
                {searchResult.source === 'known' && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-green/10 text-green border border-green/20">Verified</span>
                )}
              </div>
              {searchResult.course_title && (
                <div className="text-[14px] text-muted mt-1">{searchResult.course_title}</div>
              )}
              {searchResult.message && (
                <div className="text-[12px] text-muted mt-3 bg-card border border-border rounded-lg px-4 py-2.5">{searchResult.message}</div>
              )}
            </div>

            {searchResult.books.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-muted">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div className="text-[14px] font-medium text-text mb-1">No textbook found</div>
                <div className="text-[13px] text-muted">This course may use custom materials or open-source resources.</div>
              </div>
            ) : (
              <div className="space-y-5">
                {searchResult.books.map((book, i) => {
                  if (book.no_textbook) {
                    return (
                      <div key={i} className="bg-green/5 border border-green/20 rounded-xl p-5 flex items-center gap-3">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-green shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <div className="text-[14px] font-semibold text-green">No textbook required</div>
                          <div className="text-[12px] text-muted mt-0.5">Check your syllabus for any recommended readings.</div>
                        </div>
                      </div>
                    )
                  }

                  const freeLinks = book.free_links.filter(l => l.type === 'free_pdf')
                  const borrowLinks = book.free_links.filter(l => l.type === 'borrow' || l.type === 'library')
                  const previewLinks = book.free_links.filter(l => l.type === 'preview')
                  const buyLinks = book.free_links.filter(l => l.type === 'buy' || l.type === 'rental')

                  return (
                    <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Book info */}
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-16 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-accent">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[16px] font-bold text-text leading-snug">{book.title}</h3>
                            <div className="text-[13px] text-muted mt-1">by {book.author}</div>
                            <div className="flex items-center gap-3 mt-2">
                              {book.isbn && <span className="text-[11px] text-muted font-mono">ISBN {book.isbn}</span>}
                              {book.required && (
                                <span className="px-2 py-0.5 rounded-full bg-red/10 text-red font-semibold text-[10px]">Required</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Free PDFs */}
                      {freeLinks.length > 0 && (
                        <div className="px-5 py-3 border-t border-border/50 bg-green/[0.03]">
                          <div className="text-[10px] font-semibold text-green uppercase tracking-wider mb-2">Free Downloads</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {freeLinks.map((link, j) => (
                              <a key={j} href={link.url} target="_blank" rel="noopener"
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border hover:border-green/30 hover:bg-green/5 transition-all group">
                                <span className="text-base">{linkIcon(link.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12px] font-semibold text-green group-hover:underline">{link.source}</div>
                                  <div className="text-[10px] text-muted truncate">{link.note}</div>
                                </div>
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-muted shrink-0">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                                </svg>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Borrow / Library */}
                      {borrowLinks.length > 0 && (
                        <div className="px-5 py-3 border-t border-border/50">
                          <div className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-2">Borrow Free</div>
                          <div className="flex flex-wrap gap-1.5">
                            {borrowLinks.map((link, j) => (
                              <a key={j} href={link.url} target="_blank" rel="noopener"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-accent/30 transition-all text-[12px] text-accent font-medium hover:underline">
                                <span className="text-sm">{linkIcon(link.type)}</span>
                                {link.source}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Buy / Rent */}
                      {buyLinks.length > 0 && (
                        <div className="px-5 py-3 border-t border-border/50">
                          <div className="text-[10px] font-semibold text-gold uppercase tracking-wider mb-2">Buy or Rent</div>
                          <div className="flex flex-wrap gap-1.5">
                            {buyLinks.map((link, j) => (
                              <a key={j} href={link.url} target="_blank" rel="noopener"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-gold/30 transition-all text-[12px] text-gold font-medium hover:underline">
                                <span className="text-sm">{linkIcon(link.type)}</span>
                                {link.source}
                                <span className="text-[10px] text-muted font-normal">({link.note})</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Preview */}
                      {previewLinks.length > 0 && (
                        <div className="px-5 py-3 border-t border-border/50">
                          <div className="flex gap-1.5">
                            {previewLinks.map((link, j) => (
                              <a key={j} href={link.url} target="_blank" rel="noopener"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-border2 transition-all text-[11px] text-muted hover:text-text">
                                {link.source} &rarr;
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Open Library editions */}
                      {book.open_library.length > 0 && book.open_library.some(e => e.borrowable) && (
                        <div className="px-5 py-3 border-t border-border/50">
                          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">Available Editions</div>
                          {book.open_library.filter(e => e.borrowable).slice(0, 3).map((ed, j) => (
                            <a key={j} href={ed.open_library_url} target="_blank" rel="noopener"
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface transition-all">
                              <span className="text-[12px] text-text hover:underline">{ed.title}</span>
                              {ed.year > 0 && <span className="text-[11px] text-muted">({ed.year})</span>}
                              <span className="text-[9px] text-green font-semibold px-1.5 py-0.5 rounded-full bg-green/10 ml-auto">Free Borrow</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
