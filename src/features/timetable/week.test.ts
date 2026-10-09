import { describe, expect, it } from 'vitest'
import type { BellPeriod, Lesson } from './api'
import { classRows, subjectTotals, teacherRows } from './week'

const lesson = (over: Partial<Lesson>): Lesson => ({
  id: 1,
  class_id: 1,
  class_name: 'Grade 5 Blue',
  level_subject_id: 1,
  subject_name: 'Mathematics',
  subject_code: 'MAT',
  user_id: 1,
  teacher_name: 'Jane',
  day: 1,
  period_sequence: 1,
  starts_at: '08:00',
  ends_at: '08:35',
  is_locked: false,
  double_group: null,
  ...over,
})

describe('classRows', () => {
  it('keeps breaks as rows and puts each lesson under its period and day', () => {
    const periods: BellPeriod[] = [
      { sequence: 1, kind: 'lesson', label: null, starts_at: '08:00', ends_at: '08:35' },
      { sequence: 2, kind: 'break', label: 'Short break', starts_at: '08:35', ends_at: '08:45' },
      { sequence: 3, kind: 'lesson', label: null, starts_at: '08:45', ends_at: '09:20' },
    ]
    const rows = classRows(periods, [lesson({ id: 1, day: 2, period_sequence: 3 }), lesson({ id: 2, day: 1, period_sequence: 1 })])

    expect(rows.map((r) => r.kind)).toEqual(['lesson', 'break', 'lesson'])
    expect(rows[0].cells[1]?.map((l) => l.id)).toEqual([2])
    expect(rows[2].cells[2]?.map((l) => l.id)).toEqual([1])
    expect(rows[1].cells).toEqual({})
  })
})

describe('teacherRows', () => {
  it('uses distinct clock times, so classes on different bells line up by time', () => {
    const rows = teacherRows([
      lesson({ id: 1, starts_at: '08:40', ends_at: '09:20' }),
      lesson({ id: 2, starts_at: '08:00', ends_at: '08:30', day: 3 }),
      lesson({ id: 3, starts_at: '08:40', ends_at: '09:20', day: 2 }),
    ])

    expect(rows.map((r) => r.starts_at)).toEqual(['08:00', '08:40'])
    expect(Object.keys(rows[1].cells)).toEqual(['1', '2'])
  })
})

describe('subjectTotals', () => {
  it('counts lessons per subject, busiest first', () => {
    expect(subjectTotals([lesson({}), lesson({ subject_name: 'English' }), lesson({})])).toEqual([
      { name: 'Mathematics', count: 2 },
      { name: 'English', count: 1 },
    ])
  })
})
