import { useState } from 'react'
import { Link } from 'react-router'
import { CalculatorIcon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ComputeSummary, ExamStatus } from '@/lib/api/types'
import { formatDate, formatDateTime } from '@/lib/format'
import { useComputeExam, useTransitionExam } from '../api'
import { LifecycleStepper } from '../components/LifecycleStepper'
import { canCompute, statusExplanation, transitionCopy } from '../lifecycle'
import { examStatusLabel, examTransitions } from '../status'
import { useExamContext } from '../useExamContext'

const meanPolicyLabel = {
  all_entered: 'Every pupil with marks',
  complete_students_only: 'Only pupils with every subject',
}

const tiePolicyLabel = {
  competition: 'Shared rank, next rank skipped (1, 1, 3)',
  dense: 'Shared rank, no gap (1, 1, 2)',
  legacy_ordinal: 'No ties (legacy import)',
}

export function ExamOverviewTab() {
  const { exam } = useExamContext()
  const transition = useTransitionExam(exam.id)
  const compute = useComputeExam(exam.id)
  const [summary, setSummary] = useState<ComputeSummary | null>(null)

  const moves = examTransitions[exam.status]
    .map((to) => ({ to, copy: transitionCopy[`${exam.status}->${to}`] }))
    .filter((move): move is { to: ExamStatus; copy: NonNullable<typeof move.copy> } => !!move.copy)
    .sort((a, b) => Number(!!b.copy.primary) - Number(!!a.copy.primary))

  const noClasses = (exam.classes?.length ?? 0) === 0

  async function move(to: ExamStatus) {
    await transition.mutateAsync(to)
    toast.success(`${exam.name} is now ${examStatusLabel[to].toLowerCase()}.`)
  }

  async function recompute() {
    const result = await compute.mutateAsync()
    setSummary(result)
    toast.success('Results recomputed.')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
          <CardDescription>{statusExplanation[exam.status]}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <LifecycleStepper status={exam.status} />

          {exam.status === 'draft' && noClasses && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>This exam covers no classes</AlertTitle>
              <AlertDescription>It cannot be opened until it has at least one class.</AlertDescription>
            </Alert>
          )}

          {exam.is_legacy_import && (
            <Alert>
              <AlertTitle>Imported from the old system</AlertTitle>
              <AlertDescription>Positions keep the old system’s tie-free ranking, so pupils with equal marks may hold different positions.</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            {moves.map(({ to, copy }) => (
              <ConfirmDialog
                key={to}
                trigger={
                  <Button variant={copy.primary ? 'default' : 'outline'} disabled={transition.isPending}>
                    {copy.label}
                  </Button>
                }
                title={copy.title}
                description={
                  <ul className="list-disc space-y-1 pl-5">
                    {copy.consequences.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                }
                confirmLabel={copy.label}
                destructive={copy.destructive}
                onConfirm={() => move(to)}
              />
            ))}
            {canCompute(exam.status) && (
              <Button variant="outline" onClick={() => void recompute().catch(() => undefined)} disabled={compute.isPending}>
                <CalculatorIcon /> {compute.isPending ? 'Computing…' : 'Recompute results'}
              </Button>
            )}
            {moves.length === 0 && !canCompute(exam.status) && (
              <p className="text-sm text-muted-foreground">No further steps for this exam.</p>
            )}
          </div>

          {summary && <ComputeSummaryPanel summary={summary} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <Detail label="Type">{exam.exam_type_label}</Detail>
            <Detail label="Year / term">{[exam.academic_year?.name, exam.term?.name].filter(Boolean).join(' · ') || '—'}</Detail>
            <Detail label="Level">{exam.level?.name ?? 'All levels'}</Detail>
            <Detail label="Dates">{exam.starts_on ? `${formatDate(exam.starts_on)} – ${formatDate(exam.ends_on)}` : '—'}</Detail>
            <Detail label="Class mean">{meanPolicyLabel[exam.mean_policy]}</Detail>
            <Detail label="Ties">{tiePolicyLabel[exam.tie_policy]}</Detail>
            {exam.published_at && <Detail label="Published">{formatDateTime(exam.published_at)}</Detail>}
            <Detail label="Classes">
              {noClasses ? (
                '—'
              ) : (
                <div className="flex flex-wrap gap-1">
                  {exam.classes?.map((item) => (
                    <Badge key={item.id} variant="secondary">
                      <Link to={`marklist?class=${item.id}`}>{item.name}</Link>
                    </Badge>
                  ))}
                </div>
              )}
            </Detail>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function ComputeSummaryPanel({ summary }: { summary: ComputeSummary }) {
  const stats: [string, number][] = [
    ['Pupils', summary.students],
    ['With every subject', summary.complete_students],
    ['Subject scores', summary.subject_scores],
    ['Absent subjects', summary.absent_subjects],
    ['Subjects still unmarked', summary.pending_subjects],
  ]
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label}>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {summary.warnings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">
          {summary.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
