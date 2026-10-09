import { useState } from 'react'
import { ArrowLeftRightIcon, LockIcon, LockOpenIcon, PrinterIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/auth/useAuth'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import { useClassWeek, useMoveOptions, useTeacherWeek, useTimetable, useTimetableMutations, type Lesson, type Timetable, type TimetableDetail } from '../api'
import { classRows, DAY_NAMES, subjectTotals, teacherRows } from '../week'
import { StatusBadge } from './GeneratePanel'
import { WeekGrid } from './WeekGrid'

export interface ViewerSelection {
  timetableId: number | null
  mode: 'class' | 'teacher'
  subjectId: number | null
}

export function TimetableViewer({ timetables, selection, onChange }: { timetables: Timetable[]; selection: ViewerSelection; onChange: (next: Partial<ViewerSelection>) => void }) {
  const viewable = timetables.filter((t) => ['draft', 'published', 'archived'].includes(t.status))
  const timetableId = selection.timetableId ?? viewable.find((t) => t.status === 'published')?.id ?? viewable[0]?.id ?? null
  const detail = useTimetable(timetableId)

  if (viewable.length === 0) {
    return <EmptyState title="Nothing to view yet" description="Generate a timetable first." />
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Select value={timetableId ? String(timetableId) : undefined} onValueChange={(v) => onChange({ timetableId: Number(v), subjectId: null })}>
          <SelectTrigger className="w-64" aria-label="Timetable">
            <SelectValue placeholder="Choose a timetable" />
          </SelectTrigger>
          <SelectContent>
            {viewable.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} ({t.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={selection.mode} onValueChange={(v) => onChange({ mode: v as ViewerSelection['mode'], subjectId: null })}>
          <TabsList>
            <TabsTrigger value="class">By class</TabsTrigger>
            <TabsTrigger value="teacher">By teacher</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <QueryState query={detail}>{(data) => <ViewerBody detail={data} selection={selection} onChange={onChange} />}</QueryState>
    </div>
  )
}

function ViewerBody({ detail, selection, onChange }: { detail: TimetableDetail; selection: ViewerSelection; onChange: (next: Partial<ViewerSelection>) => void }) {
  const options = selection.mode === 'class' ? detail.classes : detail.teachers
  const subjectId = options.some((o) => o.id === selection.subjectId) ? selection.subjectId : (options[0]?.id ?? null)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subjectId ? String(subjectId) : undefined} onValueChange={(v) => onChange({ subjectId: Number(v) })}>
            <SelectTrigger className="w-56 print:hidden" aria-label={selection.mode === 'class' ? 'Class' : 'Teacher'}>
              <SelectValue placeholder={selection.mode === 'class' ? 'Choose a class' : 'Choose a teacher'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                  {'lessons' in o ? ` · ${o.lessons}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <StatusBadge status={detail.status} />
        </div>
        <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
          <PrinterIcon /> Print
        </Button>
      </div>
      {subjectId === null ? (
        <EmptyState title="No lessons" />
      ) : selection.mode === 'class' ? (
        <ClassView detail={detail} classId={subjectId} />
      ) : (
        <TeacherView detail={detail} userId={subjectId} />
      )}
    </div>
  )
}

function ClassView({ detail, classId }: { detail: TimetableDetail; classId: number }) {
  const week = useClassWeek(detail.id, classId)
  const [selected, setSelected] = useState<Lesson | null>(null)
  const { can } = useAuth()
  const editable = detail.status === 'draft' && can('manage_timetables')

  return (
    <QueryState query={week}>
      {(data) => (
        <div className="grid gap-3">
          <h2 className="hidden text-lg font-semibold print:block">
            {data.class.name} — {detail.name}
          </h2>
          {editable && <p className="text-sm text-muted-foreground print:hidden">Click a lesson to move it, swap it or lock it.</p>}
          <WeekGrid days={data.schedule.days} rows={classRows(data.schedule.periods, data.lessons)} show="teacher" selectedId={selected?.id} onLessonClick={editable ? setSelected : undefined} />
          <Totals lessons={data.lessons} />
          {selected && <LessonDialog timetableId={detail.id} lesson={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </QueryState>
  )
}

function TeacherView({ detail, userId }: { detail: TimetableDetail; userId: number }) {
  const week = useTeacherWeek(detail.id, userId)

  return (
    <QueryState query={week}>
      {(data) => (
        <div className="grid gap-3">
          <h2 className="hidden text-lg font-semibold print:block">
            {data.teacher.name} — {detail.name}
          </h2>
          <WeekGrid days={data.days} rows={teacherRows(data.lessons)} show="class" />
          <Totals lessons={data.lessons} />
        </div>
      )}
    </QueryState>
  )
}

function Totals({ lessons }: { lessons: Lesson[] }) {
  return (
    <p className="text-sm text-muted-foreground">
      {lessons.length} lessons a week: {subjectTotals(lessons).map((t) => `${t.name} ${t.count}`).join(' · ')}
    </p>
  )
}

function LessonDialog({ timetableId, lesson, onClose }: { timetableId: number; lesson: Lesson; onClose: () => void }) {
  const options = useMoveOptions(timetableId, lesson.id)
  const { moveLesson, lockLesson } = useTimetableMutations()
  const busy = moveLesson.isPending || lockLesson.isPending

  async function move(day: number, period: number) {
    try {
      const result = await moveLesson.mutateAsync({ timetableId, lessonId: lesson.id, day, period_sequence: period })
      for (const warning of result.warnings ?? []) toast.warning(warning)
      toast.success('Moved.')
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function toggleLock() {
    try {
      await lockLesson.mutateAsync({ timetableId, lessonId: lesson.id, is_locked: !lesson.is_locked })
      toast.success(lesson.is_locked ? 'Unlocked.' : 'Locked. Generating again from this draft keeps it here.')
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {lesson.subject_name} · {lesson.class_name}
          </DialogTitle>
          <DialogDescription>
            {lesson.teacher_name} · {DAY_NAMES[lesson.day]} {lesson.starts_at}–{lesson.ends_at}
            {lesson.double_group !== null && ' · part of a double lesson (moving it splits the double)'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void toggleLock()}>
            {lesson.is_locked ? <LockOpenIcon /> : <LockIcon />} {lesson.is_locked ? 'Unlock' : 'Lock here'}
          </Button>
        </div>
        {lesson.is_locked ? (
          <p className="text-sm text-muted-foreground">Unlock this lesson to move it.</p>
        ) : (
          <QueryState query={options}>
            {(data) => {
              const days = [...new Set(data.map((o) => o.day))].sort()
              return (
                <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
                  <p className="text-sm text-muted-foreground">Move to an empty period, or swap with the lesson there. Greyed-out periods would double-book a teacher.</p>
                  {days.map((day) => (
                    <div key={day}>
                      <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">{DAY_NAMES[day]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {data
                          .filter((o) => o.day === day)
                          .map((o) => (
                            <Button
                              key={`${o.day}:${o.period_sequence}`}
                              variant={o.occupant_id === null ? 'outline' : 'secondary'}
                              size="sm"
                              disabled={!o.allowed || busy}
                              title={o.reason ?? (o.occupant_id === null ? 'Free period' : 'Swap with the lesson here')}
                              className={cn(!o.allowed && 'opacity-40')}
                              onClick={() => void move(o.day, o.period_sequence)}
                            >
                              {o.occupant_id !== null && <ArrowLeftRightIcon />}
                              {o.starts_at}
                            </Button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }}
          </QueryState>
        )}
      </DialogContent>
    </Dialog>
  )
}
