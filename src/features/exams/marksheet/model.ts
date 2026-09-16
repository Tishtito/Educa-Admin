import type { MarkInput, Marksheet } from '@/lib/api/types'

/**
 * Client-side draft of a marksheet. Cells hold what the user typed (a string)
 * so half-typed values like "4." survive re-renders; the payload sent to the
 * API contains only cells that differ from what the server returned.
 */
export interface Cell {
  value: string
  absent: boolean
}

export type Draft = Record<string, Cell>

export const cellKey = (enrolmentId: number, paperId: number) => `${enrolmentId}:${paperId}`

export function draftFromSheet(sheet: Marksheet): Draft {
  const draft: Draft = {}
  for (const student of sheet.students) {
    for (const paper of sheet.papers) {
      const mark = student.marks.find((m) => m.subject_paper_id === paper.subject_paper_id)
      draft[cellKey(student.enrolment_id, paper.subject_paper_id)] = {
        value: mark?.raw_score === null || mark?.raw_score === undefined ? '' : String(mark.raw_score),
        absent: mark?.is_absent ?? false,
      }
    }
  }
  return draft
}

/** A typed value as a number, null for blank, NaN for garbage. */
export function parseScore(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN
  return Number(trimmed)
}

function sameCell(a: Cell, b: Cell): boolean {
  if (a.absent !== b.absent) return false
  if (a.absent) return true
  const x = parseScore(a.value)
  const y = parseScore(b.value)
  return x === y || (Number.isNaN(x) && Number.isNaN(y) && a.value.trim() === b.value.trim())
}

export function dirtyKeys(original: Draft, draft: Draft): string[] {
  return Object.keys(draft).filter((key) => !original[key] || !sameCell(original[key], draft[key]))
}

/** Problem with one cell, or null. Mirrors MarksheetService's validation so errors show before saving. */
export function cellError(cell: Cell, maxMarks: number | null): string | null {
  if (cell.absent) return null
  const score = parseScore(cell.value)
  if (score === null) return null
  if (Number.isNaN(score)) return 'Enter a number with at most two decimals.'
  if (maxMarks === null) return 'Set the marks-out-of for this paper first.'
  if (score < 0 || score > maxMarks) return `The mark must be between 0 and ${maxMarks}.`
  return null
}

export interface BuiltPayload {
  marks: MarkInput[]
  /** Payload index → cell key, to map the API's marks.{i}.* errors back to cells. */
  keys: string[]
  errors: Record<string, string>
}

export function buildPayload(sheet: Marksheet, original: Draft, draft: Draft): BuiltPayload {
  const maxByPaper = new Map(sheet.papers.map((p) => [p.subject_paper_id, p.max_marks]))
  const marks: MarkInput[] = []
  const keys: string[] = []
  const errors: Record<string, string> = {}

  for (const key of dirtyKeys(original, draft)) {
    const [enrolmentId, paperId] = key.split(':').map(Number)
    const cell = draft[key]
    const error = cellError(cell, maxByPaper.get(paperId) ?? null)
    if (error) {
      errors[key] = error
      continue
    }
    marks.push({
      enrolment_id: enrolmentId,
      subject_paper_id: paperId,
      // Absent sends no mark; a blank non-absent cell clears the mark.
      raw_score: cell.absent ? null : parseScore(cell.value),
      is_absent: cell.absent,
    })
    keys.push(key)
  }

  return { marks, keys, errors }
}

/** Maps the API's row errors (marks.{i}.field) back to cell keys. */
export function serverErrorsToCells(rowErrors: Record<number, Record<string, string>>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [index, fields] of Object.entries(rowErrors)) {
    const key = keys[Number(index)]
    if (!key) continue
    out[key] = Object.values(fields)[0] ?? 'Invalid mark.'
  }
  return out
}

export interface SheetProgress {
  entered: number
  expected: number
}

export function progress(sheet: Marksheet, draft: Draft): SheetProgress {
  let entered = 0
  for (const student of sheet.students) {
    for (const paper of sheet.papers) {
      const cell = draft[cellKey(student.enrolment_id, paper.subject_paper_id)]
      if (cell && (cell.absent || parseScore(cell.value) !== null)) entered++
    }
  }
  return { entered, expected: sheet.students.length * sheet.papers.length }
}
