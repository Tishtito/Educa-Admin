import type { SchoolSubject } from './api'

export interface LevelGroup {
  /** The level code, or `level-{id}` for a level outside the CBC three. */
  key: string
  label: string
  subjects: SchoolSubject[]
}

const LEVELS: { code: string; label: string }[] = [
  { code: 'lower_primary', label: 'Lower primary' },
  { code: 'upper_primary', label: 'Upper primary' },
  { code: 'junior_secondary', label: 'Junior secondary' },
]

/** The school's subjects grouped by level, in school order (lower primary first), each group sorted by name. */
export function groupSubjectsByLevel(subjects: SchoolSubject[]): LevelGroup[] {
  const groups = new Map<string, LevelGroup>()

  for (const subject of subjects) {
    const known = LEVELS.find((l) => l.code === subject.level_code)
    const key = known?.code ?? `level-${subject.level_id}`
    const group = groups.get(key) ?? { key, label: known?.label ?? subject.level_name ?? 'Other', subjects: [] }
    group.subjects.push(subject)
    groups.set(key, group)
  }

  const rank = (key: string) => {
    const i = LEVELS.findIndex((l) => l.code === key)
    return i === -1 ? LEVELS.length : i
  }

  return [...groups.values()]
    .sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label))
    .map((g) => ({ ...g, subjects: [...g.subjects].sort((a, b) => (a.subject_name ?? '').localeCompare(b.subject_name ?? '')) }))
}

/** Whether two id lists hold the same ids, in any order. */
export function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}
