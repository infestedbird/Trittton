import { useEffect, useRef, useState } from 'react'
import { Header } from './components/Header'
import type { ViewType } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { UploadZone } from './components/UploadZone'
import { FilterBar } from './components/FilterBar'
import { CourseList } from './components/CourseList'
import { ScrapePanel } from './components/ScrapePanel'
import { ChatPanel } from './components/ChatPanel'
import { MySchedule } from './components/MySchedule'
import { CompletedCourses } from './components/CompletedCourses'
import { GradProgress } from './components/GradProgress'
import { Layout } from './components/Layout'
import { useCourseData } from './hooks/useCourseData'
import { useFilters } from './hooks/useFilters'
import { useScraper } from './hooks/useScraper'
import { useChat } from './hooks/useChat'
import { useMySchedule } from './hooks/useMySchedule'
import { useCompletedCourses } from './hooks/useCompletedCourses'
import { setCurrentTerm } from './lib/links'
import { useRmpRatings } from './hooks/useRmpRatings'

export default function App() {
  const { courses, isLoaded, isLoading, error, loadFromFile, loadFromServer, autoLoad, loadFromData } =
    useCourseData()
  const {
    filters,
    filtered,
    departments,
    stats,
    setSearch,
    setDepartment,
    setSectionType,
    setAvailability,
  } = useFilters(courses)

  const handleScrapeComplete = async () => {
    try {
      const res = await fetch('/api/courses')
      const data = await res.json()
      if (Array.isArray(data)) loadFromData(data)
    } catch { /* */ }
  }

  const { progress, showPanel, setShowPanel, startScrape } = useScraper(handleScrapeComplete)
  const { messages, isStreaming, thinkingPhase, error: chatError, sendMessage, clearChat } = useChat()
  const mySchedule = useMySchedule()
  const completedCourses = useCompletedCourses()
  const { getRating } = useRmpRatings(courses)
  const [activeView, setActiveView] = useState<ViewType>('browse')
  const [model, setModel] = useState(() => localStorage.getItem('ucsd-ai-model') || 'sonnet')
  const [term, setTerm] = useState(() => localStorage.getItem('ucsd-term') || 'SP26')

  useEffect(() => {
    localStorage.setItem('ucsd-ai-model', model)
  }, [model])

  useEffect(() => {
    localStorage.setItem('ucsd-term', term)
    setCurrentTerm(term)
  }, [term])

  const handleTermChange = (newTerm: string) => {
    setTerm(newTerm)
    startScrape(newTerm)
  }

  const didAutoLoad = useRef(false)
  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    autoLoad().then((loaded) => {
      if (!loaded) startScrape(term)
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

  return (
    <div className="min-h-screen bg-bg">
      <Header
        isLoaded={isLoaded}
        stats={stats}
        onScrapeClick={handleScrapeClick}
        scrapeRunning={progress.status === 'running'}
        activeView={activeView}
        onViewChange={setActiveView}
        model={model}
        onModelChange={setModel}
        term={term}
        onTermChange={handleTermChange}
        scheduleCount={mySchedule.schedule.length}
        completedCount={completedCourses.completed.length}
      />

      {activeView === 'ai' && isLoaded ? (
        <ChatPanel
          messages={messages}
          isStreaming={isStreaming}
          thinkingPhase={thinkingPhase}
          error={chatError}
          onSend={(text) => sendMessage(text, model, term, completedContext)}
          onClear={clearChat}
          onAddToSchedule={mySchedule.addFromProposal}
          onAddCourseStub={(code) => {
            setActiveView('browse')
            setSearch(code)
          }}
        />
      ) : activeView === 'schedule' && isLoaded ? (
        <MySchedule
          schedule={mySchedule.schedule}
          proposal={mySchedule.asProposal}
          onRemove={mySchedule.removeCourse}
          onRemoveSection={mySchedule.removeSection}
          onClear={mySchedule.clearSchedule}
        />
      ) : activeView === 'progress' && isLoaded ? (
        <GradProgress completedCodes={completedCourses.completed.map((c) => c.course_code)} />
      ) : activeView === 'completed' && isLoaded ? (
        <CompletedCourses
          completed={completedCourses.completed}
          allCourses={courses}
          onAdd={completedCourses.addCourse}
          onRemove={completedCourses.removeCourse}
          onClear={completedCourses.clearAll}
        />
      ) : (
        <Layout
          showSidebar={isLoaded}
          sidebar={
            <Sidebar
              departments={departments}
              activeDept={filters.department}
              totalCourses={courses.length}
              onDeptClick={setDepartment}
            />
          }
        >
          {!isLoaded ? (
            <UploadZone
              onFileLoad={loadFromFile}
              onServerLoad={loadFromServer}
              onScrape={() => startScrape()}
              isLoading={isLoading}
              isScraping={progress.status === 'running'}
              scrapeProgress={progress}
              error={error}
            />
          ) : (
            <>
              <FilterBar
                search={filters.search}
                sectionType={filters.sectionType}
                availability={filters.availability}
                resultCount={filtered.length}
                onSearchChange={setSearch}
                onTypeChange={setSectionType}
                onAvailChange={setAvailability}
              />
              <CourseList
                courses={filtered}
                onAddToSchedule={mySchedule.addCourse}
                hasCourse={mySchedule.hasCourse}
                hasSection={mySchedule.hasSection}
                hasCompleted={completedCourses.hasCompleted}
                getRating={getRating}
              />
            </>
          )}
        </Layout>
      )}

      <ScrapePanel
        progress={progress}
        show={showPanel && isLoaded}
        onClose={() => setShowPanel(false)}
        onLoadResults={handleScrapeComplete}
      />
    </div>
  )
}
