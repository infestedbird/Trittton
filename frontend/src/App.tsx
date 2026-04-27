import { useEffect, useRef, useState, useCallback } from 'react'
import { Header } from './components/Header'
import type { ViewType } from './components/Header'
import { SideNav } from './components/SideNav'
import { Sidebar } from './components/Sidebar'
import { FilterBar } from './components/FilterBar'
import type { ScrapeProgress } from './types'
import { CourseList } from './components/CourseList'
import { ScrapePanel } from './components/ScrapePanel'
import { ChatPanel } from './components/ChatPanel'
import { MySchedule } from './components/MySchedule'
import { CompletedCourses } from './components/CompletedCourses'
import { GradProgress } from './components/GradProgress'
import { useCourseData } from './hooks/useCourseData'
import { useFilters } from './hooks/useFilters'
import { useScraper } from './hooks/useScraper'
import { useChat } from './hooks/useChat'
import { useMySchedule } from './hooks/useMySchedule'
import { useCompletedCourses } from './hooks/useCompletedCourses'
import { setCurrentTerm, setTermOptions, TERM_OPTIONS } from './lib/links'
import { useRmpRatings } from './hooks/useRmpRatings'
import { useFourYearPlan } from './hooks/useFourYearPlan'
import { FourYearPlan } from './components/FourYearPlan'
import { LiveStatus } from './components/LiveStatus'
import { AutoScheduler } from './components/AutoScheduler'
import { EventsCalendar } from './components/EventsCalendar'
import { Councillor } from './components/Councillor'
import { LoginPage } from './components/LoginPage'
import { ApiKeyOverlay } from './components/ApiKeyOverlay'
import { useGoogleAuth, getGeminiKey, setGeminiKey } from './hooks/useGoogleAuth'
import { useSeatWatch } from './hooks/useSeatWatch'
import { WatchList } from './components/WatchList'
import { Dining } from './components/Dining'
import { RoomFinder } from './components/RoomFinder'
import { Transit } from './components/Transit'
import { Internships } from './components/Internships'
import { Textbooks } from './components/Textbooks'
import { Parking } from './components/Parking'
import { useTheme } from './components/ThemeToggle'

