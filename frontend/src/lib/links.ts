let _term = 'SP26'

export function setCurrentTerm(term: string) {
  _term = term
}

export function getCurrentTerm(): string {
  return _term
}

export function socSearchUrl(subject: string, term?: string): string {
  const t = term || _term
  return `https://act.ucsd.edu/scheduleOfClasses/scheduleOfClassesStudent.htm#selectedTerm=${t}&selectedSubjects=${encodeURIComponent(subject)}`
}

export function capeUrl(courseCode: string): string {
  return `https://cape.ucsd.edu/responses/Results.aspx?courseNumber=${encodeURIComponent(courseCode.replace(' ', '+'))}`
}

export function capeInstructorUrl(instructor: string): string {
  return `https://cape.ucsd.edu/responses/Results.aspx?name=${encodeURIComponent(instructor)}`
}

export function rmpUrl(instructor: string): string {
  const name = instructor.split(',')[0]?.trim() || instructor
  return `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(name)}&sid=U2Nob29sLTEwNzk=`
}

export function catalogUrl(subject: string, number: string): string {
  return `https://catalog.ucsd.edu/courses/${subject}.html#${subject.toLowerCase()}${number}`
}

export function webRegUrl(sectionId: string, term?: string): string {
  const t = term || _term
  // WebReg deep link — opens WebReg with the section pre-filled
  return `https://act.ucsd.edu/webreg2/start?p2term=${t}&p2section=${sectionId}`
}

export function courseCodeToSubject(courseCode: string): string {
  return courseCode.split(' ')[0] || courseCode
}

// Fallback terms if the API hasn't loaded yet
export const DEFAULT_TERM_OPTIONS = [
  { value: 'SP26', label: 'Spring 2026' },
  { value: 'S126', label: 'Summer I 2026' },
  { value: 'S226', label: 'Summer II 2026' },
]

// Mutable term options — gets replaced by API data
export let TERM_OPTIONS: { value: string; label: string }[] = [...DEFAULT_TERM_OPTIONS]

export function setTermOptions(terms: { value: string; label: string }[]) {
  TERM_OPTIONS = terms
}

export function getTermLabel(termCode: string): string {
  const found = TERM_OPTIONS.find((t) => t.value === termCode)
  return found?.label || termCode
}
