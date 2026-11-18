import { LockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lesson } from '../api'
import { dayShort, subjectTone, type WeekRow } from '../week'

/**
 * A week as a table: one row per period (or lesson time), one column per day.
 * Breaks span the whole row. Prints on one landscape page.
 */
export function WeekGrid({
  days,
  rows,
  show,
  selectedId,
  onLessonClick,
}: {
  days: number[]
  rows: WeekRow[]
  /** What each lesson cell names besides its subject. */
  show: 'teacher' | 'class'
  selectedId?: number | null
  onLessonClick?: (lesson: Lesson) => void
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No lessons.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border print:overflow-visible print:border-0">
      <table className="w-full min-w-[44rem] table-fixed border-collapse text-sm print:min-w-0 print:text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="w-24 border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
            {days.map((day) => (
              <th key={day} className="border-b border-l px-2 py-2 text-left font-medium">
                {dayShort(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.kind === 'lesson' ? (
              <tr key={row.key} className="align-top">
                <td className="border-b px-2 py-1.5 text-xs tabular-nums text-muted-foreground">
                  {row.starts_at}
                  <br />
                  {row.ends_at}
                </td>
                {days.map((day) => (
                  <td key={day} className="h-14 border-b border-l p-1">
                    {(row.cells[day] ?? []).map((lesson) => (
                      <LessonCell
                        key={lesson.id}
                        lesson={lesson}
                        show={show}
                        selected={lesson.id === selectedId}
                        onClick={onLessonClick ? () => onLessonClick(lesson) : undefined}
                      />
                    ))}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={row.key}>
                <td className="border-b bg-muted/30 px-2 py-1 text-xs tabular-nums text-muted-foreground">
                  {row.starts_at}–{row.ends_at}
                </td>
                <td colSpan={days.length} className="border-b border-l bg-muted/30 px-2 py-1 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {row.label ?? (row.kind === 'lunch' ? 'Lunch' : 'Break')}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function LessonCell({ lesson, show, selected, onClick }: { lesson: Lesson; show: 'teacher' | 'class'; selected: boolean; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-1">
        <span className="truncate font-medium">{lesson.subject_code ?? lesson.subject_name}</span>
        {lesson.double_group !== null && <span className="text-[10px] text-muted-foreground">×2</span>}
        {lesson.is_locked && <LockIcon className="ml-auto size-3 shrink-0 text-muted-foreground" aria-label="Locked" />}
      </div>
      <div className="truncate text-xs text-muted-foreground">{show === 'teacher' ? lesson.teacher_name : lesson.class_name}</div>
    </>
  )
  const className = cn(
    'block w-full rounded-md border px-1.5 py-1 text-left print:border-gray-300 print:bg-transparent',
    subjectTone(lesson.level_subject_id),
    selected && 'ring-2 ring-primary',
  )

  return onClick ? (
    <button type="button" className={cn(className, 'transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')} onClick={onClick} title={lesson.subject_name ?? undefined}>
      {body}
    </button>
  ) : (
    <div className={className} title={lesson.subject_name ?? undefined}>
      {body}
    </div>
  )
}
