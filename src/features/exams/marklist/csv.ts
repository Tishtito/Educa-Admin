import type { Marklist } from '@/lib/api/types'

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The mark list as CSV for spreadsheets. Leading characters that spreadsheet
 * apps treat as formulas are neutralised, since pupil names are user input.
 */
export function marklistToCsv(marklist: Marklist): string {
  const safe = (value: string | null) => (value && /^[=+\-@]/.test(value) ? `'${value}` : value)

  const header = [
    'Position',
    'Stream position',
    'Admission no',
    'Name',
    ...marklist.subjects.flatMap((s) => [s.code || s.name, `${s.code || s.name} level`]),
    'Total',
    'Mean',
    'Mean level',
  ]

  const rows = marklist.students.map((student) => [
    student.grade_position,
    student.stream_position,
    safe(student.admission_no),
    safe(student.name),
    ...marklist.subjects.flatMap((subject) => {
      const score = student.scores.find((s) => s.level_subject_id === subject.level_subject_id)
      return [score?.is_absent ? 'ABS' : score?.score ?? '', score?.band ?? '']
    }),
    student.total_marks,
    student.mean_marks,
    student.mean_band,
  ])

  const means = ['', '', '', 'Class mean', ...marklist.subjects.flatMap((s) => [s.class_mean ?? '', '']), '', '', '']

  return [header, ...rows, means].map((row) => row.map(escape).join(',')).join('\r\n')
}
