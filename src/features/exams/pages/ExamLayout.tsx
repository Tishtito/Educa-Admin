import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ErrorPanel } from '@/components/data/QueryState'
import { Skeleton } from '@/components/ui/skeleton'
import { examKeys, useExam } from '../api'
import { ExamStatusBadge } from '../components/ExamStatusBadge'
import { ResultsFreshness } from '../components/ResultsFreshness'
import type { ExamOutletContext } from '../useExamContext'

const tabs = [
  { to: '', label: 'Overview', end: true },
  { to: 'marking', label: 'Marking', end: false },
  { to: 'marklist', label: 'Mark list', end: false },
  { to: 'analysis', label: 'Analysis', end: false },
  { to: 'report-cards', label: 'Report cards', end: false },
  { to: 'setup', label: 'Set-up', end: false },
]

export function ExamLayout() {
  const examId = Number(useParams().examId)
  const exam = useExam(examId)
  const queryClient = useQueryClient()

  // When the background recompute finishes, everything derived from the old
  // results (mark lists, cards, sheet scores) is out of date.
  const computedAt = exam.data?.results_computed_at
  const previous = useRef(computedAt)
  useEffect(() => {
    if (previous.current !== undefined && previous.current !== computedAt) {
      void queryClient.invalidateQueries({ queryKey: examKeys.results(examId) })
    }
    previous.current = computedAt
  }, [computedAt, examId, queryClient])

  if (exam.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (exam.isError) return <ErrorPanel error={exam.error} onRetry={() => void exam.refetch()} />

  const data = exam.data

  return (
    <>
      <div className="mb-4 print:hidden">
        <Link to="/exams" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-3.5" /> Exams
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{data.name}</h1>
          <ExamStatusBadge status={data.status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {[data.exam_type_label, data.academic_year?.name, data.term?.name, data.level?.name ?? 'All levels']
              .filter(Boolean)
              .join(' · ')}
          </span>
          <ResultsFreshness exam={data} />
        </div>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b print:hidden" aria-label="Exam sections">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap',
                isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ exam: data } satisfies ExamOutletContext} />
    </>
  )
}
