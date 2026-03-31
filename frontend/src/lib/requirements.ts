// Warren College GE Requirements + Major Requirements

export interface RequirementGroup {
  id: string
  name: string
  description: string
  courses: string[][] // each inner array is a set of alternatives (complete any ONE from each)
  minCourses: number  // how many from `courses` must be completed
  allowOverlap?: boolean // can overlap with major
}

export interface MajorDef {
  name: string
  code: string
  isEngineering: boolean
  lowerDiv: string[]   // required lower-div courses
  upperDiv: string[]   // required upper-div courses
  electives?: { pick: number; from: string[] }
}

// ── Warren College GE ────────────────────────────────────────────────────────

export const WARREN_GE: RequirementGroup[] = [
  {
    id: 'warren-writing',
    name: 'Warren Writing Program',
    description: 'Two writing courses, letter grade required',
    courses: [['WCWP 10A'], ['WCWP 10B']],
    minCourses: 2,
  },
  {
    id: 'ethics-society',
    name: 'Ethics & Society',
    description: 'One from each pair, letter grade required',
    courses: [['PHIL 27', 'POLI 27'], ['PHIL 28', 'POLI 28']],
    minCourses: 2,
  },
  {
    id: 'formal-skills',
    name: 'Formal Skills',
    description: 'Two courses from approved list, can overlap with major',
    courses: [
      [
        // Math/Calculus
        'MATH 3C', 'MATH 4C', 'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11', 'MATH 15A', 'MATH 15B',
        'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E', 'MATH 31AH', 'MATH 31BH', 'MATH 31CH',
        // Logic/Philosophy
        'PHIL 10', 'PHIL 12', 'PHIL 15',
        // Statistics
        'PSYC 60', 'PSYC 70', 'SOCI 60', 'HDS 60', 'ECON 120A', 'POLI 30', 'POLI 30D',
        // Programming/CS
        'CSE 3', 'CSE 5A', 'CSE 6R', 'CSE 8A', 'CSE 8B', 'CSE 11', 'CSE 12',
        'COGS 3', 'COGS 8', 'COGS 14A', 'COGS 14B', 'COGS 18',
        'DSC 10', 'DSC 20', 'DSC 30',
        // Other
        'ECON 5', 'MGT 3', 'MGT 45', 'LIGN 17', 'LIGN 6',
        'ECE 15', 'ECE 25', 'MAE 8',
      ],
    ],
    minCourses: 2,
    allowOverlap: true,
  },
  {
    id: 'dei',
    name: 'Diversity, Equity & Inclusion',
    description: 'One DEI course (university requirement)',
    courses: [
      [
        'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40', 'ETHN 100A', 'ETHN 100B', 'ETHN 100C',
        'HILD 7A', 'HILD 7B', 'HILD 7C', 'HILD 7GS', 'HILD 10', 'HILD 12',
        'LIGN 7', 'LIGN 8',
        'ANTH 21', 'ANTH 23', 'ANTH 43',
        'COMM 10', 'COMM 100A',
        'SOCI 1', 'SOCI 40', 'SOCI 50', 'SOCI 60',
        'USP 1', 'USP 2',
        'AAS 10', 'AAS 100',
        'CGS 2', 'CGS 21', 'CGS 100', 'CGS 101', 'CGS 105', 'CGS 112',
        'HDP 1', 'HDP 110',
        'POLI 100A', 'POLI 100DA',
        'PSYC 101', 'PSYC 133',
        'TDGE 25', 'TDGE 131',
        'VIS 21', 'VIS 152',
        'WARR 11', 'WARR 11GS',
        'EDS 25', 'EDS 112', 'EDS 113', 'EDS 117',
        'GLBH 20', 'GLBH 100', 'GLBH 150',
        'HIST 109', 'HIST 117', 'HIST 162',
        'INTL 101', 'INTL 171',
        'MUSC 8', 'MUSC 17', 'MUSC 18', 'MUSC 126', 'MUSC 127',
        'PHIL 164', 'PHIL 165', 'PHIL 166',
        'RELI 101', 'RELI 188',
      ],
    ],
    minCourses: 1,
  },
  {
    id: 'poc-1',
    name: 'Program of Concentration 1',
    description: '6 courses (non-engineering) or 3 courses (engineering), non-contiguous with major',
    courses: [],
    minCourses: 6,
  },
  {
    id: 'poc-2',
    name: 'Program of Concentration 2',
    description: '6 courses (non-engineering) or 3 courses (engineering), non-contiguous with major',
    courses: [],
    minCourses: 6,
  },
]

