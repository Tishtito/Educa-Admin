import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowRightLeftIcon, ChevronDownIcon, ChevronLeftIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAcademicYears, useClasses } from '@/features/reference/api'
import { errorMessage } from '@/lib/api/errors'
import type { Student, StudentResult, StudentStatus } from '@/lib/api/types'
import { formatDate, formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStudent, useStudentMutations, useStudentResults } from '../api'
import { StudentDialog } from '../components/StudentDialog'
import { studentStatusLabel } from '../labels'

export function StudentDetailPage() {
  const id = Number(useParams().studentId)
  const student = useStudent(id)

  return (
    <>
      <Link to="/students" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Pupils
      </Link>
      <QueryState query={student}>{(data) => <StudentProfile student={data} />}</QueryState>
    </>
  )
}

function StudentProfile({ student }: { student: Student }) {
  const navigate = useNavigate()
  const years = useAcademicYears()
  const { setStatus, remove } = useStudentMutations()
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [statusChange, setStatusChange] = useState<StudentStatus | null>(null)
  const currentYearId = years.data?.find((y) => y.is_current)?.id
  const current = student.enrolments?.find((e) => e.academic_year_id === currentYearId)

  const details: [string, string | null][] = [
    ['Admission no.', student.admission_no],
    ['UPI', student.upi],
    ['Gender', student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1) : null],
    ['Date of birth', student.date_of_birth ? formatDate(student.date_of_birth) : null],
    ['Guardian', student.guardian_name],
    ['Guardian phone', student.guardian_phone],
  ]

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {student.full_name}
            <Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>{studentStatusLabel[student.status]}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {current ? `${current.class_name} · ${current.academic_year}` : 'Not in a class this year'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" onClick={() => setMoving(true)}>
            <ArrowRightLeftIcon /> {current ? 'Move class' : 'Place in a class'}
          </Button>
          <Select value="" onValueChange={(v) => setStatusChange(v as StudentStatus)}>
            <SelectTrigger className="w-40" aria-label="Change status">
              <SelectValue placeholder="Change status…" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(studentStatusLabel) as StudentStatus[])
                .filter((s) => s !== student.status)
                .map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'active' ? 'Mark active again' : `Mark ${studentStatusLabel[s].toLowerCase()}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                {details.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classes by year</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {student.enrolments?.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{e.academic_year}</span> · {e.class_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.status === 'active' ? '' : e.status === 'promoted' ? 'moved up' : `left ${formatDate(e.ended_on)}`}
                    </span>
                  </li>
                ))}
                {student.enrolments?.length === 0 && <li className="text-muted-foreground">Never enrolled.</li>}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base">Admitted by mistake?</CardTitle>
              <CardDescription>A pupil with no marks or report card entries can be deleted.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    <Trash2Icon /> Delete pupil
                  </Button>
                }
                title={`Delete ${student.full_name}?`}
                description="Their record and class history are removed. If they have left the school, mark them transferred instead."
                confirmLabel="Delete"
                destructive
                onConfirm={async () => {
                  await remove.mutateAsync(student.id)
                  toast.success('Pupil deleted.')
                  navigate('/students', { replace: true })
                }}
              />
            </CardContent>
          </Card>
        </div>
        <ResultsCard studentId={student.id} />
      </div>

      {editing && <StudentDialog open onOpenChange={setEditing} student={student} />}
      {moving && <MoveDialog open onOpenChange={setMoving} student={student} currentClassId={current?.class_id} />}
      <StatusDialog
        student={student}
        status={statusChange}
        onClose={() => setStatusChange(null)}
        onConfirm={async (status, endedOn) => {
          try {
            await setStatus.mutateAsync({ id: student.id, status, ended_on: endedOn })
            toast.success(`${student.full_name} is now ${studentStatusLabel[status].toLowerCase()}.`)
            setStatusChange(null)
          } catch (error) {
            toast.error(errorMessage(error))
          }
        }}
      />
    </>
  )
}

function MoveDialog({ open, onOpenChange, student, currentClassId }: { open: boolean; onOpenChange: (open: boolean) => void; student: Student; currentClassId?: number }) {
  const classes = useClasses({ active: true })
  const { move } = useStudentMutations()
  const [classId, setClassId] = useState(currentClassId ? String(currentClassId) : '')

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Move ${student.full_name}`}
      description="Changes their class for the current year. Results already recorded stay with the class they were earned in."
      submitLabel="Move"
      busy={move.isPending}
      onSubmit={() => {
        if (!classId || Number(classId) === currentClassId) return onOpenChange(false)
        move.mutate(
          { id: student.id, class_id: Number(classId) },
          { onSuccess: () => (toast.success('Class changed.'), onOpenChange(false)), onError: (e) => toast.error(e.message) },
        )
      }}
    >
      <Field label="Class">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-full">
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
      </Field>
    </FormDialog>
  )
}

