import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '../hooks/useChat'
import type { ScheduleProposal } from '../lib/schedule'
import { parseScheduleJson } from '../lib/schedule'
import { parseChatBlocks } from '../lib/chat-blocks'
import { ScheduleReport } from './ScheduleReport'
import { QuickOptions } from './QuickOptions'
import { PromptInput } from './PromptInput'
import { CourseInfoCard } from './CourseInfoCard'
import { capeUrl, socSearchUrl, courseCodeToSubject } from '../lib/links'

interface ChatPanelProps {
  messages: ChatMessage[]
  isStreaming: boolean
  thinkingPhase: string | null
  error: string | null
  onSend: (text: string) => void
  onClear: () => void
  onAddToSchedule?: (proposal: ScheduleProposal) => void
  onAddCourseStub?: (courseCode: string) => void
  model?: string
  onModelChange?: (model: string) => void
}

export function ChatPanel({ messages, isStreaming, thinkingPhase, error, onSend, onClear, onAddToSchedule, onAddCourseStub, model, onModelChange }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    onSend(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-bg">
      {/* Messages area — full width, centered content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
          {messages.length === 0 && <EmptyState onSelect={(s) => { setInput(s); textareaRef.current?.focus() }} />}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} isLast={i === messages.length - 1} isStreaming={isStreaming} onAddToSchedule={onAddToSchedule} onSend={onSend} onAddCourseStub={onAddCourseStub} />
          ))}

          {thinkingPhase && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-2xl px-5 py-4 bg-surface border border-border flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[13px] text-muted">{thinkingPhase}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-[13px] text-red bg-red/10 px-4 py-3 rounded-xl border border-red/20">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar — pinned to bottom, full width */}
      <div className="border-t border-border bg-surface/30">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about your major, courses you need, and time preferences..."
              rows={2}
              className="flex-1 bg-surface border border-border rounded-xl text-text font-sans text-[14px]
                px-4 py-3 outline-none resize-none transition-colors
                focus:border-accent placeholder:text-dim"
            />
            <div className="flex flex-col gap-2 self-end">
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="px-6 py-3 rounded-xl text-[14px] font-bold
                  bg-accent text-white
                  hover:bg-accent/85
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-150 cursor-pointer"
              >
                {isStreaming ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Working...
                  </span>
                ) : (
                  'Go'
                )}
              </button>
              {messages.length > 0 && (
                <button
                  onClick={onClear}
                  className="px-3 py-1 rounded-lg text-[11px] text-muted
                    hover:text-text transition-colors cursor-pointer text-center"
                >
                  Clear chat
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {model && onModelChange && (
              <select
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-surface border border-border rounded-lg text-[11px] text-muted
                  px-2 py-1 outline-none cursor-pointer focus:border-accent hover:border-border2"
              >
                <option value="sonnet">Sonnet 4.6</option>
                <option value="opus">Opus 4.6</option>
                <option value="gemini">Gemini 2.5 Flash (Free)</option>
              </select>
            )}
            <span className="text-[11px] text-dim">Enter to send, Shift+Enter for newline</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-accent2/12 flex items-center justify-center">
        <svg width="32" height="32" fill="none" stroke="#7c5cfc" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-medium text-text mb-2">AI Schedule Planner</h2>
        <p className="text-[14px] text-muted leading-relaxed max-w-md">
          Tell me what you need and I'll build you a schedule with a visual calendar,
          real course data, and downloadable reports.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-lg">
        {[
          { text: 'Plan my spring quarter — 2nd year CS major', icon: '📋' },
          { text: 'I need CSE 12 and MATH 20C, no classes before 10am', icon: '🕐' },
          { text: 'Build me a 16-unit CSE schedule with labs', icon: '🔬' },
          { text: 'What ECE classes have open seats this quarter?', icon: '🪑' },
        ].map(({ text, icon }) => (
          <button
            key={text}
            onClick={() => onSelect(text)}
            className="text-left text-[13px] px-4 py-3 rounded-xl bg-surface border border-border
              text-muted hover:text-text hover:border-border2 hover:bg-card
              transition-all duration-150 cursor-pointer flex items-start gap-2"
          >
            <span className="text-base shrink-0">{icon}</span>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  isLast,
  isStreaming,
  onAddToSchedule,
  onSend,
  onAddCourseStub,
}: {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  onAddToSchedule?: (proposal: ScheduleProposal) => void
  onSend?: (text: string) => void
  onAddCourseStub?: (courseCode: string) => void
}) {
  const isUser = message.role === 'user'
  const proposal = !isUser ? parseScheduleJson(message.content) : null
  const blocks = !isUser ? parseChatBlocks(message.content.replace(/```schedule-json[\s\S]*?```/, '')) : null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`rounded-2xl px-5 py-4 text-[14px] leading-relaxed ${
          isUser
            ? 'bg-accent/12 text-text border border-accent/20 max-w-2xl'
            : 'bg-surface text-text border border-border w-full'
        }`}
      >
        {/* Main text content */}
        {blocks ? (
          <RichTextContent content={blocks.text} />
        ) : (
          <RichTextContent content={message.content} />
        )}

        {/* Schedule calendar */}
        {proposal && (
          <ScheduleReport proposal={proposal} onAddToSchedule={onAddToSchedule} />
        )}

        {/* Course info cards */}
        {blocks?.courseInfos.map((info, i) => (
          <CourseInfoCard key={i} info={info} onAddToSchedule={onAddCourseStub} />
        ))}

        {/* Quick-reply options */}
        {blocks?.options.map((opt, i) => (
          <QuickOptions key={i} options={opt.options} onSelect={(v) => onSend?.(v)} disabled={isStreaming} />
        ))}

        {/* Text prompt inputs */}
        {blocks?.prompts.map((p, i) => (
          <PromptInput key={i} label={p.label} placeholder={p.placeholder} onSubmit={(v) => onSend?.(v)} disabled={isStreaming} />
        ))}

        {isLast && isStreaming && !isUser && (
          <span className="inline-block w-2 h-5 bg-accent ml-1 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}

function RichTextContent({ content }: { content: string }) {
  if (!content) return null

  const parts = content.split(/\b([A-Z]{2,5}\s+\d{1,3}[A-Z]*)\b/)

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (i % 2 === 1 && /^[A-Z]{2,5}\s+\d{1,3}[A-Z]*$/.test(part)) {
          const subject = courseCodeToSubject(part)
          return (
            <span key={i} className="inline-flex gap-1 items-baseline">
              <a
                href={socSearchUrl(subject)}
                target="_blank"
                rel="noopener"
                className="text-accent hover:underline font-medium"
                title={`View ${subject} on Schedule of Classes`}
              >
                {part}
              </a>
              <a
                href={capeUrl(part)}
                target="_blank"
                rel="noopener"
                className="text-[11px] text-accent2 hover:underline"
                title={`View CAPEs for ${part}`}
              >
                CAPEs
              </a>
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}
