import { useState, useEffect, useCallback } from 'react'

interface InternshipField {
  id: string
  label: string
}

interface Job {
  title: string
  company: string
  location: string
  url: string
  date: string
  logo: string
}

interface JobDetail {
  description_html: string
  description_text: string
  seniority: string
  employment_type: string
  job_function: string
  industries: string
  posted: string
  applicants: string
  error?: string
}

const FIELD_ICONS: Record<string, string> = {
  cs: '\ud83d\udcbb', data: '\ud83e\udde0', cybersecurity: '\ud83d\udd12',
  engineering: '\u2699\ufe0f', aerospace: '\ud83d\ude80', business: '\ud83d\udcbc',
  product: '\ud83d\udce6', biology: '\ud83e\uddec', chemistry: '\ud83e\uddea',
  healthcare: '\ud83c\udfe5', design: '\ud83c\udfa8', marketing: '\ud83d\udce3',
  film: '\ud83c\udfac', law: '\u2696\ufe0f', environmental: '\ud83c\udf0d',
  math: '\ud83d\udcca', economics: '\ud83d\udcb0', psychology: '\ud83e\udde0',
  education: '\ud83c\udf93', research: '\ud83d\udd2c', government: '\ud83c\udfe6',
  sports: '\u26bd', realestate: '\ud83c\udfe0', supply: '\ud83d\udce6',
  physics: '\u2699\ufe0f',
}