export default function App() {
  const { user, loading, signIn, logOut } = useGoogleAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [geminiKey, setGeminiKeyState] = useState<string | null>(null)
  const [showKeyOverlay, setShowKeyOverlay] = useState(false)

  // Sync gemini key state when user changes (don't auto-show overlay — only on AI use)
  useEffect(() => {
    if (user) {
      const stored = getGeminiKey(user.uid)
      setGeminiKeyState(stored)
    } else {
      setGeminiKeyState(null)
      setShowKeyOverlay(false)
    }
  }, [user])

  const handleSaveKey = (key: string) => {
    if (!user) return
    setGeminiKey(user.uid, key)
    setGeminiKeyState(key)
    setShowKeyOverlay(false)
  }

  const handleRequestKey = useCallback(() => {
    setShowKeyOverlay(true)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage onGoogleSignIn={signIn} />
  }

  return (
    <>
      {showKeyOverlay && <ApiKeyOverlay onSubmit={handleSaveKey} />}
      <AuthenticatedApp
        onLogout={logOut}
        geminiKey={geminiKey}
        onRequestKey={handleRequestKey}
        userDisplayName={user.displayName}
        userPhotoURL={user.photoURL}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </>
  )
}

function AuthenticatedApp({
  onLogout,
  geminiKey,
  onRequestKey,
  userDisplayName,
  userPhotoURL,
  theme,
  onToggleTheme,
}: {
  onLogout: () => void
  geminiKey: string | null
  onRequestKey: () => void
  userDisplayName: string | null
  userPhotoURL: string | null
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const { courses, isLoaded, error, autoLoad, loadFromData } =
    useCourseData()
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
  const [model, setModel] = useState(() => localStorage.getItem('ucsd-ai-model') || 'sonnet')
  const [term, setTerm] = useState(() => localStorage.getItem('ucsd-term') || 'SP26')

  const handleScrapeComplete = async () => {
    try {
      const res = await fetch('/api/courses')
      const data = await res.json()
      if (Array.isArray(data)) loadFromData(data)
      setShowPanel(false)
    } catch { /* */ }
  }

  const { progress, showPanel, setShowPanel, startScrape } = useScraper(handleScrapeComplete)
  const { messages, isStreaming, thinkingPhase, error: chatError, sendMessage, clearChat } = useChat()
  const mySchedule = useMySchedule(term)
  const completedCourses = useCompletedCourses()
  const { getRating } = useRmpRatings(courses)
  const fourYearPlan = useFourYearPlan()
  const seatWatch = useSeatWatch(term)

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
    // Always scrape when term changes — server data is term-specific
    startScrape(newTerm)
  }

  const didAutoLoad = useRef(false)
  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    autoLoad().then((loaded) => {
      if (!loaded) {
        // No existing data — auto-scrape for new users
        startScrape(term)
      }
    })
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

  // Wrap sendMessage to inject gemini key
  const handleChatSend = useCallback((text: string) => {
    if (model === 'gemini' && !geminiKey) {
      onRequestKey()
      return
    }
    sendMessage(text, model, term, completedContext, geminiKey)
  }, [model, geminiKey, onRequestKey, sendMessage, term, completedContext])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidenav-collapsed') === '1')
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidenav-collapsed', prev ? '0' : '1')
      return !prev
    })
  }, [])

  const renderContent = () => {
    if (activeView === 'councillor')
      return <Councillor model={model} onModelChange={setModel} geminiKey={geminiKey} onRequestKey={onRequestKey} />
    if (activeView === 'ai' && isLoaded)
      return <ChatPanel messages={messages} isStreaming={isStreaming} thinkingPhase={thinkingPhase} error={chatError}
        onSend={handleChatSend} onClear={clearChat} onAddToSchedule={mySchedule.addFromProposal}
        onAddCourseStub={(code) => { setActiveView('browse'); setSearch(code) }} model={model} onModelChange={setModel} />
    if (activeView === 'schedule' && isLoaded)
      return <MySchedule schedule={mySchedule.schedule} proposal={mySchedule.asProposal} term={term}
        onRemove={mySchedule.removeCourse} onRemoveSection={mySchedule.removeSection} onClear={mySchedule.clearSchedule} />
    if (activeView === 'planner')
      return <FourYearPlan plan={fourYearPlan.plan} allCourses={courses} onAddCourse={fourYearPlan.addCourse}
        onRemoveCourse={(quarter, courseCode) => {
          fourYearPlan.removeCourse(quarter, courseCode)
          // Also remove from My Schedule if it's in the current term's schedule
          if (quarter === term) mySchedule.removeCourse(courseCode)
        }} onClearQuarter={(quarter) => {
          // Get courses before clearing so we can remove them from schedule
          const q = fourYearPlan.plan.find(p => p.quarter === quarter)
          fourYearPlan.clearQuarter(quarter)
          if (quarter === term && q) {
            for (const c of q.courses) mySchedule.removeCourse(c.course_code)
          }
        }}
        onClearAll={() => {
          // Remove current term's planned courses from schedule
          const currentQ = fourYearPlan.plan.find(p => p.quarter === term)
          fourYearPlan.clearAll()
          if (currentQ) {
            for (const c of currentQ.courses) mySchedule.removeCourse(c.course_code)
          }
        }} totalUnits={fourYearPlan.totalUnits} />
    if (activeView === 'live') return <LiveStatus />
    if (activeView === 'scheduler')
      return <AutoScheduler model={model} onModelChange={setModel} geminiKey={geminiKey} onRequestKey={onRequestKey} />
    if (activeView === 'events') return <EventsCalendar />
    if (activeView === 'rooms') return <RoomFinder />
    if (activeView === 'transit') return <Transit />
    if (activeView === 'internships') return <Internships />
    if (activeView === 'textbooks') return <Textbooks />
    if (activeView === 'parking') return <Parking />
    if (activeView === 'dining')
      return <Dining model={model} onModelChange={setModel} geminiKey={geminiKey} onRequestKey={onRequestKey} />
    if (activeView === 'watching')
      return <WatchList watches={seatWatch.watches} alerts={seatWatch.alerts} onUnwatch={seatWatch.removeWatch}
        onDismissAlert={seatWatch.dismissAlert} notifPermission={seatWatch.notifPermission} onRequestNotifications={seatWatch.requestNotifications}
        courses={courses} getRating={getRating} onAddToSchedule={mySchedule.addCourse} hasCourse={mySchedule.hasCourse}
        hasSection={mySchedule.hasSection} hasCompleted={completedCourses.hasCompleted}
        isWatching={seatWatch.isWatching} onWatch={seatWatch.addWatch} />
    if (activeView === 'progress' && isLoaded)
      return <GradProgress completedCodes={completedCourses.completed.map((c) => c.course_code)} />
    if (activeView === 'completed' && isLoaded)
      return <CompletedCourses completed={completedCourses.completed} allCourses={courses}
        onAdd={completedCourses.addCourse} onRemove={completedCourses.removeCourse} onClear={completedCourses.clearAll} />

    // Browse view (default)
    if (!isLoaded) return <ScrapeLoadingScreen progress={progress} error={error} onRetry={() => startScrape(term)} />
    return (
      <div className="h-[calc(100vh-64px)] flex">
        <Sidebar departments={departments} activeDept={filters.department} totalCourses={courses.length} onDeptClick={setDepartment} />
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <FilterBar search={filters.search} sectionType={filters.sectionType} availability={filters.availability}
            resultCount={filtered.length} onSearchChange={setSearch} onTypeChange={setSectionType} onAvailChange={setAvailability} />
          <div className="mt-4">
            <CourseList courses={filtered} onAddToSchedule={mySchedule.addCourse} hasCourse={mySchedule.hasCourse}
              hasSection={mySchedule.hasSection} hasCompleted={completedCourses.hasCompleted} getRating={getRating}
              isWatching={seatWatch.isWatching} onWatch={seatWatch.addWatch} onUnwatch={seatWatch.removeWatch} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-bg">
      <Header
        onScrapeClick={handleScrapeClick}
        scrapeRunning={progress.status === 'running'}
        term={term}
        onTermChange={handleTermChange}
        termOptions={termOptions}
        onLogout={onLogout}
        userDisplayName={userDisplayName}
        userPhotoURL={userPhotoURL}
        onToggleSidebar={toggleSidebar}
        theme={theme}
        onToggleTheme={onToggleTheme}
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
        />
        <main className="flex-1 min-w-0 overflow-hidden">
          {renderContent()}
        </main>
      </div>

      <ScrapePanel
        progress={progress}
        show={showPanel}
        onClose={() => setShowPanel(false)}
        onLoadResults={handleScrapeComplete}
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

          <h2 className="text-lg font-medium">Scraping UCSD Courses...</h2>
          <p className="text-[13px] text-muted">Fetching live data from TritonLink. This takes a few minutes.</p>

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
          Retry Scrape
        </button>
      </div>
    </div>
  )
}
