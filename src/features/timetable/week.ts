import type { BellPeriod, Lesson } from './api'

export const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }

export const dayShort = (day: number) => DAY_NAMES[day]?.slice(0, 3) ?? `Day ${day}`

/** A row of the week grid: a bell period (class view) or a distinct lesson time (teacher view). */
export interface WeekRow {
  key: string
  kind: BellPeriod['kind']
  label: string | null
  starts_at: string
  ends_at: string
  /** Lessons in this row by day. */
  cells: Record<number, Lesson[]>
}

/** Rows for one class: its bell periods, breaks included, with that class's lessons in them. */
export function classRows(periods: BellPeriod[], lessons: Lesson[]): WeekRow[] {
  return periods.map((period) => ({
    key: `p${period.sequence}`,
    kind: period.kind,
    label: period.label,
    starts_at: period.starts_at,
    ends_at: period.ends_at,
    cells: groupByDay(lessons.filter((l) => l.period_sequence === period.sequence)),
  }))
}

/**
 * Rows for one teacher. A teacher can teach classes on different bell
 * schedules, so rows are the distinct lesson times rather than period numbers.
 */
export function teacherRows(lessons: Lesson[]): WeekRow[] {
  const times = new Map<string, { starts_at: string; ends_at: string }>()
  for (const lesson of lessons) times.set(`${lesson.starts_at}-${lesson.ends_at}`, { starts_at: lesson.starts_at, ends_at: lesson.ends_at })

  return [...times.entries()]
    .sort(([, a], [, b]) => a.starts_at.localeCompare(b.starts_at) || a.ends_at.localeCompare(b.ends_at))
    .map(([key, time]) => ({
      key,
      kind: 'lesson' as const,
      label: null,
      ...time,
      cells: groupByDay(lessons.filter((l) => l.starts_at === time.starts_at && l.ends_at === time.ends_at)),
    }))
}

function groupByDay(lessons: Lesson[]): Record<number, Lesson[]> {
  const cells: Record<number, Lesson[]> = {}
  for (const lesson of lessons) (cells[lesson.day] ??= []).push(lesson)
  return cells
}

/** Lessons per subject in a week, for the summary under a grid. */
export function subjectTotals(lessons: Lesson[]): { name: string; count: number }[] {
  const totals = new Map<string, number>()
  for (const lesson of lessons) {
    const name = lesson.subject_name ?? 'Subject'
    totals.set(name, (totals.get(name) ?? 0) + 1)
  }
  return [...totals.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** A stable, readable tint per subject, so the same subject reads the same across the grid. */
export function subjectTone(levelSubjectId: number): string {
  const tones = [
    'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900',
    'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900',
    'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900',
    'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-900',
    'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900',
    'bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-900',
    'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-900',
    'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900',
  ]
  return tones[levelSubjectId % tones.length]
}
