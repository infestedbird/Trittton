// UCSD College GE Requirements + Major Requirements

export interface RequirementGroup {
  id: string
  name: string
  description: string
  courses: string[][] // each inner array is a set of alternatives (complete any ONE from each)
  minCourses: number  // how many from `courses` must be completed
  allowOverlap?: boolean // can overlap with major
}

export interface CollegeDef {
  name: string
  code: string
  ge: RequirementGroup[]
}

export interface MajorDef {
  name: string
  code: string
  isEngineering: boolean
  lowerDiv: string[]   // required lower-div courses
  upperDiv: string[]   // required upper-div courses
  electives?: { pick: number; from: string[] }
}

// ── College GE Definitions ──────────────────────────────────────────────────

export const COLLEGES: Record<string, CollegeDef> = {
  'Revelle': {
    name: 'Revelle College',
    code: 'RE',
    ge: [
      {
        id: 'hum',
        name: 'Humanities (HUM)',
        description: '5-course humanities sequence',
        courses: [['HUM 1'], ['HUM 2'], ['HUM 3'], ['HUM 4'], ['HUM 5']],
        minCourses: 5,
      },
      {
        id: 'math',
        name: 'Mathematics',
        description: 'Calculus sequence or approved alternative',
        courses: [['MATH 20A'], ['MATH 20B'], ['MATH 20C']],
        minCourses: 3,
      },
      {
        id: 'natural-science',
        name: 'Natural Science',
        description: '5 courses in natural sciences (Bio, Chem, Physics)',
        courses: [
          ['BILD 1', 'BILD 2', 'BILD 3', 'BILD 4'],
          ['CHEM 6A', 'CHEM 6B', 'CHEM 6C', 'CHEM 6AH', 'CHEM 6BH', 'CHEM 6CH'],
          ['PHYS 2A', 'PHYS 2B', 'PHYS 2C', 'PHYS 2D'],
        ],
        minCourses: 5,
      },
      {
        id: 'social-science',
        name: 'Social Science',
        description: '2 courses from different departments in social sciences',
        courses: [
          [
            'ANTH 1', 'ANTH 2', 'ANTH 3', 'ANTH 21', 'ANTH 23',
            'COMM 10', 'COMM 100A',
            'ECON 1', 'ECON 2', 'ECON 3', 'ECON 4',
            'LIGN 4', 'LIGN 7', 'LIGN 8',
            'POLI 10', 'POLI 11', 'POLI 12', 'POLI 13',
            'PSYC 1', 'PSYC 2', 'PSYC 3', 'PSYC 4',
            'SOCI 1', 'SOCI 10', 'SOCI 20', 'SOCI 30', 'SOCI 40',
            'USP 1', 'USP 2',
            'COGS 1', 'COGS 3', 'COGS 10',
            'HDP 1',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'fine-arts',
        name: 'Fine Arts',
        description: '1 course in fine arts',
        courses: [
          [
            'MUS 1A', 'MUS 1B', 'MUS 1C', 'MUS 4', 'MUS 5', 'MUS 6', 'MUS 7', 'MUS 8',
            'MUS 9', 'MUS 12', 'MUS 13', 'MUS 14', 'MUS 15', 'MUS 16', 'MUS 17',
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 4', 'VIS 10', 'VIS 20', 'VIS 21', 'VIS 22',
            'THEA 1', 'THEA 2', 'THEA 5', 'THEA 10', 'THEA 11',
            'TDDR 1', 'TDGE 1', 'TDGE 5', 'TDGE 25',
            'TDMV 1', 'TDPW 1',
            'LTEN 27', 'LTEN 28', 'LTEN 29',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'lang',
        name: 'Language',
        description: 'Proficiency in a language other than English',
        courses: [],
        minCourses: 1,
      },
      {
        id: 'aip',
        name: 'American History & Institutions',
        description: 'American history and institutions requirement',
        courses: [
          [
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'HILD 7GS',
            'HIUS 112', 'HIUS 113', 'HIUS 114', 'HIUS 120',
            'POLI 10', 'POLI 11', 'POLI 100', 'POLI 100A',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'One DEI course (university requirement)',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'HILD 7GS', 'HILD 10', 'HILD 12',
            'LIGN 7', 'LIGN 8', 'ANTH 21', 'ANTH 23', 'ANTH 43',
            'COMM 10', 'SOCI 1', 'SOCI 40', 'SOCI 50', 'SOCI 60',
            'USP 1', 'USP 2', 'CGS 2', 'CGS 21', 'CGS 100', 'CGS 105',
            'HDP 1', 'HDP 110', 'PSYC 101', 'PSYC 133',
            'VIS 21', 'VIS 152', 'EDS 25', 'EDS 112', 'EDS 117',
            'GLBH 20', 'GLBH 100',
          ],
        ],
        minCourses: 1,
      },
    ],
  },

  'Muir': {
    name: 'John Muir College',
    code: 'MU',
    ge: [
      {
        id: 'muir-writing',
        name: 'Muir Writing Program',
        description: 'Two writing courses',
        courses: [['MCWP 40'], ['MCWP 50']],
        minCourses: 2,
      },
      {
        id: 'social-science',
        name: 'Social Sciences',
        description: '3 approved courses from social science departments',
        courses: [
          [
            'ANTH 1', 'ANTH 2', 'ANTH 3', 'ANTH 21', 'ANTH 23', 'ANTH 43',
            'COMM 10', 'COMM 100A', 'ECON 1', 'ECON 2', 'ECON 3', 'ECON 4',
            'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20',
            'LIGN 4', 'LIGN 7', 'LIGN 8',
            'POLI 10', 'POLI 11', 'POLI 12', 'POLI 13',
            'PSYC 1', 'PSYC 2', 'PSYC 3', 'PSYC 4',
            'SOCI 1', 'SOCI 10', 'SOCI 20', 'SOCI 30', 'SOCI 40',
            'USP 1', 'USP 2', 'CGS 2', 'CGS 21',
            'COGS 1', 'HDP 1',
          ],
        ],
        minCourses: 3,
      },
      {
        id: 'math-nat-sci',
        name: 'Math or Natural Sciences',
        description: '3 courses in math and/or natural sciences',
        courses: [
          [
            'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11', 'MATH 18',
            'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E',
            'BILD 1', 'BILD 2', 'BILD 3', 'BILD 4',
            'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
            'PHYS 1A', 'PHYS 1B', 'PHYS 1C', 'PHYS 2A', 'PHYS 2B', 'PHYS 2C', 'PHYS 2D',
            'SIO 10', 'SIO 12', 'SIO 15', 'SIO 20', 'SIO 30',
            'ESYS 10', 'ESYS 30',
          ],
        ],
        minCourses: 3,
      },
      {
        id: 'fine-arts',
        name: 'Fine Arts',
        description: '2 courses in the fine arts',
        courses: [
          [
            'MUS 1A', 'MUS 1B', 'MUS 1C', 'MUS 4', 'MUS 5', 'MUS 8', 'MUS 17',
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 4', 'VIS 10', 'VIS 20', 'VIS 21', 'VIS 22',
            'THEA 1', 'THEA 2', 'THEA 5', 'THEA 10', 'THEA 11',
            'TDDR 1', 'TDGE 1', 'TDGE 5', 'TDGE 25',
            'TDMV 1', 'TDPW 1',
            'LTEN 27', 'LTEN 28', 'LTEN 29',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'humanities',
        name: 'Humanities',
        description: '3 courses from the humanities',
        courses: [
          [
            'HILD 2A', 'HILD 2B', 'HILD 2C', 'HILD 7A', 'HILD 7B', 'HILD 7C',
            'HILD 10', 'HILD 12',
            'PHIL 10', 'PHIL 12', 'PHIL 13', 'PHIL 14', 'PHIL 15', 'PHIL 25', 'PHIL 27', 'PHIL 28',
            'PHIL 31', 'PHIL 32', 'PHIL 33',
            'LTEN 21', 'LTEN 22', 'LTEN 23', 'LTEN 25', 'LTEN 26', 'LTEN 27',
            'LTLA 1', 'LTLA 2',
            'HUM 1', 'HUM 2', 'HUM 3', 'HUM 4', 'HUM 5',
            'RELI 1', 'RELI 2', 'RELI 3',
          ],
        ],
        minCourses: 3,
      },
      {
        id: 'lang',
        name: 'Foreign Language',
        description: 'Proficiency in a language other than English',
        courses: [],
        minCourses: 1,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'One DEI course (university requirement)',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'HILD 7GS', 'HILD 10', 'HILD 12',
            'LIGN 7', 'LIGN 8', 'ANTH 21', 'ANTH 23', 'ANTH 43',
            'SOCI 1', 'SOCI 40', 'USP 1', 'USP 2',
            'CGS 2', 'CGS 21', 'CGS 100',
            'HDP 1', 'HDP 110', 'PSYC 101', 'PSYC 133',
            'VIS 21', 'EDS 25', 'GLBH 20',
          ],
        ],
        minCourses: 1,
      },
    ],
  },

  'Marshall': {
    name: 'Thurgood Marshall College',
    code: 'TM',
    ge: [
      {
        id: 'doc',
        name: 'Dimensions of Culture (DOC)',
        description: '3-course DOC sequence',
        courses: [['DOC 1'], ['DOC 2'], ['DOC 3']],
        minCourses: 3,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'Satisfied by DOC 100D or other DEI course',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'HILD 7GS',
            'LIGN 7', 'LIGN 8', 'ANTH 21', 'ANTH 23',
            'SOCI 1', 'SOCI 40', 'USP 1', 'USP 2',
            'CGS 2', 'CGS 21', 'HDP 1', 'HDP 110',
            'PSYC 101', 'VIS 21', 'EDS 25', 'GLBH 20',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'natural-science',
        name: 'Natural Sciences',
        description: '2 courses in natural sciences with at least one lab',
        courses: [
          [
            'BILD 1', 'BILD 2', 'BILD 3', 'BILD 4',
            'CHEM 4', 'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
            'PHYS 1A', 'PHYS 1B', 'PHYS 1C', 'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
            'SIO 10', 'SIO 12', 'SIO 15', 'SIO 20', 'SIO 30',
            'ESYS 10', 'ESYS 30', 'ENVR 30',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'math-stat',
        name: 'Mathematics / Statistics',
        description: '2 courses in math, statistics, or logic',
        courses: [
          [
            'MATH 3C', 'MATH 4C', 'MATH 10A', 'MATH 10B', 'MATH 10C',
            'MATH 11', 'MATH 15A', 'MATH 15B', 'MATH 18',
            'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D',
            'PHIL 10', 'PHIL 12', 'PSYC 60', 'SOCI 60',
            'CSE 3', 'CSE 6R', 'CSE 8A', 'CSE 11',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'humanities',
        name: 'Disciplinary Breadth — Humanities',
        description: '3 courses from humanities',
        courses: [
          [
            'HILD 2A', 'HILD 2B', 'HILD 2C', 'HILD 7A', 'HILD 7B', 'HILD 7C',
            'PHIL 10', 'PHIL 12', 'PHIL 13', 'PHIL 14', 'PHIL 25', 'PHIL 27', 'PHIL 28',
            'LTEN 21', 'LTEN 22', 'LTEN 23', 'LTEN 25', 'LTEN 27',
            'HUM 1', 'HUM 2', 'HUM 3', 'HUM 4', 'HUM 5',
            'RELI 1', 'RELI 2',
          ],
        ],
        minCourses: 3,
      },
      {
        id: 'social-science',
        name: 'Disciplinary Breadth — Social Sciences',
        description: '3 courses from social sciences',
        courses: [
          [
            'ANTH 1', 'ANTH 2', 'ANTH 3', 'ECON 1', 'ECON 2', 'ECON 3',
            'POLI 10', 'POLI 11', 'POLI 12', 'POLI 13',
            'PSYC 1', 'PSYC 2', 'SOCI 1', 'SOCI 10', 'SOCI 20', 'SOCI 30',
            'COMM 10', 'LIGN 4', 'COGS 1', 'HDP 1', 'USP 1',
          ],
        ],
        minCourses: 3,
      },
      {
        id: 'fine-arts',
        name: 'Disciplinary Breadth — Fine Arts',
        description: '1 course in fine arts',
        courses: [
          [
            'MUS 1A', 'MUS 1B', 'MUS 1C', 'MUS 4', 'MUS 5', 'MUS 8',
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 4', 'VIS 10', 'VIS 20', 'VIS 21',
            'THEA 1', 'THEA 2', 'THEA 5', 'THEA 10', 'THEA 11',
            'TDDR 1', 'TDGE 1', 'TDGE 5', 'TDGE 25',
          ],
        ],
        minCourses: 1,
      },
    ],
  },

  'Warren': {
    name: 'Earl Warren College',
    code: 'WA',
    ge: [
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
            'MATH 3C', 'MATH 4C', 'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11', 'MATH 15A', 'MATH 15B',
            'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E', 'MATH 31AH', 'MATH 31BH', 'MATH 31CH',
            'PHIL 10', 'PHIL 12', 'PHIL 15',
            'PSYC 60', 'PSYC 70', 'SOCI 60', 'HDS 60', 'ECON 120A', 'POLI 30', 'POLI 30D',
            'CSE 3', 'CSE 5A', 'CSE 6R', 'CSE 8A', 'CSE 8B', 'CSE 11', 'CSE 12',
            'COGS 3', 'COGS 8', 'COGS 14A', 'COGS 14B', 'COGS 18',
            'DSC 10', 'DSC 20', 'DSC 30',
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
        id: 'poc',
        name: 'Programs of Concentration',
        description: '2 areas of 6 courses each (3 for engineering) outside your major',
        courses: [],
        minCourses: 12,
      },
    ],
  },

  'ERC': {
    name: 'Eleanor Roosevelt College',
    code: 'ER',
    ge: [
      {
        id: 'mmc',
        name: 'Making of the Modern World (MMW)',
        description: '5-course MMW sequence',
        courses: [['MMW 11'], ['MMW 12'], ['MMW 13'], ['MMW 14'], ['MMW 15']],
        minCourses: 5,
      },
      {
        id: 'regional-specialization',
        name: 'Regional Specialization',
        description: '5 upper-division courses in a geographic/cultural area',
        courses: [],
        minCourses: 5,
      },
      {
        id: 'quant',
        name: 'Quantitative & Formal Skills',
        description: '1 course in math, logic, statistics, or programming',
        courses: [
          [
            'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11', 'MATH 18',
            'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D',
            'CSE 3', 'CSE 5A', 'CSE 6R', 'CSE 8A', 'CSE 11',
            'PHIL 10', 'PHIL 12', 'PSYC 60', 'SOCI 60',
            'DSC 10', 'COGS 14A', 'ECON 120A',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'natural-science',
        name: 'Natural Sciences',
        description: '2 courses in natural sciences',
        courses: [
          [
            'BILD 1', 'BILD 2', 'BILD 3',
            'CHEM 4', 'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
            'PHYS 1A', 'PHYS 1B', 'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
            'SIO 10', 'SIO 12', 'SIO 15', 'SIO 20', 'SIO 30',
            'ESYS 10', 'ESYS 30',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'fine-arts',
        name: 'Fine Arts',
        description: '1 course in fine arts',
        courses: [
          [
            'MUS 1A', 'MUS 1B', 'MUS 1C', 'MUS 4', 'MUS 5', 'MUS 8',
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 10', 'VIS 20', 'VIS 21',
            'THEA 1', 'THEA 2', 'THEA 10', 'TDGE 1', 'TDGE 25',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'lang',
        name: 'Foreign Language',
        description: 'Proficiency through 3rd quarter of a language',
        courses: [],
        minCourses: 1,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'One DEI course (university requirement)',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'LIGN 7', 'LIGN 8',
            'ANTH 21', 'ANTH 23', 'SOCI 1', 'SOCI 40',
            'USP 1', 'USP 2', 'CGS 2', 'CGS 21',
            'HDP 1', 'VIS 21', 'EDS 25', 'GLBH 20',
          ],
        ],
        minCourses: 1,
      },
    ],
  },

  'Sixth': {
    name: 'Sixth College',
    code: 'SX',
    ge: [
      {
        id: 'cat',
        name: 'Culture, Art & Technology (CAT)',
        description: '3-course CAT sequence',
        courses: [['CAT 1'], ['CAT 2'], ['CAT 3']],
        minCourses: 3,
      },
      {
        id: 'cat-125',
        name: 'CAT 125',
        description: 'CAT practicum',
        courses: [['CAT 125']],
        minCourses: 1,
      },
      {
        id: 'art-making',
        name: 'Art Making',
        description: '1 art-making course',
        courses: [
          [
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 4', 'VIS 10', 'VIS 20', 'VIS 21',
            'MUS 1A', 'MUS 4', 'MUS 5', 'MUS 8',
            'THEA 1', 'THEA 2', 'TDDR 1', 'TDMV 1',
            'TDGE 1', 'TDGE 5', 'TDGE 25', 'TDPW 1',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'info-tech',
        name: 'Algorithmic/Computational Thinking',
        description: '2 courses in computing or algorithmic thinking',
        courses: [
          [
            'CSE 3', 'CSE 5A', 'CSE 6R', 'CSE 8A', 'CSE 8B', 'CSE 11', 'CSE 12',
            'COGS 3', 'COGS 18', 'DSC 10', 'DSC 20',
            'ECE 15', 'MAE 8',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'social-analysis',
        name: 'Narratives / Social Analysis',
        description: '2 courses in social analysis or narratives',
        courses: [
          [
            'ANTH 1', 'ANTH 2', 'ANTH 3', 'COMM 10',
            'ECON 1', 'ECON 2', 'ETHN 1', 'ETHN 2', 'ETHN 3',
            'POLI 10', 'POLI 11', 'POLI 12',
            'PSYC 1', 'PSYC 2', 'SOCI 1', 'SOCI 10', 'SOCI 20',
            'USP 1', 'USP 2', 'HDP 1', 'COGS 1',
            'HILD 2A', 'HILD 7A', 'HILD 7B', 'HILD 7C',
            'PHIL 10', 'PHIL 25', 'PHIL 27', 'PHIL 28',
            'LTEN 21', 'LTEN 22', 'LTEN 23',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'natural-world',
        name: 'Exploring the Natural World',
        description: '2 courses in natural science',
        courses: [
          [
            'BILD 1', 'BILD 2', 'BILD 3',
            'CHEM 4', 'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
            'PHYS 1A', 'PHYS 1B', 'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
            'SIO 10', 'SIO 12', 'SIO 15', 'SIO 20',
            'ESYS 10', 'ESYS 30',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'One DEI course (university requirement)',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'LIGN 7', 'LIGN 8',
            'ANTH 21', 'ANTH 23', 'SOCI 1', 'SOCI 40',
            'USP 1', 'USP 2', 'CGS 2', 'HDP 1',
            'VIS 21', 'EDS 25', 'GLBH 20',
          ],
        ],
        minCourses: 1,
      },
    ],
  },

  'Seventh': {
    name: 'Seventh College',
    code: 'SV',
    ge: [
      {
        id: 'synthesis',
        name: 'Synthesis',
        description: '2-course writing sequence',
        courses: [['SYN 1'], ['SYN 2']],
        minCourses: 2,
      },
      {
        id: 'syn-100',
        name: 'Synthesis Practicum',
        description: 'Senior synthesis project',
        courses: [['SYN 100']],
        minCourses: 1,
      },
      {
        id: 'exploring-data',
        name: 'Exploring Data',
        description: '1 data-focused course',
        courses: [
          [
            'DSC 10', 'CSE 6R', 'CSE 8A', 'CSE 11', 'COGS 14A', 'COGS 18',
            'MATH 11', 'PSYC 60', 'SOCI 60', 'ECON 120A', 'POLI 30',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'change-collab',
        name: 'Changemaking & Collaboration',
        description: '1 course in changemaking',
        courses: [
          [
            'USP 1', 'USP 2', 'COMM 10', 'POLI 10', 'POLI 11',
            'SOCI 1', 'SOCI 10', 'ANTH 1', 'ANTH 2',
            'HDP 1', 'GLBH 20', 'EDS 25',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'arts-humanities',
        name: 'Arts & Humanities',
        description: '2 courses in arts and/or humanities',
        courses: [
          [
            'MUS 1A', 'MUS 1B', 'MUS 4', 'MUS 5', 'MUS 8',
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 10', 'VIS 20', 'VIS 21',
            'THEA 1', 'THEA 2', 'TDGE 1', 'TDGE 25',
            'HILD 2A', 'HILD 7A', 'HILD 7B', 'HILD 7C',
            'PHIL 10', 'PHIL 25', 'PHIL 27', 'PHIL 28',
            'LTEN 21', 'LTEN 22', 'LTEN 27',
            'HUM 1', 'HUM 2', 'HUM 3', 'HUM 4', 'HUM 5',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'natural-science',
        name: 'Natural Sciences',
        description: '2 courses in natural science',
        courses: [
          [
            'BILD 1', 'BILD 2', 'BILD 3',
            'CHEM 4', 'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
            'PHYS 1A', 'PHYS 1B', 'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
            'SIO 10', 'SIO 12', 'ESYS 10',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'social-science',
        name: 'Social Sciences',
        description: '2 courses in social science',
        courses: [
          [
            'ANTH 1', 'ECON 1', 'ECON 2', 'POLI 10', 'POLI 11',
            'PSYC 1', 'PSYC 2', 'SOCI 1', 'SOCI 10',
            'COMM 10', 'COGS 1', 'LIGN 4', 'HDP 1', 'USP 1',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'One DEI course (university requirement)',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'LIGN 7', 'LIGN 8',
            'ANTH 21', 'ANTH 23', 'SOCI 1', 'SOCI 40',
            'USP 1', 'USP 2', 'CGS 2', 'HDP 1',
            'VIS 21', 'EDS 25', 'GLBH 20',
          ],
        ],
        minCourses: 1,
      },
    ],
  },

  'Eighth': {
    name: 'Eighth College',
    code: 'EI',
    ge: [
      {
        id: 'engage',
        name: 'Engagement',
        description: '2-course Eighth writing/engagement sequence',
        courses: [['EIGHTH 1'], ['EIGHTH 2']],
        minCourses: 2,
      },
      {
        id: 'engage-practicum',
        name: 'Engagement Practicum',
        description: 'Senior engagement project',
        courses: [['EIGHTH 100']],
        minCourses: 1,
      },
      {
        id: 'quant-reasoning',
        name: 'Quantitative Reasoning',
        description: '1 course in math, stats, programming, or logic',
        courses: [
          [
            'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11', 'MATH 18',
            'MATH 20A', 'MATH 20B', 'MATH 20C',
            'CSE 3', 'CSE 5A', 'CSE 8A', 'CSE 11', 'DSC 10',
            'PHIL 10', 'PHIL 12', 'PSYC 60', 'SOCI 60',
            'COGS 14A', 'ECON 120A',
          ],
        ],
        minCourses: 1,
      },
      {
        id: 'arts-humanities',
        name: 'Arts & Humanities',
        description: '2 courses in arts and/or humanities',
        courses: [
          [
            'MUS 1A', 'MUS 4', 'MUS 5', 'MUS 8',
            'VIS 1', 'VIS 2', 'VIS 3', 'VIS 10', 'VIS 20', 'VIS 21',
            'THEA 1', 'THEA 2', 'TDGE 1', 'TDGE 25',
            'HILD 2A', 'HILD 7A', 'HILD 7B', 'HILD 7C',
            'PHIL 10', 'PHIL 25', 'PHIL 27', 'PHIL 28',
            'LTEN 21', 'LTEN 22', 'LTEN 27',
            'HUM 1', 'HUM 2', 'HUM 3', 'HUM 4', 'HUM 5',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'natural-science',
        name: 'Natural Sciences',
        description: '2 courses in natural science',
        courses: [
          [
            'BILD 1', 'BILD 2', 'BILD 3',
            'CHEM 4', 'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
            'PHYS 1A', 'PHYS 1B', 'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
            'SIO 10', 'SIO 12', 'ESYS 10',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'social-science',
        name: 'Social Sciences',
        description: '2 courses in social science',
        courses: [
          [
            'ANTH 1', 'ECON 1', 'ECON 2', 'POLI 10', 'POLI 11',
            'PSYC 1', 'PSYC 2', 'SOCI 1', 'SOCI 10',
            'COMM 10', 'COGS 1', 'LIGN 4', 'HDP 1', 'USP 1',
          ],
        ],
        minCourses: 2,
      },
      {
        id: 'dei',
        name: 'Diversity, Equity & Inclusion',
        description: 'One DEI course (university requirement)',
        courses: [
          [
            'DOC 100D', 'ETHN 1', 'ETHN 2', 'ETHN 3', 'ETHN 20', 'ETHN 40',
            'HILD 7A', 'HILD 7B', 'HILD 7C', 'LIGN 7', 'LIGN 8',
            'ANTH 21', 'ANTH 23', 'SOCI 1', 'SOCI 40',
            'USP 1', 'USP 2', 'CGS 2', 'HDP 1',
            'VIS 21', 'EDS 25', 'GLBH 20',
          ],
        ],
        minCourses: 1,
      },
    ],
  },
}

export const COLLEGE_NAMES = Object.keys(COLLEGES)

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
  'Mechanical Engineering': {
    name: 'Mechanical Engineering',
    code: 'ME',
    isEngineering: true,
    lowerDiv: [
      'MAE 2', 'MAE 3', 'MAE 8', 'MAE 21',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C', 'PHYS 2D',
      'CHEM 6A', 'CHEM 6B',
    ],
    upperDiv: [
      'MAE 101A', 'MAE 101B', 'MAE 101C',
      'MAE 105', 'MAE 107', 'MAE 110A', 'MAE 110B',
      'MAE 130A', 'MAE 130B', 'MAE 131A', 'MAE 131B',
      'MAE 143A', 'MAE 143B', 'MAE 150', 'MAE 160',
      'MAE 170',
    ],
    electives: {
      pick: 3,
      from: [
        'MAE 101D', 'MAE 104', 'MAE 106', 'MAE 108',
        'MAE 113', 'MAE 119', 'MAE 120',
        'MAE 126A', 'MAE 126B', 'MAE 131C',
        'MAE 140', 'MAE 142', 'MAE 143C',
        'MAE 152', 'MAE 155', 'MAE 156A', 'MAE 156B',
        'MAE 160', 'MAE 165', 'MAE 166',
        'MAE 171A', 'MAE 171B', 'MAE 175A', 'MAE 175B',
      ],
    },
  },
  'Aerospace Engineering': {
    name: 'Aerospace Engineering',
    code: 'AE',
    isEngineering: true,
    lowerDiv: [
      'MAE 2', 'MAE 3', 'MAE 8', 'MAE 21',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C', 'PHYS 2D',
      'CHEM 6A',
    ],
    upperDiv: [
      'MAE 101A', 'MAE 101B',
      'MAE 105', 'MAE 107', 'MAE 110A', 'MAE 110B',
      'MAE 130A', 'MAE 130B', 'MAE 143A', 'MAE 143B',
      'MAE 150', 'MAE 160',
      'MAE 125', 'MAE 126A', 'MAE 126B', 'MAE 170',
    ],
    electives: {
      pick: 3,
      from: [
        'MAE 101C', 'MAE 104', 'MAE 113', 'MAE 119', 'MAE 120',
        'MAE 131A', 'MAE 131B', 'MAE 142',
        'MAE 155', 'MAE 156A', 'MAE 156B',
        'MAE 165', 'MAE 166', 'MAE 171A', 'MAE 171B',
      ],
    },
  },
  'Structural Engineering': {
    name: 'Structural Engineering',
    code: 'SE',
    isEngineering: true,
    lowerDiv: [
      'SE 1', 'SE 2', 'SE 3',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
      'CHEM 6A',
      'MAE 8', 'MAE 21',
    ],
    upperDiv: [
      'SE 101A', 'SE 101B', 'SE 101C',
      'SE 103', 'SE 104', 'SE 110A', 'SE 110B',
      'SE 115', 'SE 120A', 'SE 120B',
      'SE 130A', 'SE 130B',
      'SE 140', 'SE 150A', 'SE 150B',
      'SE 160A', 'SE 160B',
      'SE 181',
    ],
    electives: {
      pick: 2,
      from: [
        'SE 125', 'SE 131', 'SE 141', 'SE 142', 'SE 143',
        'SE 151', 'SE 152', 'SE 155', 'SE 161',
        'SE 164', 'SE 165', 'SE 166', 'SE 167',
        'SE 168', 'SE 170', 'SE 171',
      ],
    },
  },
  'Bioengineering': {
    name: 'Bioengineering',
    code: 'BE',
    isEngineering: true,
    lowerDiv: [
      'BENG 1', 'BENG 87A', 'BENG 87B',
      'BILD 1',
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D', 'MATH 20E',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
    ],
    upperDiv: [
      'BENG 100', 'BENG 103', 'BENG 105', 'BENG 108',
      'BENG 110', 'BENG 112A', 'BENG 112B',
      'BENG 125', 'BENG 130', 'BENG 140A', 'BENG 140B',
      'BENG 186A', 'BENG 186B', 'BENG 187A', 'BENG 187B',
      'BENG 187C', 'BENG 187D',
    ],
    electives: {
      pick: 3,
      from: [
        'BENG 110', 'BENG 120', 'BENG 122A', 'BENG 122B',
        'BENG 123', 'BENG 133', 'BENG 134', 'BENG 135',
        'BENG 140A', 'BENG 140B', 'BENG 141', 'BENG 143',
        'BENG 150', 'BENG 152', 'BENG 168', 'BENG 172',
        'BENG 175', 'BENG 176', 'BENG 186B',
      ],
    },
  },
  'Chemical Engineering': {
    name: 'Chemical Engineering',
    code: 'CHE',
    isEngineering: true,
    lowerDiv: [
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C', 'CHEM 7L',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
      'MAE 8',
    ],
    upperDiv: [
      'CENG 100', 'CENG 101A', 'CENG 101B', 'CENG 101C',
      'CENG 102', 'CENG 113', 'CENG 114A', 'CENG 114B',
      'CENG 120', 'CENG 122', 'CENG 124',
      'CENG 176A', 'CENG 176B',
    ],
    electives: {
      pick: 3,
      from: [
        'CENG 107', 'CENG 108', 'CENG 109', 'CENG 110', 'CENG 111',
        'CENG 112', 'CENG 115', 'CENG 116', 'CENG 117',
        'CENG 119', 'CENG 125', 'CENG 127', 'CENG 128',
        'CENG 160', 'CENG 170', 'CENG 175', 'CENG 176C',
      ],
    },
  },
  'NanoEngineering': {
    name: 'NanoEngineering',
    code: 'NE',
    isEngineering: true,
    lowerDiv: [
      'NANO 1', 'NANO 4',
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 20D',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
      'MAE 8',
    ],
    upperDiv: [
      'NANO 101', 'NANO 102', 'NANO 103', 'NANO 104',
      'NANO 106', 'NANO 107', 'NANO 108',
      'NANO 110', 'NANO 111', 'NANO 112',
      'NANO 114', 'NANO 120A', 'NANO 120B',
      'NANO 174',
    ],
    electives: {
      pick: 3,
      from: [
        'NANO 115', 'NANO 116', 'NANO 117', 'NANO 118',
        'NANO 120C', 'NANO 134', 'NANO 141A', 'NANO 141B',
        'NANO 146', 'NANO 148', 'NANO 150', 'NANO 156',
        'NANO 158', 'NANO 161', 'NANO 164', 'NANO 168',
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
  'Mathematics - Computer Science': {
    name: 'Mathematics - Computer Science',
    code: 'MC',
    isEngineering: false,
    lowerDiv: [
      'CSE 11', 'CSE 12', 'CSE 15', 'CSE 20', 'CSE 21', 'CSE 30',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C', 'MATH 109',
    ],
    upperDiv: [
      'CSE 100', 'CSE 101', 'CSE 105',
      'MATH 100A', 'MATH 100B',
      'MATH 170A', 'MATH 170B',
      'MATH 184',
    ],
    electives: {
      pick: 6,
      from: [
        'CSE 107', 'CSE 110', 'CSE 120', 'CSE 123', 'CSE 124', 'CSE 127', 'CSE 130',
        'CSE 131', 'CSE 132A', 'CSE 140', 'CSE 141', 'CSE 150A', 'CSE 150B',
        'CSE 151A', 'CSE 151B', 'CSE 152A', 'CSE 156', 'CSE 158', 'CSE 167',
        'MATH 100C', 'MATH 101A', 'MATH 101B', 'MATH 102',
        'MATH 103A', 'MATH 103B', 'MATH 104A', 'MATH 104B',
        'MATH 110A', 'MATH 110B', 'MATH 111A',
        'MATH 120A', 'MATH 120B', 'MATH 130', 'MATH 140A', 'MATH 140B',
        'MATH 150A', 'MATH 150B', 'MATH 152', 'MATH 154',
        'MATH 155A', 'MATH 155B', 'MATH 158',
        'MATH 160A', 'MATH 160B', 'MATH 168',
        'MATH 170C', 'MATH 171A', 'MATH 171B',
        'MATH 173A', 'MATH 173B', 'MATH 174', 'MATH 175',
        'MATH 180A', 'MATH 180B', 'MATH 180C',
        'MATH 181A', 'MATH 181B', 'MATH 183', 'MATH 185', 'MATH 187A', 'MATH 189',
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
  'Biology (General)': {
    name: 'Biology (General)',
    code: 'BI',
    isEngineering: false,
    lowerDiv: [
      'BILD 1', 'BILD 2', 'BILD 3', 'BILD 4',
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C', 'CHEM 7L',
      'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11',
      'PHYS 1A', 'PHYS 1B', 'PHYS 1C',
    ],
    upperDiv: [
      'BICD 100', 'BICD 110',
      'BIEB 100', 'BIEB 150',
      'BIMM 100', 'BIMM 101',
    ],
    electives: {
      pick: 6,
      from: [
        'BICD 102', 'BICD 120', 'BICD 130', 'BICD 134', 'BICD 140',
        'BIEB 102', 'BIEB 110', 'BIEB 120', 'BIEB 126', 'BIEB 128', 'BIEB 130', 'BIEB 140',
        'BIEB 150', 'BIEB 166', 'BIEB 170', 'BIEB 174', 'BIEB 176',
        'BIMM 110', 'BIMM 112', 'BIMM 114', 'BIMM 116', 'BIMM 118', 'BIMM 120',
        'BIMM 121', 'BIMM 122', 'BIMM 130', 'BIMM 132', 'BIMM 134', 'BIMM 140', 'BIMM 143',
        'BIPN 100', 'BIPN 102', 'BIPN 104', 'BIPN 105', 'BIPN 106', 'BIPN 108', 'BIPN 134',
        'BIPN 140', 'BIPN 142', 'BIPN 144', 'BIPN 146', 'BIPN 148',
      ],
    },
  },
  'Biochemistry': {
    name: 'Biochemistry',
    code: 'BC',
    isEngineering: false,
    lowerDiv: [
      'BILD 1', 'BILD 4',
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C', 'CHEM 7L',
      'CHEM 40A', 'CHEM 40B', 'CHEM 40C', 'CHEM 43A',
      'MATH 10A', 'MATH 10B', 'MATH 10C',
      'PHYS 1A', 'PHYS 1B', 'PHYS 1C',
    ],
    upperDiv: [
      'CHEM 114A', 'CHEM 114B', 'CHEM 114C',
      'CHEM 108', 'CHEM 112A', 'CHEM 113',
      'BICD 100', 'BIMM 100',
    ],
    electives: {
      pick: 3,
      from: [
        'CHEM 105A', 'CHEM 105B', 'CHEM 112B', 'CHEM 114D',
        'CHEM 115', 'CHEM 116', 'CHEM 117', 'CHEM 120A', 'CHEM 120B',
        'CHEM 126', 'CHEM 127', 'CHEM 130', 'CHEM 131', 'CHEM 132', 'CHEM 135',
        'BIMM 101', 'BIMM 110', 'BIMM 112', 'BIMM 114', 'BIMM 120',
        'BICD 110', 'BICD 120', 'BICD 130', 'BICD 134',
      ],
    },
  },
  'Chemistry': {
    name: 'Chemistry',
    code: 'CH',
    isEngineering: false,
    lowerDiv: [
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C', 'CHEM 7L',
      'CHEM 40A', 'CHEM 40B', 'CHEM 40C', 'CHEM 43A',
      'MATH 18', 'MATH 20A', 'MATH 20B', 'MATH 20C',
      'PHYS 2A', 'PHYS 2B', 'PHYS 2C',
    ],
    upperDiv: [
      'CHEM 100A', 'CHEM 100B', 'CHEM 100C',
      'CHEM 105A', 'CHEM 105B',
      'CHEM 108', 'CHEM 112A', 'CHEM 113',
      'CHEM 120A', 'CHEM 120B',
      'CHEM 126', 'CHEM 127',
    ],
    electives: {
      pick: 3,
      from: [
        'CHEM 112B', 'CHEM 114A', 'CHEM 114B', 'CHEM 114C', 'CHEM 114D',
        'CHEM 115', 'CHEM 116', 'CHEM 117',
        'CHEM 130', 'CHEM 131', 'CHEM 132', 'CHEM 135',
        'CHEM 140A', 'CHEM 140B', 'CHEM 140C',
        'CHEM 143A', 'CHEM 143B', 'CHEM 143C',
        'CHEM 150', 'CHEM 151', 'CHEM 152', 'CHEM 155',
        'CHEM 164', 'CHEM 165', 'CHEM 167', 'CHEM 168',
      ],
    },
  },
  'Economics': {
    name: 'Economics',
    code: 'EC',
    isEngineering: false,
    lowerDiv: [
      'ECON 1', 'ECON 2', 'ECON 3', 'ECON 4',
      'MATH 10A', 'MATH 10B', 'MATH 10C', 'MATH 11',
    ],
    upperDiv: [
      'ECON 100A', 'ECON 100B', 'ECON 100C',
      'ECON 120A', 'ECON 120B', 'ECON 120C',
    ],
    electives: {
      pick: 7,
      from: [
        'ECON 101', 'ECON 105', 'ECON 107', 'ECON 109',
        'ECON 110A', 'ECON 110B', 'ECON 111', 'ECON 112',
        'ECON 113', 'ECON 114', 'ECON 116', 'ECON 117',
        'ECON 118', 'ECON 119', 'ECON 121', 'ECON 122',
        'ECON 125', 'ECON 130', 'ECON 131', 'ECON 132',
        'ECON 135', 'ECON 136', 'ECON 138', 'ECON 139',
        'ECON 140', 'ECON 141', 'ECON 142', 'ECON 143',
        'ECON 144', 'ECON 150', 'ECON 152', 'ECON 155',
        'ECON 170A', 'ECON 170B', 'ECON 171', 'ECON 172A', 'ECON 172B',
        'ECON 173', 'ECON 175', 'ECON 178', 'ECON 180',
      ],
    },
  },
  'Political Science': {
    name: 'Political Science',
    code: 'PO',
    isEngineering: false,
    lowerDiv: [
      'POLI 10', 'POLI 11', 'POLI 12', 'POLI 13',
      'POLI 30', 'POLI 30D',
    ],
    upperDiv: [
      'POLI 100', 'POLI 100A', 'POLI 100DA',
      'POLI 101', 'POLI 102',
    ],
    electives: {
      pick: 8,
      from: [
        'POLI 103', 'POLI 104', 'POLI 105', 'POLI 106', 'POLI 107',
        'POLI 108', 'POLI 109', 'POLI 110',
        'POLI 113', 'POLI 114', 'POLI 116', 'POLI 117',
        'POLI 120A', 'POLI 120B', 'POLI 120C', 'POLI 120D', 'POLI 120E',
        'POLI 120F', 'POLI 120G', 'POLI 120H', 'POLI 120I', 'POLI 120J',
        'POLI 130', 'POLI 131', 'POLI 132', 'POLI 134',
        'POLI 140', 'POLI 142', 'POLI 143',
        'POLI 150A', 'POLI 150B', 'POLI 150C',
        'POLI 160AA', 'POLI 160AB', 'POLI 160AC',
      ],
    },
  },
  'Psychology': {
    name: 'Psychology',
    code: 'PY',
    isEngineering: false,
    lowerDiv: [
      'PSYC 1', 'PSYC 2', 'PSYC 3', 'PSYC 4',
      'PSYC 60', 'PSYC 70',
      'MATH 11',
    ],
    upperDiv: [
      'PSYC 100', 'PSYC 101', 'PSYC 102',
      'PSYC 104', 'PSYC 105', 'PSYC 106',
    ],
    electives: {
      pick: 5,
      from: [
        'PSYC 103', 'PSYC 108', 'PSYC 109', 'PSYC 111', 'PSYC 112',
        'PSYC 113', 'PSYC 114', 'PSYC 116', 'PSYC 117', 'PSYC 118',
        'PSYC 120', 'PSYC 121', 'PSYC 125', 'PSYC 126', 'PSYC 129',
        'PSYC 130', 'PSYC 131', 'PSYC 132', 'PSYC 133', 'PSYC 134',
        'PSYC 135', 'PSYC 137', 'PSYC 138', 'PSYC 140', 'PSYC 141',
        'PSYC 143', 'PSYC 145', 'PSYC 147', 'PSYC 148', 'PSYC 149',
        'PSYC 150', 'PSYC 152', 'PSYC 153', 'PSYC 154', 'PSYC 155',
        'PSYC 159', 'PSYC 160', 'PSYC 161', 'PSYC 162', 'PSYC 163',
        'PSYC 164', 'PSYC 170', 'PSYC 171', 'PSYC 172', 'PSYC 179',
        'PSYC 181', 'PSYC 182', 'PSYC 186', 'PSYC 188', 'PSYC 190', 'PSYC 191',
      ],
    },
  },
  'Sociology': {
    name: 'Sociology',
    code: 'SO',
    isEngineering: false,
    lowerDiv: [
      'SOCI 1', 'SOCI 10', 'SOCI 20', 'SOCI 30', 'SOCI 40',
      'SOCI 50', 'SOCI 60',
    ],
    upperDiv: [
      'SOCI 100', 'SOCI 101', 'SOCI 102',
    ],
    electives: {
      pick: 8,
      from: [
        'SOCI 103A', 'SOCI 103B', 'SOCI 103D', 'SOCI 103E', 'SOCI 103F',
        'SOCI 104', 'SOCI 105', 'SOCI 106', 'SOCI 107', 'SOCI 108',
        'SOCI 109', 'SOCI 110', 'SOCI 111', 'SOCI 112', 'SOCI 113',
        'SOCI 114', 'SOCI 115', 'SOCI 116', 'SOCI 117', 'SOCI 118',
        'SOCI 119', 'SOCI 120', 'SOCI 121', 'SOCI 122', 'SOCI 125',
        'SOCI 126', 'SOCI 127', 'SOCI 128', 'SOCI 129', 'SOCI 130',
        'SOCI 131', 'SOCI 132', 'SOCI 133', 'SOCI 134',
        'SOCI 136', 'SOCI 137', 'SOCI 138', 'SOCI 139',
        'SOCI 140', 'SOCI 145', 'SOCI 148', 'SOCI 149',
        'SOCI 150', 'SOCI 153', 'SOCI 155', 'SOCI 157', 'SOCI 159',
        'SOCI 160', 'SOCI 162', 'SOCI 163', 'SOCI 164', 'SOCI 168',
        'SOCI 170', 'SOCI 171', 'SOCI 175', 'SOCI 180', 'SOCI 185', 'SOCI 188',
        'SOCI 190', 'SOCI 195', 'SOCI 196', 'SOCI 197', 'SOCI 198', 'SOCI 199',
      ],
    },
  },
  'Communication': {
    name: 'Communication',
    code: 'CM',
    isEngineering: false,
    lowerDiv: [
      'COMM 10', 'COMM 100A',
      'MATH 11',
    ],
    upperDiv: [
      'COMM 101', 'COMM 102C', 'COMM 103',
      'COMM 104D', 'COMM 106D',
    ],
    electives: {
      pick: 7,
      from: [
        'COMM 100B', 'COMM 102A', 'COMM 102B', 'COMM 104A', 'COMM 104B',
        'COMM 105', 'COMM 106A', 'COMM 106B', 'COMM 106C',
        'COMM 107', 'COMM 108', 'COMM 109',
        'COMM 110', 'COMM 111', 'COMM 112', 'COMM 113',
        'COMM 114A', 'COMM 114B', 'COMM 114C',
        'COMM 116', 'COMM 117', 'COMM 118',
        'COMM 120', 'COMM 121', 'COMM 122', 'COMM 124',
        'COMM 130', 'COMM 131', 'COMM 132', 'COMM 134',
        'COMM 140', 'COMM 145', 'COMM 150',
        'COMM 155', 'COMM 160', 'COMM 162', 'COMM 165', 'COMM 170',
        'COMM 175', 'COMM 180', 'COMM 190',
      ],
    },
  },
  'Linguistics': {
    name: 'Linguistics',
    code: 'LI',
    isEngineering: false,
    lowerDiv: [
      'LIGN 4', 'LIGN 6', 'LIGN 7', 'LIGN 8', 'LIGN 17',
      'LIGN 101',
    ],
    upperDiv: [
      'LIGN 110', 'LIGN 111', 'LIGN 115', 'LIGN 120', 'LIGN 121',
    ],
    electives: {
      pick: 5,
      from: [
        'LIGN 105', 'LIGN 112', 'LIGN 113', 'LIGN 119',
        'LIGN 130', 'LIGN 138', 'LIGN 140', 'LIGN 143',
        'LIGN 145', 'LIGN 148', 'LIGN 150', 'LIGN 154',
        'LIGN 160', 'LIGN 165', 'LIGN 167', 'LIGN 168',
        'LIGN 170', 'LIGN 171', 'LIGN 172', 'LIGN 174', 'LIGN 175', 'LIGN 176',
        'LIGN 178', 'LIGN 180',
      ],
    },
  },
  'Human Biology': {
    name: 'Human Biology',
    code: 'HB',
    isEngineering: false,
    lowerDiv: [
      'BILD 1', 'BILD 2', 'BILD 3',
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C', 'CHEM 7L',
      'MATH 10A', 'MATH 10B', 'MATH 11',
      'PHYS 1A', 'PHYS 1B',
    ],
    upperDiv: [
      'BICD 100', 'BIMM 100',
      'BIPN 100', 'BIPN 102',
      'HDP 110', 'HDP 120', 'HDP 171',
    ],
    electives: {
      pick: 4,
      from: [
        'BIPN 104', 'BIPN 105', 'BIPN 106', 'BIPN 108',
        'BIPN 134', 'BIPN 140', 'BIPN 142', 'BIPN 144', 'BIPN 146', 'BIPN 148',
        'BICD 110', 'BICD 120', 'BICD 130', 'BICD 134',
        'BIMM 101', 'BIMM 110', 'BIMM 112', 'BIMM 114', 'BIMM 120',
        'HDP 100', 'HDP 111', 'HDP 115', 'HDP 135', 'HDP 150', 'HDP 175',
        'PSYC 100', 'PSYC 102', 'PSYC 106',
      ],
    },
  },
  'International Studies': {
    name: 'International Studies',
    code: 'IS',
    isEngineering: false,
    lowerDiv: [
      'INTL 101', 'INTL 102', 'INTL 103',
      'ECON 1', 'ECON 2',
      'POLI 11', 'POLI 12', 'POLI 13',
    ],
    upperDiv: [
      'INTL 130', 'INTL 140', 'INTL 150', 'INTL 160',
    ],
    electives: {
      pick: 5,
      from: [
        'INTL 105', 'INTL 111', 'INTL 113', 'INTL 121',
        'INTL 131', 'INTL 132', 'INTL 133', 'INTL 141', 'INTL 142',
        'INTL 151', 'INTL 152', 'INTL 153', 'INTL 155',
        'INTL 161', 'INTL 162', 'INTL 163', 'INTL 164', 'INTL 165',
        'INTL 170', 'INTL 171', 'INTL 172', 'INTL 173', 'INTL 175',
        'POLI 120A', 'POLI 120B', 'POLI 120C', 'POLI 120D',
        'ECON 110A', 'ECON 111', 'ECON 130',
      ],
    },
  },
  'Philosophy': {
    name: 'Philosophy',
    code: 'PL',
    isEngineering: false,
    lowerDiv: [
      'PHIL 10', 'PHIL 12', 'PHIL 13', 'PHIL 14',
      'PHIL 25', 'PHIL 27', 'PHIL 28',
    ],
    upperDiv: [
      'PHIL 100', 'PHIL 101', 'PHIL 102',
      'PHIL 108', 'PHIL 110',
    ],
    electives: {
      pick: 5,
      from: [
        'PHIL 103', 'PHIL 104', 'PHIL 105', 'PHIL 106',
        'PHIL 112', 'PHIL 113', 'PHIL 115', 'PHIL 120',
        'PHIL 121', 'PHIL 122', 'PHIL 125', 'PHIL 130',
        'PHIL 135', 'PHIL 140', 'PHIL 145', 'PHIL 148',
        'PHIL 150', 'PHIL 155', 'PHIL 160', 'PHIL 162',
        'PHIL 164', 'PHIL 165', 'PHIL 166', 'PHIL 170',
        'PHIL 175', 'PHIL 176', 'PHIL 178', 'PHIL 180',
        'PHIL 185', 'PHIL 190',
      ],
    },
  },
  'History': {
    name: 'History',
    code: 'HI',
    isEngineering: false,
    lowerDiv: [
      'HILD 2A', 'HILD 2B', 'HILD 2C',
      'HILD 7A', 'HILD 7B', 'HILD 7C',
    ],
    upperDiv: [
      'HIAF 111', 'HIEU 130',
      'HILA 121',
    ],
    electives: {
      pick: 8,
      from: [
        'HIAF 100', 'HIAF 101', 'HIAF 110', 'HIAF 111', 'HIAF 112',
        'HIEA 100', 'HIEA 110', 'HIEA 115', 'HIEA 120', 'HIEA 121',
        'HIEU 100', 'HIEU 102', 'HIEU 104', 'HIEU 108', 'HIEU 110',
        'HIEU 115', 'HIEU 120', 'HIEU 125', 'HIEU 130', 'HIEU 131',
        'HIEU 136', 'HIEU 140', 'HIEU 142', 'HIEU 144', 'HIEU 150',
        'HILA 100', 'HILA 105', 'HILA 110', 'HILA 111', 'HILA 115',
        'HILA 121', 'HILA 122', 'HILA 125', 'HILA 130',
        'HINE 100', 'HINE 105', 'HINE 108', 'HINE 110', 'HINE 114',
        'HIUS 100', 'HIUS 102', 'HIUS 105', 'HIUS 108', 'HIUS 110',
        'HIUS 112', 'HIUS 113', 'HIUS 114', 'HIUS 115', 'HIUS 120',
        'HIUS 125', 'HIUS 130', 'HIUS 132', 'HIUS 134', 'HIUS 136',
        'HIUS 138', 'HIUS 140', 'HIUS 142', 'HIUS 145',
        'HIST 100', 'HIST 102', 'HIST 106', 'HIST 109', 'HIST 117',
      ],
    },
  },
  'Global Health': {
    name: 'Global Health',
    code: 'GH',
    isEngineering: false,
    lowerDiv: [
      'GLBH 20', 'GLBH 100',
      'BILD 1', 'BILD 3',
      'MATH 10A', 'MATH 11',
    ],
    upperDiv: [
      'GLBH 101', 'GLBH 102', 'GLBH 140', 'GLBH 141',
      'GLBH 150', 'GLBH 181',
    ],
    electives: {
      pick: 4,
      from: [
        'GLBH 110', 'GLBH 115', 'GLBH 120', 'GLBH 121',
        'GLBH 130', 'GLBH 135', 'GLBH 142', 'GLBH 145',
        'GLBH 148', 'GLBH 151', 'GLBH 155', 'GLBH 160',
        'GLBH 161', 'GLBH 171', 'GLBH 175', 'GLBH 180',
        'GLBH 182', 'GLBH 185', 'GLBH 186', 'GLBH 188',
      ],
    },
  },
  'Urban Studies and Planning': {
    name: 'Urban Studies and Planning',
    code: 'UP',
    isEngineering: false,
    lowerDiv: [
      'USP 1', 'USP 2', 'USP 3', 'USP 4',
      'MATH 11',
      'ECON 1', 'ECON 2',
    ],
    upperDiv: [
      'USP 100', 'USP 101', 'USP 102', 'USP 103',
    ],
    electives: {
      pick: 5,
      from: [
        'USP 104', 'USP 105', 'USP 107', 'USP 108', 'USP 109',
        'USP 110', 'USP 111', 'USP 112', 'USP 113', 'USP 115',
        'USP 120', 'USP 121', 'USP 122', 'USP 125', 'USP 129',
        'USP 130', 'USP 135', 'USP 137', 'USP 140',
        'USP 141', 'USP 143', 'USP 145', 'USP 150',
        'USP 155', 'USP 160', 'USP 170', 'USP 175', 'USP 180',
      ],
    },
  },
  'Environmental Systems (Ecology)': {
    name: 'Environmental Systems (Ecology)',
    code: 'EV',
    isEngineering: false,
    lowerDiv: [
      'BILD 1', 'BILD 3',
      'CHEM 6A', 'CHEM 6B', 'CHEM 6C',
      'MATH 10A', 'MATH 10B', 'MATH 11',
      'PHYS 1A', 'PHYS 1B',
      'ESYS 10', 'ESYS 30',
    ],
    upperDiv: [
      'ESYS 101', 'ESYS 102', 'ESYS 103',
      'BIEB 100', 'BIEB 120', 'BIEB 140',
    ],
    electives: {
      pick: 4,
      from: [
        'BIEB 102', 'BIEB 110', 'BIEB 126', 'BIEB 128',
        'BIEB 130', 'BIEB 150', 'BIEB 166', 'BIEB 170', 'BIEB 174', 'BIEB 176',
        'SIO 40', 'SIO 45', 'SIO 46', 'SIO 50',
        'SIO 100', 'SIO 102', 'SIO 110', 'SIO 115',
        'SIO 120', 'SIO 125', 'SIO 130', 'SIO 133',
        'ESYS 150', 'ESYS 160',
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
  college: string
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
  collegeName: string,
  completedCodes: Set<string>,
): GradProgress {
  const major = MAJORS[majorName]
  const college = COLLEGES[collegeName]
  if (!major || !college) {
    return {
      major: majorName, college: collegeName, isEngineering: false,
      ge: [], lowerDiv: { id: 'ld', name: 'Lower Division', description: '', required: 0, completed: 0, completedCourses: [], missingOptions: [] },
      upperDiv: { id: 'ud', name: 'Upper Division', description: '', required: 0, completed: 0, completedCourses: [], missingOptions: [] },
      totalCompleted: 0, totalRequired: 0, overallPct: 0,
    }
  }

  // Calculate GE progress using the selected college's requirements
  const ge: ReqProgress[] = college.ge.map((g) => {
    if (g.courses.length === 0) {
      return { id: g.id, name: g.name, description: g.description, required: g.minCourses, completed: 0, completedCourses: [], missingOptions: [] }
    }

    // Pool-style requirement (one big list, pick N)
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

    // Slot-style requirement (one from each set of alternatives)
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

  // Warren-specific: adjust POC for engineering majors
  if (collegeName === 'Warren') {
    const pocIdx = ge.findIndex((g) => g.id === 'poc')
    if (pocIdx !== -1 && major.isEngineering) {
      ge[pocIdx].required = 6 // 3 per concentration x 2
      ge[pocIdx].description = '3 courses each in 2 areas outside your major (engineering)'
    }
  }

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
    college: collegeName,
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