// ── Major Definitions ────────────────────────────────────────────────────────

export const MAJORS: Record<string, MajorDef> = {
  'Computer Science': {
    name: 'Computer Science',
    code: 'CS',
    isEngineering: true,
    lowerDiv: [
      'CSE 8B', 'CSE 11', 'CSE 12', 'CSE 15', 'CSE 20', 'CSE 21', 'CSE 30',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
    ],
    upperDiv: [
      'CSE 100', 'CSE 101', 'CSE 105', 'CSE 110', 'CSE 120', 'CSE 130',
      'CSE 140', 'CSE 140L', 'CSE 141', 'CSE 141L',
    ],
    electives: {
      pick: 5,
      from: [
        'CSE 107', 'CSE 108', 'CSE 111', 'CSE 112', 'CSE 118', 'CSE 123', 'CSE 124',
        'CSE 125', 'CSE 127', 'CSE 131', 'CSE 132A', 'CSE 132B', 'CSE 134B',
        'CSE 135', 'CSE 136', 'CSE 138', 'CSE 142', 'CSE 142L', 'CSE 143',
        'CSE 144', 'CSE 145', 'CSE 148', 'CSE 150A', 'CSE 150B', 'CSE 151A', 'CSE 151B',
        'CSE 152A', 'CSE 152B', 'CSE 153', 'CSE 154', 'CSE 156', 'CSE 158', 'CSE 160',
        'CSE 163', 'CSE 164', 'CSE 166', 'CSE 167', 'CSE 168', 'CSE 169',
        'CSE 170', 'CSE 175', 'CSE 176', 'CSE 180', 'CSE 181', 'CSE 182',
        'CSE 184', 'CSE 185', 'CSE 189', 'CSE 190', 'CSE 191',
      ],
    },
  },
  'Computer Engineering': {
    name: 'Computer Engineering',
    code: 'CE',
    isEngineering: true,
    lowerDiv: [
      'CSE 11', 'CSE 12', 'CSE 15', 'CSE 20', 'CSE 21', 'CSE 30',
      'ECE 25', 'ECE 35', 'ECE 45', 'ECE 65',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
    ],
    upperDiv: [
      'CSE 100', 'CSE 101', 'CSE 110', 'CSE 120',
      'ECE 100', 'ECE 101', 'ECE 108', 'ECE 111',
    ],
    electives: {
      pick: 5,
      from: [
        'CSE 105', 'CSE 107', 'CSE 123', 'CSE 124', 'CSE 125', 'CSE 127', 'CSE 130',
        'CSE 131', 'CSE 132A', 'CSE 134B', 'CSE 140', 'CSE 140L', 'CSE 141', 'CSE 141L',
        'CSE 142', 'CSE 143', 'CSE 145', 'CSE 148', 'CSE 150A', 'CSE 150B',
        'CSE 151A', 'CSE 151B', 'CSE 152A', 'CSE 152B', 'CSE 156', 'CSE 160',
        'ECE 102', 'ECE 103', 'ECE 107', 'ECE 109', 'ECE 110', 'ECE 111',
        'ECE 115', 'ECE 118', 'ECE 120', 'ECE 121', 'ECE 123', 'ECE 124',
        'ECE 125', 'ECE 128', 'ECE 134', 'ECE 135', 'ECE 136',
        'ECE 140A', 'ECE 140B', 'ECE 141', 'ECE 143', 'ECE 144', 'ECE 148',
        'ECE 150', 'ECE 155', 'ECE 158A', 'ECE 158B', 'ECE 161A', 'ECE 161B', 'ECE 161C',
        'ECE 163', 'ECE 164', 'ECE 165', 'ECE 166', 'ECE 171A', 'ECE 171B',
        'ECE 172A', 'ECE 174', 'ECE 175A', 'ECE 175B', 'ECE 176', 'ECE 180',
        'ECE 181', 'ECE 182', 'ECE 183', 'ECE 184', 'ECE 185', 'ECE 187',
      ],
    },
  },
  'Electrical Engineering': {
    name: 'Electrical Engineering',
    code: 'EE',
    isEngineering: true,
    lowerDiv: [
      'ECE 5', 'ECE 25', 'ECE 30', 'ECE 35', 'ECE 45', 'ECE 65',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C', 'PHYS 2D',
    ],
    upperDiv: [
      'ECE 100', 'ECE 101', 'ECE 102', 'ECE 103', 'ECE 107', 'ECE 109',
    ],
    electives: {
      pick: 7,
      from: [
        'ECE 108', 'ECE 110', 'ECE 111', 'ECE 115', 'ECE 118', 'ECE 120',
        'ECE 121', 'ECE 123', 'ECE 124', 'ECE 125', 'ECE 128',
        'ECE 134', 'ECE 135', 'ECE 136',
        'ECE 140A', 'ECE 140B', 'ECE 141', 'ECE 143', 'ECE 144', 'ECE 148',
        'ECE 150', 'ECE 155', 'ECE 158A', 'ECE 158B',
        'ECE 161A', 'ECE 161B', 'ECE 161C', 'ECE 163', 'ECE 164', 'ECE 165', 'ECE 166',
        'ECE 171A', 'ECE 171B', 'ECE 172A', 'ECE 174',
        'ECE 175A', 'ECE 175B', 'ECE 176', 'ECE 180', 'ECE 181', 'ECE 182',
        'ECE 183', 'ECE 184', 'ECE 185', 'ECE 187',
      ],
    },
  },
  'Physics': {
    name: 'Physics',
    code: 'PH',
    isEngineering: false,
    lowerDiv: [
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C', 'PHYS 2D', 'PHYS 2DL',
      'PHYS 4A', 'PHYS 4B', 'PHYS 4C', 'PHYS 4D', 'PHYS 4E',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E',
    ],
    upperDiv: [
      'PHYS 100A', 'PHYS 100B',
      'PHYS 105A', 'PHYS 105B',
      'PHYS 110A', 'PHYS 110B',
      'PHYS 120',
      'PHYS 130A', 'PHYS 130B',
      'PHYS 140A', 'PHYS 140B',
    ],
    electives: {
      pick: 4,
      from: [
        'PHYS 111', 'PHYS 120B', 'PHYS 121', 'PHYS 122', 'PHYS 123', 'PHYS 124',
        'PHYS 125', 'PHYS 128', 'PHYS 129',
        'PHYS 130C', 'PHYS 133', 'PHYS 137', 'PHYS 139',
        'PHYS 140C', 'PHYS 141', 'PHYS 142',
        'PHYS 151', 'PHYS 152', 'PHYS 153', 'PHYS 154',
        'PHYS 160', 'PHYS 161', 'PHYS 162', 'PHYS 163',
        'PHYS 170', 'PHYS 171', 'PHYS 173', 'PHYS 176', 'PHYS 177',
        'PHYS 180', 'PHYS 181', 'PHYS 182', 'PHYS 183',
        'PHYS 190', 'PHYS 191', 'PHYS 194', 'PHYS 195',
      ],
    },
  },
  'Mathematics': {
    name: 'Mathematics',
    code: 'MA',
    isEngineering: false,
    lowerDiv: [
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 109',
    ],
    upperDiv: [
      'MATH 100A', 'MATH 100B', 'MATH 100C',
      'MATH 140A', 'MATH 140B', 'MATH 140C',
    ],
    electives: {
      pick: 7,
      from: [
        'MATH 101A', 'MATH 101B', 'MATH 101C', 'MATH 102', 'MATH 103A', 'MATH 103B',
        'MATH 104A', 'MATH 104B', 'MATH 104C',
        'MATH 110A', 'MATH 110B', 'MATH 111A', 'MATH 111B',
        'MATH 120A', 'MATH 120B', 'MATH 121A', 'MATH 121B',
        'MATH 130', 'MATH 131', 'MATH 132',
        'MATH 142A', 'MATH 142B',
        'MATH 150A', 'MATH 150B', 'MATH 152', 'MATH 153', 'MATH 154',
        'MATH 155A', 'MATH 155B', 'MATH 158',
        'MATH 160A', 'MATH 160B', 'MATH 160C',
        'MATH 163', 'MATH 168', 'MATH 170A', 'MATH 170B', 'MATH 170C',
        'MATH 171A', 'MATH 171B', 'MATH 173A', 'MATH 173B',
        'MATH 174', 'MATH 175', 'MATH 179', 'MATH 180A', 'MATH 180B', 'MATH 180C',
        'MATH 181A', 'MATH 181B', 'MATH 181C', 'MATH 181D', 'MATH 181E',
        'MATH 183', 'MATH 184', 'MATH 185', 'MATH 187A', 'MATH 187B',
        'MATH 189', 'MATH 190', 'MATH 191', 'MATH 194',
      ],
    },
  },
  'Data Science': {
    name: 'Data Science',
    code: 'DS',
    isEngineering: false,
    lowerDiv: [
      'DSC 10', 'DSC 20', 'DSC 30', 'DSC 40A', 'DSC 40B', 'DSC 80',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C',
      'CSE 11', 'CSE 12',
    ],
    upperDiv: [
      'DSC 100', 'DSC 102', 'DSC 106', 'DSC 140A', 'DSC 140B', 'DSC 148',
    ],
    electives: {
      pick: 4,
      from: [
        'DSC 120', 'DSC 140B', 'DSC 155', 'DSC 160', 'DSC 161', 'DSC 170',
        'DSC 180A', 'DSC 180B', 'DSC 190',
        'CSE 100', 'CSE 101', 'CSE 105', 'CSE 110', 'CSE 151A', 'CSE 151B',
        'CSE 152A', 'CSE 158', 'CSE 167',
        'COGS 108', 'COGS 118A', 'COGS 118B', 'COGS 181',
        'ECON 120A', 'ECON 120B', 'ECON 120C',
        'MATH 180A', 'MATH 180B', 'MATH 181A', 'MATH 181B',
        'MATH 183', 'MATH 189',
      ],
    },
  },
  'Cognitive Science': {
    name: 'Cognitive Science',
    code: 'CG',
    isEngineering: false,
    lowerDiv: [
      'COGS 1', 'COGS 14A', 'COGS 14B', 'COGS 17', 'COGS 18',
      'PSYC 1', 'PSYC 2',
      'MATH 11', 'MATH 18',
    ],
    upperDiv: [
      'COGS 101A', 'COGS 101B', 'COGS 101C', 'COGS 107A', 'COGS 107B', 'COGS 107C',
      'COGS 108', 'COGS 118A',
    ],
    electives: {
      pick: 5,
      from: [
        'COGS 100', 'COGS 102A', 'COGS 102B', 'COGS 102C',
        'COGS 105', 'COGS 107D', 'COGS 109',
        'COGS 110', 'COGS 111', 'COGS 112', 'COGS 113',
        'COGS 115', 'COGS 116', 'COGS 117', 'COGS 118B', 'COGS 118C',
        'COGS 119', 'COGS 120', 'COGS 121', 'COGS 122',
        'COGS 123', 'COGS 124', 'COGS 125', 'COGS 126',
        'COGS 127', 'COGS 130', 'COGS 131', 'COGS 132',
        'COGS 133', 'COGS 134', 'COGS 135', 'COGS 136',
        'COGS 137', 'COGS 138', 'COGS 139', 'COGS 140',
        'COGS 141', 'COGS 142', 'COGS 143', 'COGS 144',
        'COGS 150', 'COGS 151', 'COGS 152', 'COGS 153',
        'COGS 154', 'COGS 155', 'COGS 160', 'COGS 170',
        'COGS 171', 'COGS 172', 'COGS 175', 'COGS 180', 'COGS 181',
        'COGS 185', 'COGS 187A', 'COGS 187B',
        'PSYC 100', 'PSYC 101', 'PSYC 102', 'PSYC 104', 'PSYC 105', 'PSYC 106',
        'LIGN 101', 'LIGN 110', 'LIGN 111', 'LIGN 115', 'LIGN 120', 'LIGN 121',
        'LIGN 130', 'LIGN 138', 'LIGN 143', 'LIGN 145', 'LIGN 165', 'LIGN 167',
        'LIGN 168', 'LIGN 170', 'LIGN 171', 'LIGN 174', 'LIGN 175', 'LIGN 176',
        'PHIL 100', 'PHIL 101', 'PHIL 102', 'PHIL 104', 'PHIL 105', 'PHIL 108',
        'PHIL 110', 'PHIL 112', 'PHIL 113', 'PHIL 115',
      ],
    },
  },
}

