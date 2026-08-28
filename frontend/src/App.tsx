import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { Header } from './components/Header'
import type { ViewType } from './components/Header'
import { SideNav } from './components/SideNav'
import { Sidebar } from './components/Sidebar'
import { FilterBar } from './components/FilterBar'
import type { ScrapeProgress } from './types'
import { CourseList } from './components/CourseList'
import { ScrapePanel } from './components/ScrapePanel'
// Browse is the default view — its components stay eagerly imported.
// Everything below is loaded on demand to keep the initial bundle small.
const ChatPanel = lazy(() => import('./components/ChatPanel').then((m) => ({ default: m.ChatPanel })))
const MySchedule = lazy(() => import('./components/MySchedule').then((m) => ({ default: m.MySchedule })))
const CompletedCourses = lazy(() => import('./components/CompletedCourses').then((m) => ({ default: m.CompletedCourses })))
import { useCourseData } from './hooks/useCourseData'
import { useFilters } from './hooks/useFilters'
import { useClientScraper } from './hooks/useClientScraper'
import { useChat } from './hooks/useChat'
import { useMySchedule } from './hooks/useMySchedule'
import { useCompletedCourses } from './hooks/useCompletedCourses'
import { setCurrentTerm, setTermOptions, TERM_OPTIONS } from './lib/links'
import { useRmpRatings } from './hooks/useRmpRatings'
import { useFourYearPlan } from './hooks/useFourYearPlan'
const FourYearPlan = lazy(() => import('./components/FourYearPlan').then((m) => ({ default: m.FourYearPlan })))
const LiveStatus = lazy(() => import('./components/LiveStatus').then((m) => ({ default: m.LiveStatus })))
const AutoScheduler = lazy(() => import('./components/AutoScheduler').then((m) => ({ default: m.AutoScheduler })))
const EventsCalendar = lazy(() => import('./components/EventsCalendar').then((m) => ({ default: m.EventsCalendar })))
const EnrollmentCenter = lazy(() => import('./components/EnrollmentCenter').then((m) => ({ default: m.EnrollmentCenter })))
const CampusHub = lazy(() => import('./components/CampusHub').then((m) => ({ default: m.CampusHub })))
import { LoginPage } from './components/LoginPage'
import { ApiKeyOverlay, type ApiKeyKind } from './components/ApiKeyOverlay'
import { useGoogleAuth, getGeminiKey, setGeminiKey, getAnthropicKey, setAnthropicKey } from './hooks/useGoogleAuth'
import { useSeatWatch } from './hooks/useSeatWatch'
const WatchList = lazy(() => import('./components/WatchList').then((m) => ({ default: m.WatchList })))
const Dining = lazy(() => import('./components/Dining').then((m) => ({ default: m.Dining })))
const RoomFinder = lazy(() => import('./components/RoomFinder').then((m) => ({ default: m.RoomFinder })))
const Internships = lazy(() => import('./components/Internships').then((m) => ({ default: m.Internships })))
const PrereqChains = lazy(() => import('./components/PrereqChains').then((m) => ({ default: m.PrereqChains })))
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider, useToast } from './components/Toast'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { useTheme } from './components/ThemeToggle'

function ViewLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin block" />
    </div>
  )
}

