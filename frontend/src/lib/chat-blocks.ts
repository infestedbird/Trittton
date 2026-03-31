export interface OptionsBlock {
  options: string[]
}

export interface PromptBlock {
  placeholder: string
  label: string
}

export interface CourseInfoBlock {
  course_code: string
  title: string
  units: number
  instructor: string
  rating?: number
  difficulty?: number
  would_take_again?: number
  num_ratings?: number
}

export interface ParsedBlocks {
  text: string
  options: OptionsBlock[]
  prompts: PromptBlock[]
  courseInfos: CourseInfoBlock[]
}

export function parseChatBlocks(content: string): ParsedBlocks {
  let text = content
  const options: OptionsBlock[] = []
  const prompts: PromptBlock[] = []
  const courseInfos: CourseInfoBlock[] = []

  // Parse ```options [...] ```
  const optionsRegex = /```options\s*\n([\s\S]*?)\n```/g
  let match
  while ((match = optionsRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        options.push({ options: parsed })
      }
    } catch { /* skip malformed */ }
  }
  text = text.replace(optionsRegex, '').trim()

  // Parse ```prompt {...} ```
  const promptRegex = /```prompt\s*\n([\s\S]*?)\n```/g
  while ((match = promptRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.placeholder || parsed.label) {
        prompts.push(parsed)
      }
    } catch { /* skip */ }
  }
  text = text.replace(promptRegex, '').trim()

  // Parse ```course-info {...} ```
  const courseInfoRegex = /```course-info\s*\n([\s\S]*?)\n```/g
  while ((match = courseInfoRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed.course_code) {
        courseInfos.push(parsed)
      }
    } catch { /* skip */ }
  }
  text = text.replace(courseInfoRegex, '').trim()

  return { text, options, prompts, courseInfos }
}
