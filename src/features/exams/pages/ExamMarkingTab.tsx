import { Link } from 'react-router'
import { CheckCircle2Icon, ChevronRightIcon, ClipboardPenIcon, EyeIcon } from 'lucide-react'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { MarkingSheet } from '@/lib/api/types'
import { useMarking } from '../api'
import { useExamContext } from '../useExamContext'

export function ExamMarkingTab() {
  const { exam } = useExamContext()
  const marking = useMarking(exam.id)

  if (exam.status === 'draft') {
    return (
      <EmptyState
        icon={<ClipboardPenIcon />}
        title="Marking has not been set up"
        description="Open the exam first. Opening adds the subjects for each class, and then you can set marks-out-of and start marking."
      />
    )
  }

  return (
    <QueryState query={marking}>
      {(data) => {
        const byClass = new Map<string, MarkingSheet[]>()
        for (const sheet of data.sheets) {
          byClass.set(sheet.class_name, [...(byClass.get(sheet.class_name) ?? []), sheet])
        }
        const entered = data.sheets.reduce((sum, s) => sum + s.marks_entered, 0)
        const expected = data.sheets.reduce((sum, s) => sum + s.marks_expected, 0)
        const complete = data.sheets.filter((s) => s.is_complete).length

        if (data.sheets.length === 0) {
          return (
            <EmptyState
              title="No marksheets"
              description="This exam has no subjects for its classes. Check that the classes’ level has active subjects."
            />
          )
        }

        return (
          <div className="grid gap-4">
            {exam.status !== 'marking' && (
              <Alert>
                <AlertDescription>
                  {exam.status === 'open'
                    ? 'Marking has not started. You can open a sheet to check or set marks-out-of.'
                    : 'Marking is closed. Sheets are read-only.'}
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-48 flex-1">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Marks entered</span>
                    <span className="tabular-nums text-muted-foreground">
                      {entered} / {expected}
                    </span>
                  </div>
                  <Progress value={expected ? (entered / expected) * 100 : 0} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {complete} of {data.sheets.length} sheets complete
                </div>
              </CardContent>
            </Card>

            {[...byClass.entries()].map(([className, sheets]) => (
              <Card key={className}>
                <CardHeader>
                  <CardTitle className="text-base">{className}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {sheets.map((sheet) => (
                    <SheetLink key={`${sheet.class_id}:${sheet.level_subject_id}`} sheet={sheet} editable={exam.accepts_score_entry} />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      }}
    </QueryState>
  )
}

function SheetLink({ sheet, editable }: { sheet: MarkingSheet; editable: boolean }) {
  const percent = sheet.marks_expected ? Math.round((sheet.marks_entered / sheet.marks_expected) * 100) : 0
  const Icon = editable && sheet.can_enter ? ClipboardPenIcon : EyeIcon

  return (
    <Link
      to={`${sheet.class_id}/${sheet.level_subject_id}`}
      className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{sheet.subject_name}</span>
          <span className="text-xs text-muted-foreground">{sheet.subject_code}</span>
          {sheet.is_complete && <CheckCircle2Icon className="size-3.5 text-emerald-600" aria-label="Complete" />}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Progress value={percent} className="h-1.5" />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {sheet.marks_entered}/{sheet.marks_expected}
          </span>
        </div>
        {sheet.papers.length > 1 && (
          <div className="mt-1 truncate text-xs text-muted-foreground">{sheet.papers.map((p) => p.name).join(' · ')}</div>
        )}
      </div>
      <Icon className="size-4 text-muted-foreground" />
      <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
