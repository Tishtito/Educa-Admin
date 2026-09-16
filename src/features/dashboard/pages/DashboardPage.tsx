import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon, ArrowRightIcon, CalendarDaysIcon, CheckCircle2Icon, ClipboardListIcon, Loader2Icon } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ExamStatusBadge } from '@/features/exams/components/ExamStatusBadge'
import { api } from '@/lib/api/client'
import type { DashboardData } from '@/lib/api/types'
import { formatDate } from '@/lib/format'

export function DashboardPage() {
  const { user, school } = useAuth()
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => api.get<DashboardData>('/dashboard', { signal }),
    refetchInterval: 60_000,
  })

  return (
    <>
      <PageHeader eyebrow={school?.name} title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`} description="Where the year stands and what needs doing." />
      <QueryState
        query={dashboard}
        loading={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        {(data) => <Dashboard data={data} />}
      </QueryState>
    </>
  )
}

function Dashboard({ data }: { data: DashboardData }) {
  const attention = [
    { count: data.attention.pupils_without_class, text: 'active pupils are not in a class this year', to: '/students?class=unplaced' },
    { count: data.attention.classes_without_teacher, text: 'classes have no class teacher', to: '/assignments' },
    { count: data.attention.subjects_without_examiner, text: 'class subjects have no examiner', to: '/assignments?view=examiners' },
    { count: data.attention.staff_awaiting_first_sign_in, text: 'staff have not signed in yet', to: '/staff' },
    { count: data.attention.failed_report_batches, text: 'report card PDFs failed this week', to: '/exams' },
  ].filter((item) => item.count > 0)

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Card className="col-span-2">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CalendarDaysIcon className="size-4" /> Academic calendar
            </CardDescription>
            <CardTitle className="text-lg">
              {data.academic_year ? `${data.academic_year.name}${data.term ? ` · ${data.term.name}` : ''}` : 'No current academic year'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.term ? (
              `${formatDate(data.term.starts_on)} – ${formatDate(data.term.ends_on)}`
            ) : (
              <Link to="/setup/calendar" className="underline">
                Set the current year and term
              </Link>
            )}
          </CardContent>
        </Card>
        <Stat label="Pupils this year" value={data.counts.pupils} to="/students" />
        <Stat label="Classes" value={data.counts.classes} to="/setup/classes" />
        <Stat label="Active staff" value={data.counts.staff} to="/staff" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Exams in progress</CardTitle>
              <CardDescription>Open, in marking, or locked and waiting to be published.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/exams">
                All exams <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.exams.length === 0 ? (
              <EmptyState icon={<ClipboardListIcon />} title="No exams in progress" description="Create an exam and open it for marking." />
            ) : (
              <ul className="divide-y">
                {data.exams.map((exam) => {
                  const percent = exam.marks_expected ? Math.min(100, Math.round((exam.marks_entered / exam.marks_expected) * 100)) : 0
                  return (
                    <li key={exam.id}>
                      <Link to={`/exams/${exam.id}${exam.status === 'marking' ? '/marking' : ''}`} className="grid gap-2 py-3 hover:bg-muted/40 sm:px-2">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">{exam.name}</span>
                          {!exam.results_up_to_date && <Loader2Icon className="size-3.5 animate-spin text-amber-600" aria-label="Recalculating" />}
                          <ExamStatusBadge status={exam.status} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="shrink-0">{[exam.term, exam.level].filter(Boolean).join(' · ') || '—'}</span>
                          {exam.status !== 'open' && (
                            <>
                              <Progress value={percent} className="h-1.5" />
                              <span className="shrink-0 tabular-nums">{percent}% marked</span>
                            </>
                          )}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2Icon className="size-4 text-emerald-600" /> Nothing outstanding.
              </p>
            ) : (
              <ul className="grid gap-2">
                {attention.map((item) => (
                  <li key={item.text}>
                    <Link to={item.to} className="flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted">
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <span>
                        <strong className="tabular-nums">{item.count}</strong> {item.text}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}
