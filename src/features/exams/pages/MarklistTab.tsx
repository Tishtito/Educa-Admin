import { DownloadIcon, ListOrderedIcon, PrinterIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { saveBlob } from '@/lib/download'
import { formatScore } from '@/lib/format'
import type { Marklist } from '@/lib/api/types'
import { useMarklist } from '../api'
import { ClassSelect } from '../components/ClassSelect'
import { hasFinalResults } from '../lifecycle'
import { marklistToCsv } from '../marklist/csv'
import { useExamContext, useSelectedClass } from '../useExamContext'

export function MarklistTab() {
  const { exam } = useExamContext()
  const [classId, setClassId] = useSelectedClass(exam)
  const marklist = useMarklist(exam.id, classId)
  const classes = exam.classes ?? []

  if (exam.status === 'draft' || exam.status === 'open') {
    return (
      <EmptyState
        icon={<ListOrderedIcon />}
        title="No results yet"
        description="Mark lists appear once marking has started and results have been computed."
      />
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <ClassSelect classes={classes} value={classId} onChange={setClassId} />
        {marklist.data && (
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <PrinterIcon /> Print
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const csv = marklistToCsv(marklist.data)
                void saveBlob(
                  new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
                  `${exam.name} ${marklist.data.class.name} mark list.csv`,
                )
              }}
            >
              <DownloadIcon /> CSV
            </Button>
          </>
        )}
      </div>

      {!hasFinalResults(exam.status) && (
        <Alert className="mb-4 print:hidden">
          <AlertDescription>Marking is still open. These results are provisional and change as marks are entered.</AlertDescription>
        </Alert>
      )}

      {classId === null ? (
        <EmptyState title="Choose a class" description="Pick a class to see its ranked mark list." />
      ) : (
        <QueryState query={marklist}>{(data) => <MarklistTable marklist={data} examName={exam.name} />}</QueryState>
      )}
    </>
  )
}

function MarklistTable({ marklist, examName }: { marklist: Marklist; examName: string }) {
  if (marklist.students.length === 0) {
    return <EmptyState title="No results for this class" description="Results appear after marks are entered and computed." />
  }

  const cohort = marklist.students.find((s) => s.grade_cohort_size)?.grade_cohort_size

  return (
    <>
      <div className="mb-3 hidden print:block">
        <h2 className="text-lg font-semibold">
          {examName} — {marklist.class.name}
        </h2>
      </div>
      <Card className="overflow-x-auto p-0 print:border-0 print:shadow-none">
        <table className="w-full min-w-max text-sm print:text-[10px]">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-2 py-2 text-right font-medium" title={`Position in ${marklist.class.grade ?? 'grade'}`}>
                Pos
              </th>
              <th className="px-2 py-2 text-right font-medium" title="Position in stream">
                Str
              </th>
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium print:static print:bg-transparent">Pupil</th>
              {marklist.subjects.map((subject) => (
                <th key={subject.level_subject_id} className="px-2 py-2 text-right font-medium" title={subject.name}>
                  {subject.code || subject.name}
                  {!subject.counts_toward_total && <span className="text-muted-foreground">*</span>}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Mean</th>
              <th className="px-2 py-2 font-medium">Level</th>
            </tr>
          </thead>
          <tbody>
            {marklist.students.map((student) => (
              <tr key={student.student_id} className="border-b hover:bg-muted/30">
                <td className="px-2 py-1.5 text-right tabular-nums">{student.grade_position ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{student.stream_position ?? '—'}</td>
                <td className="sticky left-0 z-10 max-w-56 bg-card px-3 py-1.5 print:static">
                  <div className="truncate font-medium">{student.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {student.assessment_no}
                    {!student.is_complete && ` · ${student.subjects_counted}/${student.subjects_expected} subjects`}
                  </div>
                </td>
                {marklist.subjects.map((subject) => {
                  const score = student.scores.find((s) => s.level_subject_id === subject.level_subject_id)
                  return (
                    <td
                      key={subject.level_subject_id}
                      className="px-2 py-1.5 text-right tabular-nums"
                      title={score?.band_label ?? undefined}
                    >
                      {score?.is_absent ? (
                        <span className="text-xs text-muted-foreground">ABS</span>
                      ) : (
                        <>
                          {formatScore(score?.score)}
                          {score?.band && <div className="text-[10px] text-muted-foreground">{score.band}</div>}
                        </>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatScore(student.total_marks)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(student.mean_marks)}</td>
                <td className={cn('px-2 py-1.5 text-xs', !student.mean_band && 'text-muted-foreground')} title={student.mean_band_label ?? undefined}>
                  {student.mean_band ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40">
            <tr>
              <td />
              <td />
              <td className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium print:static print:bg-transparent">Class mean</td>
              {marklist.subjects.map((subject) => (
                <td key={subject.level_subject_id} className="px-2 py-2 text-right font-medium tabular-nums">
                  {formatScore(subject.class_mean)}
                </td>
              ))}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        Pos is the position in {marklist.class.grade ?? 'the grade'}
        {cohort ? ` (of ${cohort})` : ''}; Str is the position within {marklist.class.name}.
        {marklist.subjects.some((s) => !s.counts_toward_total) && ' * does not count toward the total.'}
      </p>
    </>
  )
}
