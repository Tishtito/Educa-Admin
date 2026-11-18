import { useState } from 'react'
import { CopyIcon, Loader2Icon, SaveIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGrades } from '@/features/reference/api'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { AcademicYear } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { useGradeRequirements, useTimetableMutations, type GradeRequirements, type RequirementRow } from '../api'

export function RequirementsPanel({ year, years, gradeId, onGrade }: { year: AcademicYear; years: AcademicYear[]; gradeId: number | null; onGrade: (id: number) => void }) {
  const grades = useGrades()
  const selected = gradeId ?? grades.data?.[0]?.id ?? null
  const requirements = useGradeRequirements(year.id, selected)
  const previous = years.filter((y) => y.name < year.name).sort((a, b) => b.name.localeCompare(a.name))[0]
  const { copyRequirements } = useTimetableMutations()

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={selected ? String(selected) : undefined} onValueChange={(v) => onGrade(Number(v))}>
          <SelectTrigger className="w-48" aria-label="Grade">
            <SelectValue placeholder="Choose a grade" />
          </SelectTrigger>
          <SelectContent>
            {grades.data?.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {previous && (
          <ConfirmDialog
            trigger={
              <Button variant="outline">
                <CopyIcon /> Copy from {previous.name}
              </Button>
            }
            title={`Copy ${previous.name}'s lessons per week into ${year.name}?`}
            description="Every grade's numbers carry over. Anything already set for this year is kept."
            confirmLabel="Copy"
            onConfirm={async () => {
              const result = await copyRequirements.mutateAsync({ from_year_id: previous.id, to_year_id: year.id })
              toast.success(`Copied ${result.created} subject${result.created === 1 ? '' : 's'}.`)
            }}
          />
        )}
      </div>
      <QueryState query={requirements}>
        {(data) =>
          data === null ? (
            <EmptyState title="Choose a grade" />
          ) : data.subjects.length === 0 ? (
            <EmptyState title="No subjects at this level" description="Add the level's subjects under School set-up → Subjects first." />
          ) : (
            <RequirementsForm key={`${data.grade.id}:${requirements.dataUpdatedAt}`} year={year} data={data} />
          )
        }
      </QueryState>
    </div>
  )
}

function RequirementsForm({ year, data }: { year: AcademicYear; data: GradeRequirements }) {
  const { saveRequirements } = useTimetableMutations()
  const [rows, setRows] = useState<RequirementRow[]>(data.subjects)
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({})
  const total = rows.reduce((sum, r) => sum + (Number(r.lessons_per_week) || 0), 0)
  const available = data.periods_per_week
  const changed = JSON.stringify(rows) !== JSON.stringify(data.subjects)

  const set = (index: number, field: 'lessons_per_week' | 'max_per_day' | 'double_lessons', value: string) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, [field]: Math.max(0, Math.floor(Number(value) || 0)) } : r)))

  async function save() {
    setErrors({})
    try {
      await saveRequirements.mutateAsync({
        academic_year_id: year.id,
        grade_id: data.grade.id,
        requirements: rows.map(({ level_subject_id, lessons_per_week, max_per_day, double_lessons }) => ({ level_subject_id, lessons_per_week, max_per_day: Math.max(1, max_per_day), double_lessons })),
      })
      toast.success(`${data.grade.name}: lessons per week saved.`)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setErrors(error.rows('requirements'))
        toast.error(Object.values(error.fieldErrors)[0]?.[0] ?? error.message)
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{data.grade.name}: lessons per week</CardTitle>
        <CardDescription>
          Every class of the grade gets these. A double lesson takes two periods in a row; the daily limit stops a subject piling up on one day.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="hidden grid-cols-[1fr_6rem_6rem_6rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
          <span>Subject</span>
          <span>Per week</span>
          <span>Max a day</span>
          <span>Doubles</span>
        </div>
        {rows.map((row, index) => (
          <div key={row.level_subject_id} className="grid grid-cols-3 items-center gap-2 sm:grid-cols-[1fr_6rem_6rem_6rem]">
            <div className="col-span-3 sm:col-span-1">
              <span className="font-medium">{row.subject_name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{row.subject_code}</span>
              {errors[index] && <p className="text-xs text-destructive">{Object.values(errors[index])[0]}</p>}
            </div>
            <Input type="number" min={0} max={20} aria-label={`${row.subject_name} lessons per week`} value={row.lessons_per_week} onChange={(e) => set(index, 'lessons_per_week', e.target.value)} />
            <Input type="number" min={1} max={10} aria-label={`${row.subject_name} most a day`} value={row.max_per_day} disabled={row.lessons_per_week === 0} onChange={(e) => set(index, 'max_per_day', e.target.value)} />
            <Input type="number" min={0} max={10} aria-label={`${row.subject_name} double lessons`} value={row.double_lessons} disabled={row.lessons_per_week < 2} onChange={(e) => set(index, 'double_lessons', e.target.value)} />
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-2">
        <p className={cn('text-sm', available !== null && total > available ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {total} lessons a week
          {available === null ? ' · no school day set for this level yet' : ` of ${available} periods${total < available ? ` (${available - total} free)` : ''}`}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!changed || saveRequirements.isPending} onClick={() => setRows(data.subjects)}>
            Discard
          </Button>
          <Button disabled={!changed || saveRequirements.isPending} onClick={() => void save()}>
            {saveRequirements.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