function StatusDialog({
  student,
  status,
  onClose,
  onConfirm,
}: {
  student: Student
  status: StudentStatus | null
  onClose: () => void
  onConfirm: (status: StudentStatus, endedOn: string | null) => Promise<void>
}) {
  const [endedOn, setEndedOn] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const leaving = status !== null && status !== 'active'

  return (
    <FormDialog
      open={status !== null}
      onOpenChange={(open) => !open && onClose()}
      title={status === 'active' ? `Mark ${student.full_name} active again?` : `Mark ${student.full_name} ${status ? studentStatusLabel[status].toLowerCase() : ''}?`}
      description={
        leaving
          ? 'Their place in this year’s class is closed on the date below. Their results and report cards are kept.'
          : 'They are placed back in this year’s class they left, if any.'
      }
      submitLabel="Confirm"
      busy={busy}
      onSubmit={async () => {
        if (!status) return
        setBusy(true)
        await onConfirm(status, leaving ? endedOn : null)
        setBusy(false)
      }}
    >
      {leaving && (
        <Field label="Left on" htmlFor="left-on">
          <Input id="left-on" type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} className="max-w-48" />
        </Field>
      )}
    </FormDialog>
  )
}

function ResultsCard({ studentId }: { studentId: number }) {
  const results = useStudentResults(studentId)
  const [open, setOpen] = useState<number | null>(null)

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-base">Results</CardTitle>
        <CardDescription>Every exam with final results. Select a row to see subjects.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <QueryState query={results}>
          {(data) =>
            data.length === 0 ? (
              <EmptyState title="No results yet" description="Results appear once an exam this pupil sat is locked." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Mean</TableHead>
                    <TableHead className="text-right">Position</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((result) => (
                    <ResultRows key={result.exam.id} result={result} open={open === result.exam.id} onToggle={() => setOpen(open === result.exam.id ? null : result.exam.id)} />
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryState>
      </CardContent>
    </Card>
  )
}

function ResultRows({ result, open, onToggle }: { result: StudentResult; open: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <TableRow className="cursor-pointer" onClick={onToggle} aria-expanded={open}>
        <TableCell>
          <Link to={`/exams/${result.exam.id}/marklist`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {result.exam.name}
          </Link>
          <div className="text-xs text-muted-foreground">{[result.exam.academic_year, result.exam.term].filter(Boolean).join(' · ')}</div>
        </TableCell>
        <TableCell>{result.class_name}</TableCell>
        <TableCell className="text-right tabular-nums">{formatScore(result.total_marks)}</TableCell>
        <TableCell className="text-right tabular-nums">
          {formatScore(result.mean_marks)} {result.mean_band && <span className="text-xs text-muted-foreground">{result.mean_band}</span>}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums">
          {result.grade_position ? `${result.grade_position}/${result.grade_cohort_size}` : '—'}
        </TableCell>
        <TableCell>
          <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6}>
            <div className="grid gap-x-6 gap-y-1 py-1 text-sm sm:grid-cols-2">
              {result.subjects.map((s) => (
                <div key={s.level_subject_id} className="flex justify-between gap-2">
                  <span>{s.name}</span>
                  <span className="tabular-nums">
                    {s.is_absent ? 'Absent' : formatScore(s.score)} {s.band && <span className="text-xs text-muted-foreground">{s.band}</span>}
                  </span>
                </div>
              ))}
              {!result.is_complete && <p className="text-xs text-muted-foreground sm:col-span-2">Not every subject was marked for this exam.</p>}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
