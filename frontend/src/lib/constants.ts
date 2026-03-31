export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  LE: { bg: 'rgba(79,142,247,0.15)', text: '#78a9f7' },
  DI: { bg: 'rgba(61,214,140,0.15)', text: '#3dd68c' },
  LA: { bg: 'rgba(245,200,66,0.15)', text: '#f5c842' },
  SE: { bg: 'rgba(124,92,252,0.15)', text: '#a07cf5' },
}

export const TYPE_LABELS: Record<string, string> = {
  LE: 'Lecture',
  DI: 'Discussion',
  LA: 'Lab',
  SE: 'Seminar',
  IN: 'Independent Study',
  TA: 'TA',
  TU: 'Tutorial',
  CL: 'Clinical',
  ST: 'Studio',
}
