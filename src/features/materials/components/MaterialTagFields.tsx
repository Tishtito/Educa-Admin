import { useAuth } from '@/auth/useAuth'
import { Field } from '@/components/data/Field'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { setupKeys } from '@/features/setup/api'
import { api } from '@/lib/api/client'
import type { Level, LevelSubject } from '@/lib/api/types'
import { gradesInSection } from '../model'

export interface MaterialTags {
  level_id: number | null
  grade_ids: number[]
  level_subject_id: number | null
}

const NONE = 'none'

/**
 * Section, grades and subject, shared by the upload and edit dialogs. No grade
 * ticked means the whole section; changing section drops grades and a subject
 * from the old one, which the API would refuse.
 */
export function MaterialTagFields({
  levels,
  value,
  onChange,
  errors = {},
}: {
  levels: Level[]
  value: MaterialTags
  onChange: (next: MaterialTags) => void
  errors?: Partial<Record<keyof MaterialTags, string>>
}) {
  const { can } = useAuth()
  // The subject list needs manage_subjects; without it the tag is simply not offered.
  const canPickSubject = can('manage_subjects')
  const subjects = useQuery({
    queryKey: setupKeys.levelSubjects,
    queryFn: ({ signal }) => api.get<LevelSubject[]>('/level-subjects', { signal }),
    enabled: canPickSubject,
  })
  const level = levels.find((l) => l.id === value.level_id)
  const levelSubjects = (canPickSubject ? (subjects.data ?? []) : []).filter((ls) => ls.level_id === value.level_id && ls.is_active)

  const setLevel = (levelId: number) =>
    onChange({ level_id: levelId, grade_ids: gradesInSection(levels, levelId, value.grade_ids), level_subject_id: levelId === value.level_id ? value.level_subject_id : null })

  const toggleGrade = (gradeId: number, on: boolean) =>
    onChange({ ...value, grade_ids: on ? [...value.grade_ids, gradeId] : value.grade_ids.filter((id) => id !== gradeId) })

  return (
    <>
      <Field label="Section" error={errors.level_id}>
        <Select value={value.level_id ? String(value.level_id) : ''} onValueChange={(v) => setLevel(Number(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a section" />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {level && (
        <Field label="Grades" error={errors.grade_ids} hint={value.grade_ids.length === 0 ? `Shown to every ${level.name.toLowerCase()} grade.` : undefined}>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={value.grade_ids.length === 0} onCheckedChange={(on) => on && onChange({ ...value, grade_ids: [] })} />
              All grades in this section
            </label>
            {[...level.grades]
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={value.grade_ids.includes(g.id)} onCheckedChange={(on) => toggleGrade(g.id, on === true)} />
                  {g.name}
                </label>
              ))}
          </div>
        </Field>
      )}

      {canPickSubject && level && (
        <Field label="Subject" error={errors.level_subject_id} hint="Optional.">
          <Select
            value={value.level_subject_id ? String(value.level_subject_id) : NONE}
            onValueChange={(v) => onChange({ ...value, level_subject_id: v === NONE ? null : Number(v) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No subject</SelectItem>
              {levelSubjects.map((ls) => (
                <SelectItem key={ls.id} value={String(ls.id)}>
                  {ls.subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  )
}
