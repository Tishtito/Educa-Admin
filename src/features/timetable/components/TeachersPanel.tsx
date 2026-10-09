import { useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon, CopyIcon, Loader2Icon, SaveIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStaff } from '@/features/people/api'
import { useClasses } from '@/features/reference/api'
import { ApiError, errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import type { AcademicYear, SchoolClass, StaffMember } from '@/lib/api/types'
import {
  useGradeRequirements,
  useTeacherSubjects,
  useTeachingAssignments,
  useTimetableMutations,
  type RequirementRow,
  type SchoolSubject,
  type TeachingAssignment,
} from '../api'
import { groupSubjectsByLevel, sameIds } from '../teacherSubjects'

/** No pin: the generator gives the class a teacher who ticked the subject. */
const AUTOMATIC = 'auto'

type Mode = 'teacher' | 'pin'

const previousYearOf = (year: AcademicYear, years: AcademicYear[]) =>
  years.filter((y) => y.name < year.name).sort((a, b) => b.name.localeCompare(a.name))[0]

function validationMessage(error: unknown) {
  return error instanceof ApiError && error.isValidation ? Object.values(error.fieldErrors)[0]?.[0] ?? error.message : errorMessage(error)
}

/**
 * Who teaches what. Teachers tick the subjects they can teach and the generator
 * decides their classes; pinning a class's subject to one teacher is optional
 * and always wins.
 */
export function TeachersPanel({ year, years, classId, onClass }: { year: AcademicYear; years: AcademicYear[]; classId: number | null; onClass: (id: number) => void }) {
  const [mode, setMode] = useState<Mode>('teacher')

  return (
    <div className="grid gap-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="teacher">By teacher</TabsTrigger>
          <TabsTrigger value="pin">Pin to a class (optional)</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'teacher' ? <ByTeacher year={year} years={years} /> : <PinPanel year={year} years={years} classId={classId} onClass={onClass} />}
    </div>
  )
}

// ------------------------------------------------------------- by teacher

function ByTeacher({ year, years }: { year: AcademicYear; years: AcademicYear[] }) {
  const staff = useStaff()
  const data = useTeacherSubjects(year.id)
  const active = (staff.data ?? []).filter((s) => s.is_active).sort((a, b) => a.name.localeCompare(b.name))
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const teacher = active.find((s) => s.id === teacherId) ?? active[0] ?? null
  const previous = previousYearOf(year, years)
  const { teacherSubjectsFromExaminers, copyTeacherSubjects } = useTimetableMutations()

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Tick the subjects each teacher can teach. When the timetable is generated, each class’s subject goes to one of the teachers who ticked it,
        sharing the load evenly. To fix a class to a particular teacher, pin it.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TeacherPicker staff={active} value={teacher?.id ?? null} onChange={setTeacherId} />
        <div className="flex flex-wrap gap-2">
          <ConfirmDialog
            trigger={
              <Button variant="outline">
                <UsersIcon /> Tick from examiner assignments
              </Button>
            }
            title="Tick subjects from examiner assignments?"
            description="Everyone who marks a subject this year gets it ticked as a subject they teach. No tick is removed."
            confirmLabel="Tick"
            onConfirm={async () => {
              const result = await teacherSubjectsFromExaminers.mutateAsync(year.id)
              toast.success(`${result.created} subject${result.created === 1 ? '' : 's'} ticked.`)
            }}
          />
          {previous && (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <CopyIcon /> Copy from {previous.name}
                </Button>
              }
              title={`Copy ${previous.name}'s teacher subjects into ${year.name}?`}
              description="Each teacher's ticked subjects carry over. Anything already ticked for this year is kept."
              confirmLabel="Copy"
              onConfirm={async () => {
                const result = await copyTeacherSubjects.mutateAsync({ from_year_id: previous.id, to_year_id: year.id })
                toast.success(`Copied ${result.created} subject${result.created === 1 ? '' : 's'}.`)
              }}
            />
          )}
        </div>
      </div>
      <QueryState query={data}>
        {(response) =>
          response.subjects.length === 0 ? (
            <EmptyState title="No subjects" description="Add subjects under School set-up first." />
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
              {teacher ? (
                <TeacherSubjectsForm
                  key={`${teacher.id}:${year.id}:${data.dataUpdatedAt}`}
                  year={year}
                  teacher={teacher}
                  subjects={response.subjects}
                  ticked={response.teachers.find((t) => t.user_id === teacher.id)?.level_subject_ids ?? []}
                />
              ) : (
                <EmptyState title="No active staff" description="Add staff under People first." />
              )}
              <SubjectCoverage subjects={response.subjects} />
            </div>
          )
        }
      </QueryState>
    </div>
  )
}