export default function App() {
  const { user, loading, signIn, logOut, authError } = useGoogleAuth()
  const [localPreview, setLocalPreview] = useState(false)
  const previewUser = import.meta.env.DEV && localPreview
    ? { uid: '', displayName: 'Local Tester', photoURL: null }
    : null
  const activeUser = user || previewUser
  const { theme, toggle: toggleTheme } = useTheme()
  const [geminiKey, setGeminiKeyState] = useState<string | null>(null)
  const [anthropicKey, setAnthropicKeyState] = useState<string | null>(null)
  // When non-null, the API-key overlay is shown asking for that provider's key.
  const [keyOverlayKind, setKeyOverlayKind] = useState<ApiKeyKind | null>(null)

  // Sync stored API keys when user changes (don't auto-show overlay — only on AI use)
  useEffect(() => {
    if (user) {
      setGeminiKeyState(getGeminiKey(user.uid))
      setAnthropicKeyState(getAnthropicKey(user.uid))
    } else {
      setGeminiKeyState(null)
      setAnthropicKeyState(null)
      setKeyOverlayKind(null)
    }
  }, [user])

  const handleSaveKey = (key: string) => {
    if (!user || !keyOverlayKind) return
    if (keyOverlayKind === 'gemini') {
      setGeminiKey(user.uid, key)
      setGeminiKeyState(key)
    } else {
      setAnthropicKey(user.uid, key)
      setAnthropicKeyState(key)
    }
    setKeyOverlayKind(null)
  }

  const handleRequestKey = useCallback((kind: ApiKeyKind = 'gemini') => {
    setKeyOverlayKind(kind)
  }, [])

  if (loading && !previewUser) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!activeUser) {
    return (
      <LoginPage
        onGoogleSignIn={signIn}
        onLocalPreview={import.meta.env.DEV ? () => setLocalPreview(true) : undefined}
        authError={authError}
      />
    )
  }

  return (
    <ToastProvider>
      <PwaUpdatePrompt />
      {keyOverlayKind && (
        <ApiKeyOverlay
          kind={keyOverlayKind}
          onSubmit={handleSaveKey}
          onCancel={() => setKeyOverlayKind(null)}
        />
      )}
      <AuthenticatedApp
        onLogout={previewUser ? () => setLocalPreview(false) : logOut}
        geminiKey={geminiKey}
        anthropicKey={anthropicKey}
        onRequestKey={handleRequestKey}
        uid={activeUser.uid}
        userDisplayName={activeUser.displayName}
        userPhotoURL={activeUser.photoURL}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </ToastProvider>
  )
}

