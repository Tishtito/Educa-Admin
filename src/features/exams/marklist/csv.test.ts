import { describe, expect, it } from 'vitest'
import type { Marklist } from '@/lib/api/types'
import { marklistToCsv } from './csv'

const marklist: Marklist = {
  exam: { id: 1, name: 'Mid', status: 'locked', tie_policy: 'competition', is_legacy_import: false, results_up_to_date: true, results_computed_at: null },
  class: { id: 3, name: 'Grade 5 Blue', grade: 'Grade 5', stream: 'Blue' },
  subjects: [
    { level_subject_id: 5, name: 'Mathematics', code: 'MAT', scale_max: 100, counts_toward_total: true, aggregation_rule: 'single', class_mean: 64.25, students_counted: 2 },
  ],
  students: [
    {
      student_id: 9, assessment_no: 'A1', name: '=HYPERLINK("x")', total_marks: 78, mean_marks: 78, mean_band: 'EE-4', mean_band_label: 'EXCEEDING',
      grade_position: 1, stream_position: 1, grade_cohort_size: 2, stream_cohort_size: 2, is_complete: true, subjects_expected: 1, subjects_counted: 1,
      scores: [{ level_subject_id: 5, score: 78, raw_score: 78, max_marks: 100, band: 'EE-4', band_label: 'EXCEEDING', is_absent: false, subject_position: 1 }],
    },
    {
      student_id: 10, assessment_no: 'A2', name: 'Otieno, Jane', total_marks: null, mean_marks: null, mean_band: null, mean_band_label: null,
      grade_position: null, stream_position: null, grade_cohort_size: 2, stream_cohort_size: 2, is_complete: false, subjects_expected: 1, subjects_counted: 0,
      scores: [{ level_subject_id: 5, score: null, raw_score: null, max_marks: 100, band: null, band_label: null, is_absent: true, subject_position: null }],
    },
  ],
}

describe('marklistToCsv', () => {
  it('writes a header, one row per pupil and the class means', () => {
    const lines = marklistToCsv(marklist).split('\r\n')
    expect(lines[0]).toBe('Position,Stream position,Assessment no,Name,MAT,MAT level,Total,Mean,Mean level')
    expect(lines[2]).toBe(',,A2,"Otieno, Jane",ABS,,,,')
    expect(lines[3]).toBe(',,,Class mean,64.25,,,,')
  })

  it('neutralises formula-like names', () => {
    expect(marklistToCsv(marklist).split('\r\n')[1]).toBe(`1,1,A1,"'=HYPERLINK(""x"")",78,EE-4,78,78,EE-4`)
  })
})
