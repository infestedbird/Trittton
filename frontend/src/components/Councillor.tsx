import { useRef, useEffect, useState } from 'react'
import { useCouncillor } from '../hooks/useCouncillor'
import type { ChatMessage } from '../hooks/useCouncillor'

interface CouncillorProps {
  model: string
}

const QUICK_TOPICS = [
  { label: 'College GEs', question: 'Compare the GE requirements across all 8 colleges. Which is best for an engineering major?' },
  { label: 'Dining', question: 'What are the best dining options on campus? Explain meal plans and Dining Dollars vs Triton Cash.' },
  { label: 'Housing', question: "What are my housing options? Compare on-campus vs off-campus, and which neighborhoods are best for students?" },
  { label: 'Transportation', question: 'How do I get around campus and San Diego? Explain the trolley, buses, U-Pass, and shuttles.' },
  { label: 'Registration', question: 'How does course registration work? Walk me through WebReg, enrollment times, and waitlists.' },
  { label: 'Change Major', question: 'How do I change my major? What about selective/capped majors like CSE or Data Science?' },
  { label: 'Financial Aid', question: "What financial aid is available? What's the total cost of attendance for a CA resident?" },
  { label: 'Mental Health', question: 'What mental health and counseling resources are available on campus?' },
]

export function Councillor({ model }: CouncillorProps) {
  const { messages, isStreaming, thinkingPhase, error, sendMessage, clearChat } = useCouncillor()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingPhase])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendMessage(text, model)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickTopic = (question: string) => {
    if (isStreaming) return
    sendMessage(question, model)
  }

  // Parse options blocks from assistant messages
  const handleOptionClick = (option: string) => {
    if (isStreaming) return
    setInput('')
    sendMessage(option, model)
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-2xl text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-accent2/10 flex items-center justify-center mx-auto mb-5">
              <svg width="32" height="32" fill="none" stroke="#7c5cfc" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-text mb-2">UCSD AI Councillor</h2>
            <p className="text-[14px] text-muted leading-relaxed mb-6">
              Ask me anything about UCSD — academics, housing, dining, transportation, campus life,
              financial aid, registration, or any question you'd ask a counselor or friend.
            </p>

            {/* Quick topic grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_TOPICS.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleQuickTopic(t.question)}
                  className="px-3 py-2.5 rounded-xl bg-card border border-border text-left
                    hover:border-accent2/30 hover:bg-accent2/5 cursor-pointer group"
                >
                  <div className="text-[12px] font-medium text-text group-hover:text-accent2">{t.label}</div>
                  <div className="text-[10px] text-muted mt-0.5 line-clamp-2">{t.question.slice(0, 60)}...</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border px-6 py-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about UCSD..."
              rows={1}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-[14px]
                text-text font-sans resize-none outline-none
                focus:border-accent2/50 placeholder:text-dim"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="px-5 py-3 rounded-xl font-mono text-[12px] font-medium
                bg-accent2 text-white hover:bg-accent2/85
                disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming && i === messages.length - 1}
              onOptionClick={handleOptionClick}
            />
          ))}

          {/* Thinking indicator */}
          {thinkingPhase && (
            <div className="flex items-center gap-2 text-[12px] text-muted font-mono animate-fade-in">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {thinkingPhase}
            </div>
          )}

          {error && (
            <div className="text-[12px] text-red font-mono bg-red/8 border border-red/15 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about UCSD..."
            rows={1}
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-[14px]
              text-text font-sans resize-none outline-none
              focus:border-accent2/50 placeholder:text-dim"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="px-5 py-3 rounded-xl font-mono text-[12px] font-medium
              bg-accent2 text-white hover:bg-accent2/85
              disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            Send
          </button>
          <button
            onClick={clearChat}
            className="px-3 py-3 rounded-xl font-mono text-[11px]
              text-muted bg-surface border border-border hover:text-text hover:border-border2
              cursor-pointer shrink-0"
            title="Clear conversation"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, isLast, isStreaming, onOptionClick }: {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  onOptionClick: (option: string) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[75%] bg-accent2/10 border border-accent2/15 rounded-2xl rounded-br-md px-4 py-3">
          <div className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    )
  }

  // Parse content for options blocks
  const parts = parseContent(message.content)

  return (
    <div className="animate-fade-in">
      <div className="bg-surface/50 border border-border/50 rounded-2xl rounded-bl-md px-5 py-4">
        {parts.map((part, i) => {
          if (part.type === 'options') {
            return (
              <div key={i} className="flex flex-wrap gap-2 my-2">
                {part.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onOptionClick(opt)}
                    disabled={isStreaming}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-mono font-medium
                      bg-accent2/10 text-accent2 border border-accent2/15
                      hover:bg-accent2/20 disabled:opacity-50 cursor-pointer"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )
          }
          return (
            <div key={i} className="text-[14px] text-text leading-relaxed whitespace-pre-wrap prose-content">
              {renderMarkdown(part.text)}
            </div>
          )
        })}
        {isLast && isStreaming && !message.content && (
          <div className="text-dim text-[13px]">...</div>
        )}
      </div>
    </div>
  )
}

interface ContentPart {
  type: 'text' | 'options'
  text: string
  options: string[]
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const optionsRegex = /```options\s*\n([\s\S]*?)\n```/g
  let lastIndex = 0
  let match

  while ((match = optionsRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index), options: [] })
    }
    try {
      const options = JSON.parse(match[1])
      parts.push({ type: 'options', text: '', options })
    } catch {
      parts.push({ type: 'text', text: match[0], options: [] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex), options: [] })
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: content, options: [] }]
}

function renderMarkdown(text: string): React.ReactNode {
  // Simple markdown: bold, links, inline code
  const segments: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g
  let lastIdx = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push(text.slice(lastIdx, match.index))
    }
    if (match[2]) {
      segments.push(<strong key={key++} className="font-medium text-text">{match[2]}</strong>)
    } else if (match[3]) {
      segments.push(<code key={key++} className="font-mono text-[12px] bg-card px-1.5 py-0.5 rounded text-accent">{match[3]}</code>)
    } else if (match[4] && match[5]) {
      segments.push(<a key={key++} href={match[5]} target="_blank" rel="noopener" className="text-accent2 hover:underline">{match[4]}</a>)
    }
    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    segments.push(text.slice(lastIdx))
  }

  return segments.length > 0 ? <>{segments}</> : text
}