export const MAJOR_NAMES = Object.keys(MAJORS)

// ── Progress Calculation ─────────────────────────────────────────────────────

export interface ReqProgress {
  id: string
  name: string
  description: string
  required: number
  completed: number
  completedCourses: string[]
  missingOptions: string[][]
}

export interface GradProgress {
  major: string
  isEngineering: boolean
  ge: ReqProgress[]
  lowerDiv: ReqProgress
  upperDiv: ReqProgress
  electives?: ReqProgress
  totalCompleted: number
  totalRequired: number
  overallPct: number
}

export function calculateProgress(
  majorName: string,
  completedCodes: Set<string>,
): GradProgress {
  const major = MAJORS[majorName]
  if (!major) {
    return {
      major: majorName, isEngineering: false,
      ge: [], lowerDiv: { id: 'ld', name: 'Lower Division', description: '', required: 0, completed: 0, completedCourses: [], missingOptions: [] },
      upperDiv: { id: 'ud', name: 'Upper Division', description: '', required: 0, completed: 0, completedCourses: [], missingOptions: [] },
      totalCompleted: 0, totalRequired: 0, overallPct: 0,
    }
  }

  // Calculate GE progress
  const ge: ReqProgress[] = WARREN_GE
    .filter((g) => g.id !== 'poc-1' && g.id !== 'poc-2')
    .map((g) => {
      if (g.courses.length === 0) {
        return { id: g.id, name: g.name, description: g.description, required: g.minCourses, completed: 0, completedCourses: [], missingOptions: [] }
      }

      if (g.courses.length === 1 && g.courses[0].length > 2) {
        const pool = g.courses[0]
        const done = pool.filter((c) => completedCodes.has(c))
        const needed = Math.max(0, g.minCourses - done.length)
        const remaining = needed > 0 ? [pool.filter((c) => !completedCodes.has(c))] : []
        return {
          id: g.id, name: g.name, description: g.description,
          required: g.minCourses, completed: Math.min(done.length, g.minCourses),
          completedCourses: done.slice(0, g.minCourses), missingOptions: remaining,
        }
      }

      const completed: string[] = []
      const missing: string[][] = []
      for (const alts of g.courses) {
        const done = alts.find((c) => completedCodes.has(c))
        if (done) completed.push(done)
        else missing.push(alts)
      }

      return {
        id: g.id, name: g.name, description: g.description,
        required: g.minCourses, completed: completed.length,
        completedCourses: completed, missingOptions: missing,
      }
    })

  const pocReq = major.isEngineering ? 3 : 6
  ge.push({
    id: 'poc', name: 'Programs of Concentration',
    description: `${pocReq} courses each in 2 areas outside your major`,
    required: pocReq * 2, completed: 0, completedCourses: [], missingOptions: [],
  })

  const ldDone = major.lowerDiv.filter((c) => completedCodes.has(c))
  const ldMissing = major.lowerDiv.filter((c) => !completedCodes.has(c))
  const lowerDiv: ReqProgress = {
    id: 'lower-div', name: 'Lower Division', description: 'Required lower-division courses',
    required: major.lowerDiv.length, completed: ldDone.length,
    completedCourses: ldDone, missingOptions: ldMissing.map((c) => [c]),
  }

  const udDone = major.upperDiv.filter((c) => completedCodes.has(c))
  const udMissing = major.upperDiv.filter((c) => !completedCodes.has(c))
  const upperDiv: ReqProgress = {
    id: 'upper-div', name: 'Upper Division', description: 'Required upper-division courses',
    required: major.upperDiv.length, completed: udDone.length,
    completedCourses: udDone, missingOptions: udMissing.map((c) => [c]),
  }

  let electives: ReqProgress | undefined
  if (major.electives) {
    const eDone = major.electives.from.filter((c) => completedCodes.has(c))
    electives = {
      id: 'electives', name: 'Major Electives',
      description: `Pick ${major.electives.pick} from approved list`,
      required: major.electives.pick,
      completed: Math.min(eDone.length, major.electives.pick),
      completedCourses: eDone.slice(0, major.electives.pick),
      missingOptions: eDone.length < major.electives.pick
        ? [major.electives.from.filter((c) => !completedCodes.has(c))]
        : [],
    }
  }

  const totalRequired = ge.reduce((s, g) => s + g.required, 0) + lowerDiv.required + upperDiv.required + (electives?.required || 0)
  const totalCompleted = ge.reduce((s, g) => s + g.completed, 0) + lowerDiv.completed + upperDiv.completed + (electives?.completed || 0)

  return {
    major: majorName,
    isEngineering: major.isEngineering,
    ge,
    lowerDiv,
    upperDiv,
    electives,
    totalCompleted,
    totalRequired,
    overallPct: totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0,
  }
}
