import { describe, expect, it } from 'vitest'
import type { SchoolSubject } from './api'
import { groupSubjectsByLevel, sameIds } from './teacherSubjects'

const subject = (id: number, levelCode: string | null, name: string, levelId = 1): SchoolSubject => ({
  level_subject_id: id,
  level_id: levelId,
  level_name: levelCode ? levelCode.replace('_', ' ') : 'Pre-primary',
  level_code: levelCode,
  subject_name: name,
  subject_code: name.slice(0, 3).toUpperCase(),
  teachers_count: 0,
})

describe('groupSubjectsByLevel', () => {
  it('orders the CBC levels lower to junior secondary and sorts subjects by name', () => {
    const groups = groupSubjectsByLevel([
      subject(1, 'junior_secondary', 'Mathematics', 3),
      subject(2, 'lower_primary', 'Kiswahili', 1),
      subject(3, 'upper_primary', 'Science', 2),
      subject(4, 'lower_primary', 'English', 1),
    ])

    expect(groups.map((g) => g.label)).toEqual(['Lower primary', 'Upper primary', 'Junior secondary'])
    expect(groups[0].subjects.map((s) => s.subject_name)).toEqual(['English', 'Kiswahili'])
  })

  it('puts a level it does not know last, under its own name', () => {
    const groups = groupSubjectsByLevel([subject(1, null, 'Play', 9), subject(2, 'upper_primary', 'English', 2)])

    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ['upper_primary', 'Upper primary'],
      ['level-9', 'Pre-primary'],
    ])
  })

  it('returns nothing for no subjects', () => {
    expect(groupSubjectsByLevel([])).toEqual([])
  })
})

describe('sameIds', () => {
  it('ignores order', () => {
    expect(sameIds([1, 2, 3], [3, 1, 2])).toBe(true)
    expect(sameIds([1, 2], [1, 2, 3])).toBe(false)
    expect(sameIds([1, 2], [1, 4])).toBe(false)
  })
})