const FIELD_COLORS: Record<string, string> = {
  cs: '#4f8ef7', data: '#7c5cfc', cybersecurity: '#f25f5c',
  engineering: '#f5c842', aerospace: '#4f8ef7', business: '#3dd68c',
  product: '#7c5cfc', biology: '#3dd68c', chemistry: '#f5c842',
  healthcare: '#f25f5c', design: '#f5c842', marketing: '#4f8ef7',
  film: '#7c5cfc', law: '#f5c842', environmental: '#3dd68c',
  math: '#4f8ef7', economics: '#3dd68c', psychology: '#7c5cfc',
  education: '#f5c842', research: '#7c5cfc', government: '#f5c842',
  sports: '#3dd68c', realestate: '#f5c842', supply: '#4f8ef7',
  physics: '#4f8ef7',
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function Internships() {
  const [fields, setFields] = useState<InternshipField[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedField, setSelectedField] = useState('cs')
  const [fieldLabel, setFieldLabel] = useState('Computer Science')
  const [location, setLocation] = useState('San Diego')
  const [customSearch, setCustomSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Detail panel
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Fetch fields
  useEffect(() => {
    fetch('/api/internships/fields')
      .then(r => r.json())
      .then(d => { if (d.fields) setFields(d.fields) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchJobs = useCallback((field: string, loc: string, query?: string) => {
    setJobsLoading(true)
    setSelectedJob(null)
    setJobDetail(null)
    const params = new URLSearchParams()
    if (query) params.set('query', query)
    else params.set('field', field)
    params.set('location', loc)
    fetch(`/api/internships/search?${params}`)
      .then(r => r.json())
      .then(d => {
        setJobs(d.jobs || [])
        setFieldLabel(d.field_label || field)
      })
      .catch(() => {})
      .finally(() => setJobsLoading(false))
  }, [])

  useEffect(() => {
    if (!customSearch) fetchJobs(selectedField, location)
  }, [selectedField, location])

  const handleFieldClick = (fieldId: string) => {
    setSelectedField(fieldId)
    setCustomSearch('')
    setSearchInput('')
    fetchJobs(fieldId, location)
  }

  const handleSearch = () => {
    const q = searchInput.trim()
    if (!q) return
    setCustomSearch(q)
    setSelectedField('')
    fetchJobs('', location, q + ' intern')
  }

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setJobDetail(null)
    if (!job.url) return
    setDetailLoading(true)
    fetch(`/api/internships/detail?url=${encodeURIComponent(job.url)}`)
      .then(r => r.json())
      .then(d => setJobDetail(d))
      .catch(() => setJobDetail({ description_html: '', description_text: 'Failed to load details', seniority: '', employment_type: '', job_function: '', industries: '', posted: '', applicants: '' }))
      .finally(() => setDetailLoading(false))
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* ════════ LEFT SIDEBAR — Fields ════════ */}
      <div className="w-64 shrink-0 border-r border-border bg-surface/50 flex flex-col overflow-hidden">
        <div className="px-4 pt-5 pb-3">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">Internships</h2>
          <p className="text-[11px] text-dim mt-0.5">{fields.length} fields</p>
        </div>

        {/* Search */}
        <div className="px-3 mb-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search any role..."
                className="w-full bg-card border border-border rounded-xl pl-8 pr-3 py-2 text-[12px] text-text outline-none focus:border-accent/50 placeholder:text-dim" />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <button onClick={handleSearch} disabled={!searchInput.trim()}
              className="px-2.5 py-2 rounded-xl text-[11px] font-bold bg-accent text-white hover:bg-accent/85 disabled:opacity-30 cursor-pointer shrink-0">
              Go
            </button>
          </div>
        </div>

        {/* Location */}
        <div className="px-3 mb-2">
          <select value={location} onChange={e => { setLocation(e.target.value); if (!customSearch) fetchJobs(selectedField, e.target.value) }}
            className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-[11px] text-text outline-none cursor-pointer">
            <option value="San Diego">San Diego, CA</option>
            <option value="Los Angeles">Los Angeles, CA</option>
            <option value="San Francisco">San Francisco, CA</option>
            <option value="Seattle">Seattle, WA</option>
            <option value="New York">New York, NY</option>
            <option value="Austin">Austin, TX</option>
            <option value="Chicago">Chicago, IL</option>
            <option value="Remote">Remote</option>
            <option value="United States">Anywhere (US)</option>
          </select>
        </div>

        {/* Field list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {fields.map(f => {
            const isSelected = selectedField === f.id && !customSearch
            const icon = FIELD_ICONS[f.id] || '\ud83d\udcbc'
            const color = FIELD_COLORS[f.id] || '#4f8ef7'
            return (
              <button key={f.id} onClick={() => handleFieldClick(f.id)}
                className={`w-full text-left px-3 py-2 rounded-xl cursor-pointer transition-all group
                  ${isSelected ? 'bg-card border border-accent/30 shadow-sm' : 'hover:bg-card/60 border border-transparent'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                    style={{ background: isSelected ? `${color}20` : 'transparent' }}>
                    {icon}
                  </span>
                  <span className={`text-[12px] font-medium ${isSelected ? 'text-text' : 'text-muted group-hover:text-text'}`}>
                    {f.label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-border px-4 py-2.5">
          <div className="text-[10px] text-dim">LinkedIn listings &middot; Updated hourly</div>
        </div>
      </div>

      {/* ════════ MAIN — Job List ════════ */}
      <div className={`${selectedJob ? 'w-[400px]' : 'flex-1'} flex flex-col min-w-0 overflow-hidden border-r border-border`}>
        {/* Top bar */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <h1 className="text-[15px] font-bold text-text">
            {customSearch ? `"${customSearch}" Internships` : `${fieldLabel}`}
          </h1>
          <div className="text-[11px] text-muted mt-0.5 flex items-center gap-2">
            <span>{jobs.length} positions</span>
            {jobsLoading && <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
          </div>
        </div>

        {/* Jobs list */}
        <div className="flex-1 overflow-y-auto">
          {jobsLoading && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <span className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin block mx-auto mb-3" />
                <div className="text-sm text-muted">Searching internships...</div>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-3xl mb-3">{'\ud83d\udd0d'}</div>
                <div className="text-sm text-muted">No internships found</div>
                <div className="text-xs text-dim mt-1">Try a different field or location</div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {jobs.map((job, i) => {
                const isActive = selectedJob?.url === job.url && selectedJob?.title === job.title
                return (
                  <button key={`${job.title}-${job.company}-${i}`}
                    onClick={() => handleJobClick(job)}
                    className={`w-full text-left px-5 py-4 cursor-pointer transition-all flex items-center gap-4
                      ${isActive ? 'bg-accent/8 border-l-2 border-l-accent' : 'hover:bg-card/50 border-l-2 border-l-transparent'}`}>
                    {/* Logo */}
                    <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                      {job.logo ? (
                        <img src={job.logo} alt="" className="w-full h-full object-contain p-1" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <span className="text-base text-dim">{'\ud83c\udfe2'}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-semibold truncate ${isActive ? 'text-accent' : 'text-text'}`}>
                        {job.title}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 truncate">{job.company}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {job.location && <span className="text-[10px] text-dim">{job.location}</span>}
                        {job.date && (
                          <>
                            <span className="text-dim text-[8px]">{'\u00b7'}</span>
                            <span className="text-[10px] text-dim">{timeAgo(job.date)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════ RIGHT — Detail Panel ════════ */}
      {selectedJob && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden animate-fade-in">
          {/* Detail header */}
          <div className="px-6 py-5 border-b border-border shrink-0">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                {selectedJob.logo ? (
                  <img src={selectedJob.logo} alt="" className="w-full h-full object-contain p-1.5" loading="lazy" />
                ) : (
                  <span className="text-2xl text-dim">{'\ud83c\udfe2'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-bold text-text leading-snug">{selectedJob.title}</h2>
                <div className="text-[13px] text-muted mt-1">{selectedJob.company}</div>
                <div className="flex items-center gap-2 mt-1 text-[12px] text-dim">
                  {selectedJob.location && <span>{selectedJob.location}</span>}
                  {selectedJob.date && (
                    <>
                      <span>{'\u00b7'}</span>
                      <span>{timeAgo(selectedJob.date)}</span>
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => { setSelectedJob(null); setJobDetail(null) }}
                className="text-dim hover:text-text cursor-pointer text-lg shrink-0 mt-1">&times;</button>
            </div>

            {/* Apply button */}
            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-bold bg-accent text-white hover:bg-accent/85 cursor-pointer transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Apply on LinkedIn
            </a>

            {/* Criteria tags */}
            {jobDetail && !jobDetail.error && (
              <div className="flex flex-wrap gap-2 mt-4">
                {jobDetail.seniority && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-green/10 text-green border border-green/15 font-medium">
                    {jobDetail.seniority}
                  </span>
                )}
                {jobDetail.employment_type && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/10 text-accent border border-accent/15 font-medium">
                    {jobDetail.employment_type}
                  </span>
                )}
                {jobDetail.job_function && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-accent2/10 text-accent2 border border-accent2/15 font-medium">
                    {jobDetail.job_function}
                  </span>
                )}
                {jobDetail.industries && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/15 font-medium">
                    {jobDetail.industries}
                  </span>
                )}
                {jobDetail.posted && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-surface text-muted border border-border font-medium">
                    Posted {jobDetail.posted}
                  </span>
                )}
                {jobDetail.applicants && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-surface text-muted border border-border font-medium">
                    {jobDetail.applicants}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin block mx-auto mb-2" />
                  <div className="text-[12px] text-muted">Loading details...</div>
                </div>
              </div>
            ) : jobDetail?.error ? (
              <div className="text-center py-12">
                <div className="text-sm text-muted">Couldn't load full details</div>
                <a href={selectedJob.url} target="_blank" rel="noopener noreferrer"
                  className="text-[12px] text-accent hover:underline mt-2 inline-block">View on LinkedIn instead</a>
              </div>
            ) : jobDetail?.description_html ? (
              <div className="prose-internship text-[13px] text-muted leading-relaxed"
                dangerouslySetInnerHTML={{ __html: jobDetail.description_html }} />
            ) : jobDetail?.description_text ? (
              <div className="text-[13px] text-muted leading-relaxed whitespace-pre-wrap">
                {jobDetail.description_text}
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-dim">
                Click a job to see full details
              </div>
            )}
          </div>

          {/* Bottom apply bar */}
          {jobDetail && !jobDetail.error && (
            <div className="px-6 py-3 border-t border-border shrink-0">
              <a href={selectedJob.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold bg-green text-white hover:bg-green/85 cursor-pointer transition-all">
                Apply Now
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