function TeacherPicker({ staff, value, onChange }: { staff: StaffMember[]; value: number | null; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const current = staff.find((s) => s.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64 justify-between font-normal" aria-label="Teacher">
          <span className={cn('truncate', !current && 'text-muted-foreground')}>{current?.name ?? 'Choose a teacher'}</span>
          <ChevronsUpDownIcon className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search staff…" />
          <CommandList>
            <CommandEmpty>No active staff found.</CommandEmpty>
            <CommandGroup>
              {staff.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.name} ${member.username}`}
                  onSelect={() => {
                    onChange(member.id)
                    setOpen(false)
                  }}
                >
                  <CheckIcon className={cn('size-4', member.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">{member.name}</span>
                  <span className="text-xs text-muted-foreground">@{member.username}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function TeacherSubjectsForm({ year, teacher, subjects, ticked }: { year: AcademicYear; teacher: StaffMember; subjects: SchoolSubject[]; ticked: number[] }) {
  const { setTeacherSubjects } = useTimetableMutations()
  const [value, setValue] = useState<number[]>(ticked)
  const changed = !sameIds(value, ticked)
  const toggle = (id: number, on: boolean) => setValue((v) => (on ? [...v.filter((x) => x !== id), id] : v.filter((x) => x !== id)))

  async function save() {
    try {
      await setTeacherSubjects.mutateAsync({ userId: teacher.id, yearId: year.id, levelSubjectIds: value })
      toast.success(`${teacher.name}’s subjects saved.`)
    } catch (error) {
      toast.error(validationMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subjects {teacher.name} can teach</CardTitle>
        <CardDescription>
          {value.length === 0 ? 'Nothing ticked: the generator will not give them any class.' : `${value.length} subject${value.length === 1 ? '' : 's'} ticked for ${year.name}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {groupSubjectsByLevel(subjects).map((group) => (
          <fieldset key={group.key} className="grid content-start gap-2">
            <legend className="mb-1 text-sm font-medium">{group.label}</legend>
            {group.subjects.map((subject) => {
              const id = `ts-${subject.level_subject_id}`
              return (
                <div key={subject.level_subject_id} className="flex items-center gap-2">
                  <Checkbox id={id} checked={value.includes(subject.level_subject_id)} onCheckedChange={(on) => toggle(subject.level_subject_id, on === true)} />
                  <Label htmlFor={id} className="font-normal">
                    {subject.subject_name}
                  </Label>
                </div>
              )
            })}
          </fieldset>
        ))}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={!changed || setTeacherSubjects.isPending} onClick={() => setValue(ticked)}>
          Discard
        </Button>
        <Button disabled={!changed || setTeacherSubjects.isPending} onClick={() => void save()}>
          {setTeacherSubjects.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save
        </Button>
      </CardFooter>
    </Card>
  )
}

function SubjectCoverage({ subjects }: { subjects: SchoolSubject[] }) {
  const uncovered = subjects.filter((s) => s.teachers_count === 0).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teachers per subject</CardTitle>
        <CardDescription>
          {uncovered === 0 ? 'Every subject has at least one teacher.' : `${uncovered} subject${uncovered === 1 ? ' has' : 's have'} nobody yet.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {groupSubjectsByLevel(subjects).map((group) => (
          <div key={group.key} className="grid gap-0.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</p>
            {group.subjects.map((subject) => (
              <div key={subject.level_subject_id} className="flex justify-between gap-4 border-b py-1 last:border-0">
                <span>{subject.subject_name}</span>
                <span className={cn('tabular-nums', subject.teachers_count === 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                  {subject.teachers_count === 0 ? 'nobody' : subject.teachers_count}
                </span>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------------- pins

function PinPanel({ year, years, classId, onClass }: { year: AcademicYear; years: AcademicYear[]; classId: number | null; onClass: (id: number) => void }) {
  const classes = useClasses({ active: true })
  const all = useTeachingAssignments(year.id)
  const selected = classes.data?.find((c) => c.id === classId) ?? classes.data?.[0] ?? null
  const previous = previousYearOf(year, years)
  const { teachersFromExaminers, copyTeachers } = useTimetableMutations()

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Optional: classes left on Automatic are given a teacher who ticked the subject when the timetable is generated. Pin a subject to fix a class
        to one teacher; a pin always wins.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={selected ? String(selected.id) : undefined} onValueChange={(v) => onClass(Number(v))}>
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
        <div className="flex flex-wrap gap-2">
          <ConfirmDialog
            trigger={
              <Button variant="outline">
                <UsersIcon /> Pin from examiners
              </Button>
            }
            title="Pin from examiner assignments?"
            description="Whoever marks a subject in a class is pinned as its teacher, where the subject is still on Automatic. No pin is replaced."
            confirmLabel="Pin"
            onConfirm={async () => {
              const result = await teachersFromExaminers.mutateAsync(year.id)
              toast.success(`${result.created} pin${result.created === 1 ? '' : 's'} added.`)
            }}
          />
          {previous && (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <CopyIcon /> Copy from {previous.name}
                </Button>
              }
              title={`Copy ${previous.name}'s pins into ${year.name}?`}
              description="Pins carry over class by class. Anything already pinned for this year is kept."
              confirmLabel="Copy"
              onConfirm={async () => {
                const result = await copyTeachers.mutateAsync({ from_year_id: previous.id, to_year_id: year.id })
                toast.success(`Copied ${result.created} pin${result.created === 1 ? '' : 's'}.`)
              }}
            />
          )}
        </div>
      </div>
      {selected ? (
        <ClassTeachers key={`${selected.id}:${year.id}`} year={year} schoolClass={selected} />
      ) : (
        <EmptyState title="No classes" description="Add classes under School set-up first." />
      )}
      <QueryState query={all}>{(data) => <TeacherLoad assignments={data.assignments} />}</QueryState>
    </div>
  )
}

