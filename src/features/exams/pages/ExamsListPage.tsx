import { useState } from 'react'
import { Link } from 'react-router'
import { ClipboardListIcon, PlusIcon } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorPanel } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAcademicYears } from '@/features/reference/api'
import { formatDate } from '@/lib/format'
import type { ExamStatus } from '@/lib/api/types'
import { useExams, type ExamFilters } from '../api'
import { ExamStatusBadge } from '../components/ExamStatusBadge'
import { examStatusLabel, examStatusOrder } from '../status'

const ALL = 'all'

export function ExamsListPage() {
  const years = useAcademicYears()
  const [filters, setFilters] = useState<ExamFilters>({ page: 1, per_page: 25 })
  const exams = useExams(filters)
  const selectedYear = years.data?.find((year) => year.id === filters.academic_year_id)

  const update = (patch: Partial<ExamFilters>) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  return (
    <>
      <PageHeader
        title="Exams"
        description="Every exam in your school, from set-up to published report cards."
        actions={
          <Button asChild>
            <Link to="/exams/new">
              <PlusIcon /> New exam
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          value={filters.academic_year_id ? String(filters.academic_year_id) : ALL}
          onValueChange={(value) => update({ academic_year_id: value === ALL ? undefined : Number(value), term_id: undefined })}
        >
          <SelectTrigger className="w-36" aria-label="Academic year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All years</SelectItem>
            {years.data?.map((year) => (
              <SelectItem key={year.id} value={String(year.id)}>
                {year.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.term_id ? String(filters.term_id) : ALL}
          onValueChange={(value) => update({ term_id: value === ALL ? undefined : Number(value) })}
          disabled={!selectedYear}
        >
          <SelectTrigger className="w-36" aria-label="Term">
            <SelectValue placeholder="Term" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All terms</SelectItem>
            {selectedYear?.terms.map((term) => (
              <SelectItem key={term.id} value={String(term.id)}>
                {term.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status ?? ALL}
          onValueChange={(value) => update({ status: value === ALL ? undefined : (value as ExamStatus) })}
        >
          <SelectTrigger className="w-40" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {examStatusOrder.map((status) => (
              <SelectItem key={status} value={status}>
                {examStatusLabel[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!filters.status && (
          <div className="flex h-8 items-center gap-2">
            <Switch
              id="include_archived"
              checked={!!filters.include_archived}
              onCheckedChange={(checked) => update({ include_archived: checked || undefined })}
            />
            <Label htmlFor="include_archived" className="font-normal">
              Show archived
            </Label>
          </div>
        )}
      </div>

      {exams.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : exams.isError ? (
        <ErrorPanel error={exams.error} onRetry={() => void exams.refetch()} />
      ) : exams.data.data.length === 0 ? (
        <EmptyState icon={<ClipboardListIcon />} title="No exams found" description="Try a different year or status." />
      ) : (
        <>
          {/* Phones: a list of cards. */}
          <ul className="grid gap-2 md:hidden">
            {exams.data.data.map((exam) => (
              <li key={exam.id}>
                <Link to={`/exams/${exam.id}`}>
                  <Card className="gap-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{exam.name}</span>
                      <ExamStatusBadge status={exam.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[exam.exam_type_label, exam.academic_year?.name, exam.term?.name, exam.level?.name]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          {/* Larger screens: a table. */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Year / term</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.data.data.map((exam) => (
                  <TableRow key={exam.id} className="relative">
                    <TableCell className="font-medium">
                      <Link to={`/exams/${exam.id}`} className="after:absolute after:inset-0">
                        {exam.name}
                      </Link>
                      {!exam.results_up_to_date && exam.status !== 'draft' && exam.status !== 'open' && (
                        <div className="text-xs font-normal text-amber-700 dark:text-amber-400">Results updating…</div>
                      )}
                    </TableCell>
                    <TableCell>{exam.exam_type_label}</TableCell>
                    <TableCell>{[exam.academic_year?.name, exam.term?.name].filter(Boolean).join(' · ')}</TableCell>
                    <TableCell>{exam.level?.name ?? 'All levels'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {exam.starts_on ? `${formatDate(exam.starts_on)} – ${formatDate(exam.ends_on)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <ExamStatusBadge status={exam.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {exams.data.meta.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Page {exams.data.meta.current_page} of {exams.data.meta.last_page} · {exams.data.meta.total} exams
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exams.data.meta.current_page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exams.data.meta.current_page >= exams.data.meta.last_page}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
