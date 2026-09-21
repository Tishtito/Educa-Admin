import { describe, expect, it } from 'vitest'
import type { Marksheet } from '@/lib/api/types'
import { buildPayload, cellError, cellKey, dirtyKeys, draftFromSheet, parseScore, progress, serverErrorsToCells } from './model'

const sheet: Marksheet = {
  exam: { id: 1, name: 'Mid-Term', status: 'marking', accepts_score_entry: true, results_up_to_date: true, results_computed_at: null },
  class: { id: 3, name: 'Grade 5 Blue' },
  subject: { level_subject_id: 7, name: 'English', code: 'ENG', aggregation_rule: 'sum', aggregation_rule_label: 'Sum' },
  papers: [
    { subject_paper_id: 11, sequence: 1, name: 'Reading', max_marks: 50 },
    { subject_paper_id: 12, sequence: 2, name: 'Grammar', max_marks: null },
  ],
  students: [
    {
      enrolment_id: 21,
      student_id: 9,
      assessment_no: 'A1',
      name: 'Pupil One',
      marks: [
        { subject_paper_id: 11, raw_score: 32.5, is_absent: false, entered_at: '2026-01-01' },
        { subject_paper_id: 12, raw_score: null, is_absent: false, entered_at: null },
      ],
      subject_score: null,
      subject_band: null,
    },
    {
      enrolment_id: 22,
      student_id: 10,
      assessment_no: 'A2',
      name: 'Pupil Two',
      marks: [
        { subject_paper_id: 11, raw_score: null, is_absent: true, entered_at: '2026-01-01' },
        { subject_paper_id: 12, raw_score: null, is_absent: false, entered_at: null },
      ],
      subject_score: null,
      subject_band: null,
    },
  ],
  can_enter: true,
}

describe('marksheet model', () => {
  it('builds a draft from the sheet', () => {
    const draft = draftFromSheet(sheet)
    expect(draft[cellKey(21, 11)]).toEqual({ value: '32.5', absent: false })
    expect(draft[cellKey(22, 11)]).toEqual({ value: '', absent: true })
  })

  it('parses scores strictly', () => {
    expect(parseScore('')).toBeNull()
    expect(parseScore(' 40 ')).toBe(40)
    expect(parseScore('40.25')).toBe(40.25)
    expect(parseScore('40.255')).toBeNaN()
    expect(parseScore('-1')).toBeNaN()
    expect(parseScore('abc')).toBeNaN()
  })

  it('treats equal numbers as unchanged', () => {
    const original = draftFromSheet(sheet)
    const draft = { ...original, [cellKey(21, 11)]: { value: '32.50', absent: false } }
    expect(dirtyKeys(original, draft)).toEqual([])
  })

  it('sends only changed cells, with clears and absences', () => {
    const original = draftFromSheet(sheet)
    const draft = {
      ...original,
      [cellKey(21, 11)]: { value: '', absent: false }, // cleared
      [cellKey(22, 11)]: { value: '45', absent: false }, // was absent, now marked
    }

    const { marks, keys, errors } = buildPayload(sheet, original, draft)

    expect(errors).toEqual({})
    expect(marks).toEqual([
      { enrolment_id: 21, subject_paper_id: 11, raw_score: null, is_absent: false },
      { enrolment_id: 22, subject_paper_id: 11, raw_score: 45, is_absent: false },
    ])
    expect(keys).toEqual([cellKey(21, 11), cellKey(22, 11)])
  })

  it('marks an absent pupil without a score', () => {
    const original = draftFromSheet(sheet)
    const draft = { ...original, [cellKey(21, 11)]: { value: '32.5', absent: true } }
    expect(buildPayload(sheet, original, draft).marks).toEqual([
      { enrolment_id: 21, subject_paper_id: 11, raw_score: null, is_absent: true },
    ])
  })

  it('holds back invalid cells with a reason', () => {
    const original = draftFromSheet(sheet)
    const draft = {
      ...original,
      [cellKey(21, 11)]: { value: '51', absent: false },
      [cellKey(21, 12)]: { value: '10', absent: false },
    }

    const { marks, errors } = buildPayload(sheet, original, draft)

    expect(marks).toEqual([])
    expect(errors[cellKey(21, 11)]).toBe('The mark must be between 0 and 50.')
    expect(errors[cellKey(21, 12)]).toBe('Set the marks-out-of for this paper first.')
    expect(cellError({ value: '', absent: false }, null)).toBeNull()
  })

  it('maps server row errors back to cells', () => {
    const keys = [cellKey(21, 11), cellKey(22, 11)]
    expect(serverErrorsToCells({ 1: { raw_score: 'Too high.' } }, keys)).toEqual({ [cellKey(22, 11)]: 'Too high.' })
  })

  it('counts entered cells, absences included', () => {
    expect(progress(sheet, draftFromSheet(sheet))).toEqual({ entered: 2, expected: 4 })
  })
})
