import { useSearchParams } from 'react-router'
import { BarChart3Icon, DownloadIcon, PrinterIcon } from 'lucide-react'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGrades } from '@/features/reference/api'
import { saveBlob } from '@/lib/download'
import { formatDateTime, formatScore } from '@/lib/format'
import type { ExamStatistics, StreamList } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { useExamStatistics, useStreamList } from '../analysisApi'
import { useExamContext } from '../useExamContext'

export function ExamAnalysisTab() {
  const { exam } = useExamContext()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'ranking' ? 'ranking' : 'means'
  const set = (key: string, value: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set(key, value)
      return next
    }, { replace: true })

  if (exam.status === 'draft' || exam.status === 'open') {
    return <EmptyState icon={<BarChart3Icon />} title="No results yet" description="Analysis is available once results have been computed." />
  }

  return (
    <>
      <Tabs value={view} onValueChange={(v) => set('view', v)} className="mb-4 print:hidden">
        <TabsList>
          <TabsTrigger value="means">Class means</TabsTrigger>
          <TabsTrigger value="ranking">Grade ranking</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'means' ? <MeansView examId={exam.id} /> : <RankingView />}
    </>
  )
}

// ------------------------------------------------------------ class means

function MeansView({ examId }: { examId: number }) {
  const statistics = useExamStatistics(examId)

  return (
    <QueryState query={statistics}>
      {(data) =>
        data.scopes.length === 0 ? (
          <EmptyState title="No statistics" description="Statistics are produced when results are computed." />
        ) : (
          <MeansTables data={data} />
        )
      }
    </QueryState>
  )
}

