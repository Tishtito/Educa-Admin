import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CopyIcon, Loader2Icon, SaveIcon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAcademicYears, useClasses } from '@/features/reference/api'
import { useLevelSubjects } from '@/features/setup/api'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { AcademicYear, ExaminerAssignment, SchoolClass, StaffMember } from '@/lib/api/types'
import { useAssignmentMutations, useClassTeachers, useExaminers, useStaff } from '../api'
import { StaffMultiSelect } from '../components/StaffMultiSelect'

export function AssignmentsPage() {
  const years = useAcademicYears()
  const [params, setParams] = useSearchParams()
  const current = years.data?.find((y) => y.is_current) ?? years.data?.[0]
  const yearId = Number(params.get('year')) || current?.id || null
  const year = years.data?.find((y) => y.id === yearId)
  const view = params.get('view') === 'examiners' ? 'examiners' : 'teachers'
  const set = (key: string, value: string) => setParams((p) => {
    const next = new URLSearchParams(p)
    next.set(key, value)
    return next
  }, { replace: true })

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Who is class teacher of each class, and who marks each subject. Assignments are per academic year."
        actions={
          <>
            <Select value={yearId ? String(yearId) : undefined} onValueChange={(v) => set('year', v)}>
              <SelectTrigger className="w-36" aria-label="Academic year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.data?.map((y) => (
                  <SelectItem key={y.id} value={String(y.id)}>
                    {y.name}
                    {y.is_current ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {year && years.data && <CopyYearButton year={year} years={years.data} />}
          </>
        }
      />
      <Tabs value={view} onValueChange={(v) => set('view', v)} className="mb-4">
        <TabsList>
          <TabsTrigger value="teachers">Class teachers</TabsTrigger>
          <TabsTrigger value="examiners">Examiners</TabsTrigger>
        </TabsList>
      </Tabs>
      {yearId === null ? (
        <EmptyState title="No academic year" description="Create an academic year first." />
      ) : view === 'teachers' ? (
        <ClassTeachersView yearId={yearId} />
      ) : (
        <ExaminersView yearId={yearId} />
      )}
    </>
  )
}

function CopyYearButton({ year, years }: { year: AcademicYear; years: AcademicYear[] }) {
  const { copyYear } = useAssignmentMutations()
  const previous = years.filter((y) => y.id !== year.id).sort((a, b) => b.name.localeCompare(a.name)).find((y) => y.name < year.name)
  if (!previous) return null

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <CopyIcon /> Copy from {previous.name}
        </Button>
      }
      title={`Copy ${previous.name}'s assignments into ${year.name}?`}
      description="Class teachers and examiners carry over class by class. Anything already set for this year is kept."
      confirmLabel="Copy"
      onConfirm={async () => {
        const result = await copyYear.mutateAsync({ from_year_id: previous.id, to_year_id: year.id })
        toast.success(`Copied ${result.class_teachers} class teacher and ${result.examiners} examiner assignments.`)
      }}
    />
  )
}

// ---------------------------------------------------------- class teachers

function ClassTeachersView({ yearId }: { yearId: number }) {
  const classes = useClasses({ active: true })
  const staff = useStaff()
  const assignments = useClassTeachers(yearId)
  // Whoever can look after a class, whatever their role is called.
  const teachers = (staff.data ?? []).filter((s) => s.is_active && s.permissions.includes('view_class_pupils'))

  return (
    <QueryState query={assignments}>
      {(data) =>
        (classes.data ?? []).length === 0 ? (
          <EmptyState title="No classes" description="Add classes under School set-up first." />
        ) : (
          <Card className="p-0">
            <ul className="divide-y">
              {(classes.data ?? []).map((item) => (
                <ClassTeacherRow
                  key={`${item.id}:${yearId}`}
                  schoolClass={item}
                  yearId={yearId}
                  teachers={teachers}
                  assigned={data.assignments.filter((a) => a.class_id === item.id).map((a) => a.user_id)}
                />
              ))}
            </ul>
            {teachers.length === 0 && (
              <p className="border-t px-4 py-3 text-sm text-muted-foreground">No staff have the class teacher role yet. Give it to someone under Staff.</p>
            )}
          </Card>
        )
      }
    </QueryState>
  )
}