function AuthenticatedApp({
  onLogout,
  geminiKey,
  anthropicKey,
  onRequestKey,
  uid,
  userDisplayName,
  userPhotoURL,
  theme,
  onToggleTheme,
}: {
  onLogout: () => void
  geminiKey: string | null
  anthropicKey: string | null
  onRequestKey: (kind?: ApiKeyKind) => void
  uid: string
  userDisplayName: string | null
  userPhotoURL: string | null
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const [term, setTerm] = useState(() => localStorage.getItem('ucsd-term') || 'FA26')
  const { courses, isLoaded, error, autoLoad, loadFromData } =
    useCourseData(term)
  const {
    filters,
    filtered,
    departments,
    setSearch,
    setDepartment,
    setSectionType,
    setAvailability,
  } = useFilters(courses)

  const [activeView, setActiveView] = useState<ViewType>('browse')
  const [aiWorkspace, setAiWorkspace] = useState<'courses' | 'week'>('courses')
  const [model, setModel] = useState(() => localStorage.getItem('ucsd-ai-model') || 'sonnet')

  const handleScrapeComplete = useCallback((courses: import('./types').Course[]) => {
    loadFromData(courses)
  }, [loadFromData])

  const { progress, showPanel, setShowPanel, startScrape } = useClientScraper(handleScrapeComplete)
  const { messages, isStreaming, thinkingPhase, error: chatError, sendMessage, clearChat, restoreChat } = useChat()
  const { showToast } = useToast()
  const mySchedule = useMySchedule(term, uid)
  const refreshScheduleAvailability = mySchedule.refreshAvailability
  const completedCourses = useCompletedCourses(uid)
  // Ratings are secondary data. Limit the hook to the current result set so a
  // full FA26 load does not queue lookups for every instructor in the catalog.
  const { getRating } = useRmpRatings(filtered)
  const fourYearPlan = useFourYearPlan(uid)

  // Coalesce the three sync statuses into one header indicator.
  // Priority: error > syncing > loading > synced > offline > idle.
  const cloudStatus = (() => {
    const all = [mySchedule.cloudStatus, completedCourses.cloudStatus, fourYearPlan.cloudStatus]
    if (all.includes('error')) return 'error'
    if (all.includes('syncing')) return 'syncing'
    if (all.includes('loading')) return 'loading'
    if (all.every((s) => s === 'synced')) return 'synced'
    if (all.includes('offline')) return 'offline'
    return 'idle'
  })()
  const seatWatch = useSeatWatch(term, uid)

  useEffect(() => {
    if (isLoaded) refreshScheduleAvailability(courses)
  }, [courses, isLoaded, refreshScheduleAvailability])

  const [termOptions, setTermOpts] = useState(TERM_OPTIONS)

  // Fetch available terms from UCSD, poll every 10 min
  useEffect(() => {
    const fetchTerms = () => {
      fetch('/api/terms')
        .then((r) => r.json())
        .then((data) => {
          if (data.terms?.length) {
            setTermOptions(data.terms)
            setTermOpts(data.terms)
          }
        })
        .catch(() => {})
    }
    fetchTerms()
    const interval = setInterval(fetchTerms, 600_000) // 10 minutes
    return () => clearInterval(interval)
  }, [])

  // Auto-sync: courses in My Schedule → 4-Year Plan for the current term
  useEffect(() => {
    if (mySchedule.schedule.length === 0) return
    const currentQuarter = fourYearPlan.plan.find((q) => q.quarter === term)
    if (!currentQuarter) return
    for (const course of mySchedule.schedule) {
      if (!currentQuarter.courses.some((c) => c.course_code === course.course_code)) {
        fourYearPlan.addCourse(term, {
          course_code: course.course_code,
          title: course.title,
          units: course.units,
        })
      }
    }
  }, [mySchedule.schedule, term]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('ucsd-ai-model', model)
  }, [model])

  useEffect(() => {
    localStorage.setItem('ucsd-term', term)
    setCurrentTerm(term)
  }, [term])

  const handleTermChange = (newTerm: string) => {
    setTerm(newTerm)
  }

  useEffect(() => {
    let cancelled = false
    autoLoad().then((loaded) => {
      if (!loaded && !cancelled) {
        startScrape(term)
      }
    })
    return () => { cancelled = true }
  }, [autoLoad, startScrape, term])

  const handleScrapeClick = () => {
    if (progress.status === 'running') {
      setShowPanel(true)
    } else {
      startScrape(term)
    }
  }

  // Build completed courses context for AI
  const completedContext = completedCourses.asContextString()

  // Wrap sendMessage to inject the right per-user API key based on model.
  // Gemini → Gemini key; everything else (sonnet/opus/haiku) → Anthropic key.
  const handleChatSend = useCallback((text: string) => {
    if (model === 'gemini') {
      if (!geminiKey) { onRequestKey('gemini'); return }
      sendMessage(text, model, term, completedContext, geminiKey, null, uid)
      return
    }
    if (!anthropicKey) { onRequestKey('anthropic'); return }
    sendMessage(text, model, term, completedContext, null, anthropicKey, uid)
  }, [model, geminiKey, anthropicKey, onRequestKey, sendMessage, term, completedContext, uid])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidenav-collapsed') === '1')
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidenav-collapsed', prev ? '0' : '1')
      return !prev
    })
  }, [])

  // Separate state for the mobile drawer — the desktop collapse toggle doesn't make sense on phone.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileDeptOpen, setMobileDeptOpen] = useState(false)
  const closeMobileDept = useCallback(() => setMobileDeptOpen(false), [])
  const handleHeaderHamburger = useCallback(() => {
    // On phones: open the mobile drawer. On larger screens: toggle the desktop collapse.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileNavOpen((prev) => !prev)
    } else {
      toggleSidebar()
    }
  }, [toggleSidebar])
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  // Destructive actions with undo — snapshot state, run, then offer Undo.
  const handleClearChat = useCallback(() => {
    if (messages.length === 0) { clearChat(); return }
    const snapshot = messages
    clearChat()
    showToast({
      message: `Cleared ${snapshot.length} chat message${snapshot.length === 1 ? '' : 's'}`,
      undo: () => restoreChat(snapshot),
    })
  }, [messages, clearChat, restoreChat, showToast])

  const handleClearSchedule = useCallback(() => {
    const snapshot = mySchedule.schedule
    if (snapshot.length === 0) { mySchedule.clearSchedule(); return }
    mySchedule.clearSchedule()
    showToast({
      message: `Cleared ${snapshot.length} course${snapshot.length === 1 ? '' : 's'} from My Schedule`,
      undo: () => mySchedule.restoreSchedule(snapshot),
    })
  }, [mySchedule, showToast])

  const handleClearCompleted = useCallback(() => {
    const snapshot = completedCourses.completed
    if (snapshot.length === 0) { completedCourses.clearAll(); return }
    completedCourses.clearAll()
    showToast({
      message: `Cleared ${snapshot.length} completed course${snapshot.length === 1 ? '' : 's'}`,
      undo: () => completedCourses.restoreAll(snapshot),
    })
  }, [completedCourses, showToast])

  const handleClearQuarter = useCallback((quarter: string) => {
    const snapshot = fourYearPlan.plan
    const q = snapshot.find((p) => p.quarter === quarter)
    fourYearPlan.clearQuarter(quarter)
    if (quarter === term && q) {
      for (const c of q.courses) mySchedule.removeCourse(c.course_code)
    }
    if (q && q.courses.length > 0) {
      const myScheduleSnapshot = mySchedule.schedule
      showToast({
        message: `Cleared ${q.courses.length} course${q.courses.length === 1 ? '' : 's'} from ${q.label}`,
        undo: () => {
          fourYearPlan.restorePlan(snapshot)
          if (quarter === term) mySchedule.restoreSchedule(myScheduleSnapshot)
        },
      })
    }
  }, [fourYearPlan, mySchedule, term, showToast])

  const handleClearAllPlan = useCallback(() => {
    const planSnapshot = fourYearPlan.plan
    const myScheduleSnapshot = mySchedule.schedule
    const currentQ = planSnapshot.find((p) => p.quarter === term)
    const totalCourses = planSnapshot.reduce((sum, p) => sum + p.courses.length, 0)
    fourYearPlan.clearAll()
    if (currentQ) {
      for (const c of currentQ.courses) mySchedule.removeCourse(c.course_code)
    }
    if (totalCourses > 0) {
      showToast({
        message: `Cleared 4-year plan (${totalCourses} courses)`,
        undo: () => {
          fourYearPlan.restorePlan(planSnapshot)
          mySchedule.restoreSchedule(myScheduleSnapshot)
        },
      })
    }
  }, [fourYearPlan, mySchedule, term, showToast])

  const renderContent = () => {
    if (activeView === 'ai' && isLoaded)
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-border bg-surface/55 px-4 py-3 sm:px-7">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-bold text-text">AI Planner</div>
                <div className="text-[10px] text-muted">Course planning and weekly workload in one workspace</div>
              </div>
              <div className="flex rounded-xl border border-border bg-card/70 p-1">
                <button onClick={() => setAiWorkspace('courses')} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${aiWorkspace === 'courses' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-text'}`}>Course plan</button>
                <button onClick={() => setAiWorkspace('week')} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${aiWorkspace === 'week' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-text'}`}>Weekly scheduler</button>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {aiWorkspace === 'courses' ? (
              <ChatPanel messages={messages} isStreaming={isStreaming} thinkingPhase={thinkingPhase} error={chatError}
                onSend={handleChatSend} onClear={handleClearChat} onAddToSchedule={mySchedule.addFromProposal}
                onAddCourseStub={(code) => { setActiveView('browse'); setSearch(code) }} model={model} onModelChange={setModel} />
            ) : (
              <AutoScheduler model={model} onModelChange={setModel} geminiKey={geminiKey} anthropicKey={anthropicKey} onRequestKey={onRequestKey} uid={uid} />
            )}
          </div>
        </div>
      )
    if (activeView === 'schedule' && isLoaded)
      return <MySchedule schedule={mySchedule.schedule} proposal={mySchedule.asProposal} term={term}
        onRemove={mySchedule.removeCourse} onRemoveSection={mySchedule.removeSection} onClear={handleClearSchedule}
        termOptions={termOptions} onTermChange={setTerm} allSchedules={mySchedule.allSchedules} uid={uid} />
    if (activeView === 'planner')
      return <FourYearPlan plan={fourYearPlan.plan} allCourses={courses} onAddCourse={fourYearPlan.addCourse}
        onRemoveCourse={(quarter, courseCode) => {
          fourYearPlan.removeCourse(quarter, courseCode)
          if (quarter === term) mySchedule.removeCourse(courseCode)
        }}
        onClearQuarter={handleClearQuarter}
        onClearAll={handleClearAllPlan}
        totalUnits={fourYearPlan.totalUnits} />
    if (activeView === 'enrollment')
      return <EnrollmentCenter term={term} schedule={mySchedule.schedule} proposal={mySchedule.asProposal} allCourses={courses}
        completedCodes={completedCourses.completed.map((course) => course.course_code)}
        onBrowse={() => setActiveView('browse')} />
    if (activeView === 'campus') return <CampusHub onOpen={setActiveView} />
    if (activeView === 'live') return <LiveStatus />
    if (activeView === 'scheduler')
      return <AutoScheduler model={model} onModelChange={setModel} geminiKey={geminiKey} anthropicKey={anthropicKey} onRequestKey={onRequestKey} uid={uid} />
    if (activeView === 'events') return <EventsCalendar />
    if (activeView === 'rooms') return <RoomFinder />
    if (activeView === 'internships') return <Internships />
    if (activeView === 'prereqs')
      return <PrereqChains completedCodes={completedCourses.completed.map((c) => c.course_code)} />
    if (activeView === 'dining')
      return <Dining model={model} onModelChange={setModel} geminiKey={geminiKey} onRequestKey={onRequestKey} />
    if (activeView === 'watching')
      return <WatchList watches={seatWatch.watches} alerts={seatWatch.alerts} onUnwatch={seatWatch.removeWatch}
        onDismissAlert={seatWatch.dismissAlert} notifPermission={seatWatch.notifPermission} onRequestNotifications={seatWatch.requestNotifications}
        courses={courses} getRating={getRating} onAddToSchedule={mySchedule.addCourse} hasCourse={mySchedule.hasCourse}
        hasSection={mySchedule.hasSection} hasCompleted={completedCourses.hasCompleted}
        isWatching={seatWatch.isWatching} onWatch={seatWatch.addWatch} />
    if (activeView === 'completed' && isLoaded)
      return <CompletedCourses completed={completedCourses.completed} allCourses={courses}
        onAdd={completedCourses.addCourse} onRemove={completedCourses.removeCourse} onClear={handleClearCompleted}
        completedCodes={completedCourses.completed.map((c) => c.course_code)} />

    // Browse view (default)
    if (!isLoaded) return <ScrapeLoadingScreen progress={progress} error={error} onRetry={() => startScrape(term)} />
    return (
      <div className="h-full flex min-h-0">
        <Sidebar
          departments={departments}
          activeDept={filters.department}
          totalCourses={courses.length}
          onDeptClick={setDepartment}
          mobileOpen={mobileDeptOpen}
          onMobileClose={closeMobileDept}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 px-4 pt-5 sm:px-7 sm:pt-7 lg:px-9">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                  Live TSS catalog
                </div>
                <h1 className="text-2xl font-bold tracking-[-0.025em] text-text sm:text-[28px]">Find your next course</h1>
                <p className="mt-1.5 text-[13px] text-muted">Compare sections, watch seats, build your plan, and jump directly into TSS.</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span className="rounded-lg border border-border bg-card/70 px-2.5 py-1.5"><b className="text-text">{courses.length.toLocaleString()}</b> courses</span>
                <span className="rounded-lg border border-border bg-card/70 px-2.5 py-1.5"><b className="text-text">{departments.length}</b> departments</span>
              </div>
            </div>

            {/* Mobile-only: open the dept drawer */}
            <button
              onClick={() => setMobileDeptOpen(true)}
              className="md:hidden mb-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-[12px] text-text hover:border-border2 cursor-pointer"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              Departments
              {filters.department && filters.department !== 'ALL' && (
                <span className="text-[11px] text-accent font-semibold">· {filters.department}</span>
              )}
            </button>
            <FilterBar search={filters.search} sectionType={filters.sectionType} availability={filters.availability}
              resultCount={filtered.length} onSearchChange={setSearch} onTypeChange={setSectionType} onAvailChange={setAvailability} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-7 lg:px-9">
            <CourseList courses={filtered} onAddToSchedule={mySchedule.addCourse} hasCourse={mySchedule.hasCourse}
              hasSection={mySchedule.hasSection} hasCompleted={completedCourses.hasCompleted} getRating={getRating}
              isWatching={seatWatch.isWatching} onWatch={seatWatch.addWatch} onUnwatch={seatWatch.removeWatch} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-bg/80">
      <Header
        onScrapeClick={handleScrapeClick}
        scrapeRunning={progress.status === 'running'}
        term={term}
        onTermChange={handleTermChange}
        termOptions={termOptions}
        onLogout={onLogout}
        userDisplayName={userDisplayName}
        userPhotoURL={userPhotoURL}
        onToggleSidebar={handleHeaderHamburger}
        theme={theme}
        onToggleTheme={onToggleTheme}
        cloudStatus={cloudStatus}
      />

      <div className="flex flex-1 min-h-0">
        <SideNav
          activeView={activeView}
          onViewChange={setActiveView}
          scheduleCount={mySchedule.schedule.length}
          completedCount={completedCourses.completed.length}
          watchCount={seatWatch.watchCount}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          mobileOpen={mobileNavOpen}
          onMobileClose={closeMobileNav}
        />
        <main className="flex-1 min-w-0 overflow-hidden">
          <ErrorBoundary resetKey={activeView} label={activeView}>
            <Suspense fallback={<ViewLoader />}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <ScrapePanel
        progress={progress}
        show={showPanel}
        onClose={() => setShowPanel(false)}
        onLoadResults={async () => {
          try {
            const res = await fetch(`/api/courses?term=${encodeURIComponent(term)}`)
            const data = await res.json()
            if (Array.isArray(data)) loadFromData(data)
            setShowPanel(false)
          } catch { /* */ }
        }}
      />
    </div>
  )
}