function MeansTables({ data }: { data: ExamStatistics }) {
  const classes = data.scopes.filter((s) => s.scope === 'class')
  const wider = data.scopes.filter((s) => s.scope !== 'class')
  const subjects = [...new Map(data.scopes.flatMap((s) => s.subjects).map((s) => [s.level_subject_id, s])).values()].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  )
  const best = Math.max(...classes.map((c) => c.mean ?? 0))

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {wider.map((scope) => (
          <Card key={`${scope.scope}:${scope.scope_id}`} className="gap-1">
            <CardHeader>
              <CardDescription>{scope.name}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatScore(scope.mean)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {scope.students_counted} pupils · range {formatScore(scope.min)}–{formatScore(scope.max)}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mean standard score by class</CardTitle>
          <CardDescription>
            The average of pupils’ mean marks, best first. {data.computed_at && `Computed ${formatDateTime(data.computed_at)}.`}
            {!data.results_up_to_date && ' Marks have changed since; figures are being updated.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {classes.map((c, i) => (
            <div key={c.scope_id} className="grid grid-cols-[1.5rem_9rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className="text-right text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="truncate font-medium">{c.name}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, ((c.mean ?? 0) / Math.max(best, 1)) * 100)}%` }} />
              </div>
              <span className="text-right font-medium tabular-nums">{formatScore(c.mean)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {subjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject means</CardTitle>
            <CardDescription>Each class’s average score per subject. The highest in each subject is highlighted.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="py-2 pr-3 font-medium">Class</th>
                  {subjects.map((s) => (
                    <th key={s.level_subject_id} className="px-2 py-2 text-right font-medium" title={s.name ?? undefined}>
                      {s.code || s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...wider, ...classes].map((scope) => (
                  <tr key={`${scope.scope}:${scope.scope_id}`} className={cn('border-b last:border-0', scope.scope !== 'class' && 'bg-muted/40 font-medium')}>
                    <td className="py-1.5 pr-3">{scope.name}</td>
                    {subjects.map((subject) => {
                      const value = scope.subjects.find((s) => s.level_subject_id === subject.level_subject_id)?.mean ?? null
                      const top =
                        scope.scope === 'class' &&
                        value !== null &&
                        value === Math.max(...classes.map((c) => c.subjects.find((s) => s.level_subject_id === subject.level_subject_id)?.mean ?? -1))
                      return (
                        <td key={subject.level_subject_id} className={cn('px-2 py-1.5 text-right tabular-nums', top && 'font-semibold text-emerald-700 dark:text-emerald-400')}>
                          {formatScore(value)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------- grade ranking

function RankingView() {
  const { exam } = useExamContext()
  const grades = useGrades()
  const [params, setParams] = useSearchParams()
  const examGradeIds = [...new Set((exam.classes ?? []).map((c) => c.grade_id))]
  const options = (grades.data ?? []).filter((g) => examGradeIds.includes(g.id))
  const gradeId = Number(params.get('grade')) || options[0]?.id || null
  const list = useStreamList(exam.id, gradeId)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Select
          value={gradeId ? String(gradeId) : undefined}
          onValueChange={(v) =>
            setParams((p) => {
              const next = new URLSearchParams(p)
              next.set('grade', v)
              return next
            }, { replace: true })
          }
        >
          <SelectTrigger className="w-44" aria-label="Grade">
            <SelectValue placeholder="Choose a grade" />
          </SelectTrigger>
          <SelectContent>
            {options.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {list.data && (
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <PrinterIcon /> Print
            </Button>
            <Button variant="outline" onClick={() => void saveBlob(new Blob(['\uFEFF' + rankingCsv(list.data)], { type: 'text/csv;charset=utf-8' }), `${exam.name} ${list.data.grade.name} ranking.csv`)}>
              <DownloadIcon /> CSV
            </Button>
          </>
        )}
      </div>
      {gradeId === null ? (
        <EmptyState title="Choose a grade" />
      ) : (
        <QueryState query={list}>
          {(data) =>
            data.students.length === 0 ? (
              <EmptyState title="No results for this grade" />
            ) : (
              <Card className="overflow-x-auto p-0 print:border-0 print:shadow-none">
                <h2 className="hidden px-3 pt-3 text-lg font-semibold print:block">
                  {exam.name} — {data.grade.name} ranking
                </h2>
                <table className="w-full min-w-max text-sm print:text-[10px]">
                  <thead className="border-b bg-muted/50 text-left">
                    <tr>
                      <th className="px-2 py-2 text-right font-medium">Pos</th>
                      <th className="px-3 py-2 font-medium">Pupil</th>
                      <th className="px-2 py-2 font-medium">Class</th>
                      {data.subjects.map((s) => (
                        <th key={s.level_subject_id} className="px-2 py-2 text-right font-medium" title={s.name}>
                          {s.code || s.name}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium">Total</th>
                      <th className="px-2 py-2 text-right font-medium">Mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.student_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-2 py-1.5 text-right tabular-nums">{s.grade_position ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.admission_no}</div>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {s.class_name} <span className="text-xs text-muted-foreground">({s.stream_position ?? '—'})</span>
                        </td>
                        {s.scores.map((score) => (
                          <td key={score.level_subject_id} className="px-2 py-1.5 text-right tabular-nums">
                            {score.is_absent ? <span className="text-xs text-muted-foreground">ABS</span> : formatScore(score.score)}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatScore(s.total_marks)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatScore(s.mean_marks)} <span className="text-xs text-muted-foreground">{s.mean_band}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-muted-foreground">The number after the class is the pupil’s position within that class.</p>
              </Card>
            )
          }
        </QueryState>
      )}
    </>
  )
}

function rankingCsv(list: StreamList): string {
  const cell = (v: string | number | null) => {
    if (v === null) return ''
    const text = String(v)
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const header = ['Position', 'Admission no', 'Name', 'Class', 'Class position', ...list.subjects.map((s) => s.code || s.name), 'Total', 'Mean', 'Level']
  const rows = list.students.map((s) => [
    s.grade_position,
    s.admission_no,
    s.name,
    s.class_name,
    s.stream_position,
    ...s.scores.map((x) => (x.is_absent ? 'ABS' : x.score)),
    s.total_marks,
    s.mean_marks,
    s.mean_band,
  ])
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}