function ClassTeachers({ year, schoolClass }: { year: AcademicYear; schoolClass: SchoolClass }) {
  const staff = useStaff()
  const subjects = useGradeRequirements(year.id, schoolClass.grade_id)
  const assignments = useTeachingAssignments(year.id, schoolClass.id)
  const active = (staff.data ?? []).filter((s) => s.is_active)

  return (
    <QueryState query={assignments}>
      {(data) => (
        <QueryState query={subjects}>
          {(grade) =>
            grade === null || grade.subjects.length === 0 ? (
              <EmptyState title="No subjects at this class’s level" />
            ) : (
              <ClassTeachersForm
                key={assignments.dataUpdatedAt}
                year={year}
                schoolClass={schoolClass}
                subjects={grade.subjects}
                staff={active}
                rows={data.assignments}
              />
            )
          }
        </QueryState>
      )}
    </QueryState>
  )
}

function ClassTeachersForm({
  year,
  schoolClass,
  subjects,
  staff,
  rows,
}: {
  year: AcademicYear
  schoolClass: SchoolClass
  subjects: RequirementRow[]
  staff: StaffMember[]
  rows: TeachingAssignment[]
}) {
  const { setTeachers } = useTimetableMutations()
  const initial = Object.fromEntries(subjects.map((s) => [s.level_subject_id, rows.find((r) => r.level_subject_id === s.level_subject_id)?.user_id ?? null]))
  const [value, setValue] = useState<Record<number, number | null>>(initial)
  const changed = subjects.filter((s) => value[s.level_subject_id] !== initial[s.level_subject_id])

  async function save() {
    try {
      await setTeachers.mutateAsync({
        classId: schoolClass.id,
        yearId: year.id,
        subjects: changed.map((s) => ({ level_subject_id: s.level_subject_id, user_id: value[s.level_subject_id] ?? null })),
      })
      toast.success(`Pins for ${schoolClass.name} saved.`)
    } catch (error) {
      toast.error(validationMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pinned teachers for {schoolClass.name}</CardTitle>
        <CardDescription>Automatic: a teacher who ticked the subject is chosen when the timetable is generated. Subjects with no lessons a week are not timetabled.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {subjects.map((subject) => {
          const current = rows.find((r) => r.level_subject_id === subject.level_subject_id)
          return (
            <div key={subject.level_subject_id} className="grid items-center gap-2 sm:grid-cols-[14rem_1fr]">
              <div>
                <span className="font-medium">{subject.subject_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {subject.lessons_per_week > 0 ? `${subject.lessons_per_week} a week` : 'not timetabled'}
                </span>
                {current && !current.user_active && <p className="text-xs text-destructive">{current.user_name}’s account is deactivated.</p>}
              </div>
              <Select
                value={value[subject.level_subject_id] ? String(value[subject.level_subject_id]) : AUTOMATIC}
                onValueChange={(v) => setValue((s) => ({ ...s, [subject.level_subject_id]: v === AUTOMATIC ? null : Number(v) }))}
              >
                <SelectTrigger aria-label={`Teacher of ${subject.subject_name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTOMATIC}>Automatic</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={changed.length === 0 || setTeachers.isPending} onClick={() => setValue(initial)}>
          Discard
        </Button>
        <Button disabled={changed.length === 0 || setTeachers.isPending} onClick={() => void save()}>
          {setTeachers.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save
        </Button>
      </CardFooter>
    </Card>
  )
}

function TeacherLoad({ assignments }: { assignments: TeachingAssignment[] }) {
  const byTeacher = new Map<number, { name: string; classes: Set<string>; subjects: number }>()
  for (const a of assignments) {
    const entry = byTeacher.get(a.user_id) ?? { name: a.user_name ?? 'Unknown', classes: new Set<string>(), subjects: 0 }
    entry.classes.add(a.class_name ?? '')
    entry.subjects += 1
    byTeacher.set(a.user_id, entry)
  }
  const rows = [...byTeacher.values()].sort((a, b) => b.subjects - a.subjects || a.name.localeCompare(b.name))
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pins per teacher</CardTitle>
        <CardDescription>Pinned class subjects per teacher this year. The readiness check warns when someone has more lessons than periods.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        {rows.map((row) => (
          <div key={row.name} className="flex justify-between gap-4 border-b py-1.5 last:border-0">
            <span className="font-medium">{row.name}</span>
            <span className="text-muted-foreground">
              {row.subjects} subject{row.subjects === 1 ? '' : 's'} in {row.classes.size} class{row.classes.size === 1 ? '' : 'es'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