function ClassTeacherRow({ schoolClass, yearId, teachers, assigned }: { schoolClass: SchoolClass; yearId: number; teachers: StaffMember[]; assigned: number[] }) {
  const { setClassTeachers } = useAssignmentMutations()
  const [value, setValue] = useState(assigned)
  const [saving, setSaving] = useState(false)

  async function change(next: number[]) {
    const previous = value
    setValue(next)
    setSaving(true)
    try {
      await setClassTeachers.mutateAsync({ classId: schoolClass.id, yearId, userIds: next })
    } catch (error) {
      setValue(previous)
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[12rem_1fr_1.5rem]">
      <div>
        <div className="font-medium">{schoolClass.name}</div>
        <div className="text-xs text-muted-foreground">{schoolClass.grade}</div>
      </div>
      <StaffMultiSelect label={`Class teacher of ${schoolClass.name}`} staff={teachers} value={value} onChange={(ids) => void change(ids)} placeholder="No class teacher" />
      <span className="hidden sm:block">{saving && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}</span>
    </li>
  )
}

// ---------------------------------------------------------------- examiners

function ExaminersView({ yearId }: { yearId: number }) {
  const classes = useClasses({ active: true })
  const [params, setParams] = useSearchParams()
  const classId = Number(params.get('class')) || classes.data?.[0]?.id || null
  const schoolClass = classes.data?.find((c) => c.id === classId)

  return (
    <div className="grid gap-4">
      <Select
        value={classId ? String(classId) : undefined}
        onValueChange={(v) =>
          setParams((p) => {
            const next = new URLSearchParams(p)
            next.set('class', v)
            return next
          }, { replace: true })
        }
      >
        <SelectTrigger className="w-56" aria-label="Class">
          <SelectValue placeholder="Choose a class" />
        </SelectTrigger>
        <SelectContent>
          {classes.data?.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {schoolClass ? <ExaminerGrid key={`${schoolClass.id}:${yearId}`} schoolClass={schoolClass} yearId={yearId} /> : <EmptyState title="Choose a class" />}
    </div>
  )
}

function ExaminerGrid({ schoolClass, yearId }: { schoolClass: SchoolClass; yearId: number }) {
  const staff = useStaff()
  const levelSubjects = useLevelSubjects()
  const assignments = useExaminers(yearId, schoolClass.id)
  const { setExaminers } = useAssignmentMutations()
  // Whoever may enter marks, whatever their role is called.
  const examiners = (staff.data ?? []).filter((s) => s.is_active && s.permissions.includes('enter_marks'))
  const subjects = (levelSubjects.data ?? []).filter((ls) => ls.level_id === schoolClass.level_id && ls.is_active)

  return (
    <QueryState query={assignments}>
      {(data) => (
        <ExaminerGridForm
          key={assignments.dataUpdatedAt}
          schoolClass={schoolClass}
          subjects={subjects.map((s) => ({ id: s.id, name: s.subject.name, code: s.subject.code }))}
          examiners={examiners}
          rows={data.assignments}
          saving={setExaminers.isPending}
          onSave={async (payload) => {
            try {
              await setExaminers.mutateAsync({ classId: schoolClass.id, yearId, subjects: payload })
              toast.success(`Examiners for ${schoolClass.name} saved.`)
            } catch (error) {
              toast.error(error instanceof ApiError && error.isValidation ? Object.values(error.fieldErrors)[0]?.[0] ?? error.message : errorMessage(error))
            }
          }}
        />
      )}
    </QueryState>
  )
}

function ExaminerGridForm({
  schoolClass,
  subjects,
  examiners,
  rows,
  saving,
  onSave,
}: {
  schoolClass: SchoolClass
  subjects: { id: number; name: string; code: string }[]
  examiners: StaffMember[]
  rows: ExaminerAssignment[]
  saving: boolean
  onSave: (payload: { level_subject_id: number; user_ids: number[] }[]) => Promise<void>
}) {
  const initial = Object.fromEntries(subjects.map((s) => [s.id, rows.filter((r) => r.level_subject_id === s.id).map((r) => r.user_id)]))
  const [value, setValue] = useState<Record<number, number[]>>(initial)
  const changed = subjects.filter((s) => (value[s.id] ?? []).join(',') !== (initial[s.id] ?? []).join(','))
  const inferred = rows.filter((r) => r.inferred)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Examiners for {schoolClass.name}</CardTitle>
        <CardDescription>An examiner can enter marks only for the subjects they are given here.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {inferred.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              {inferred.length} assignment{inferred.length === 1 ? ' was' : 's were'} carried over from the old system, which let an examiner mark
              every subject in their class. Review them and save to confirm.
            </span>
          </div>
        )}
        {subjects.length === 0 && <p className="text-sm text-muted-foreground">No active subjects at this class’s level.</p>}
        {subjects.map((subject) => (
          <div key={subject.id} className="grid items-center gap-2 sm:grid-cols-[14rem_1fr]">
            <div className="flex items-center gap-2">
              <span className="font-medium">{subject.name}</span>
              <span className="text-xs text-muted-foreground">{subject.code}</span>
              {rows.some((r) => r.level_subject_id === subject.id && r.inferred) && <Badge variant="outline">Review</Badge>}
            </div>
            <StaffMultiSelect
              label={`Examiners for ${subject.name}`}
              staff={examiners}
              value={value[subject.id] ?? []}
              onChange={(ids) => setValue((v) => ({ ...v, [subject.id]: ids }))}
              placeholder="Nobody assigned"
            />
          </div>
        ))}
        {examiners.length === 0 && <p className="text-sm text-muted-foreground">No staff have the examiner role yet.</p>}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={changed.length === 0 || saving} onClick={() => setValue(initial)}>
          Discard
        </Button>
        <Button
          disabled={(changed.length === 0 && inferred.length === 0) || saving}
          onClick={() =>
            void onSave(
              // Saving confirms inferred rows too, so send every subject that has any.
              subjects
                .filter((s) => changed.includes(s) || rows.some((r) => r.level_subject_id === s.id && r.inferred))
                .map((s) => ({ level_subject_id: s.id, user_ids: value[s.id] ?? [] })),
            )
          }
        >
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}