function ScrapeLoadingScreen({ progress, error, onRetry }: { progress: ScrapeProgress; error: string | null; onRetry: () => void }) {
  const isScraping = progress.status === 'running'
  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  if (isScraping) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <div className="rounded-2xl p-12 px-8 text-center flex flex-col items-center gap-5 w-full max-w-lg">
          <div className="w-14 h-14 rounded-[14px] bg-accent/12 flex items-center justify-center">
            <span className="w-6 h-6 border-[2.5px] border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>

          <h2 className="text-lg font-medium">Refreshing UCSD Courses...</h2>
          <p className="text-[13px] text-muted">Fetching TSS-era course, seat, and waitlist data from UCSD.</p>

          <div className="w-full max-w-xs">
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 font-mono text-[11px] text-muted">
              <span>{progress.current}/{progress.total} departments</span>
              <span className="text-green">{progress.coursesFound} courses</span>
            </div>
          </div>

          {progress.currentSubject && (
            <div className="font-mono text-[12px] text-muted">
              Currently: <span className="text-accent">{progress.currentSubject}</span>
            </div>
          )}

          {progress.errors.length > 0 && (
            <div className="font-mono text-[11px] text-red">
              {progress.errors.length} error{progress.errors.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Error or failed state
  return (
    <div className="flex items-center justify-center h-full animate-fade-in">
      <div className="rounded-2xl p-12 px-8 text-center flex flex-col items-center gap-5 w-full max-w-lg">
        <div className="w-14 h-14 rounded-[14px] bg-red/12 flex items-center justify-center">
          <svg width="24" height="24" fill="none" stroke="#f25f5c" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h2 className="text-lg font-medium">Couldn't load course data</h2>
        <p className="text-[13px] text-muted leading-relaxed max-w-sm">
          {error || 'Make sure the backend server is running, then try again.'}
        </p>

        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-lg text-[13px] font-medium
            bg-accent text-white hover:bg-accent/90
            transition-all duration-150 cursor-pointer"
        >
          Retry Refresh
        </button>
      </div>
    </div>
  )
}
