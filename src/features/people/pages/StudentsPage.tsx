import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowUpRightIcon, FileUpIcon, SearchIcon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, ErrorPanel } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAcademicYears, useClasses } from '@/features/reference/api'
import type { StudentStatus } from '@/lib/api/types'
import { useStudents, type StudentFilters } from '../api'
import { StudentDialog } from '../components/StudentDialog'
import { studentStatusLabel } from '../labels'

const ALL = 'all'
const UNPLACED = 'unplaced'

export function StudentsPage() {
  const navigate = useNavigate()
  const years = useAcademicYears()
  const classes = useClasses()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [adding, setAdding] = useState(false)

  const filters: StudentFilters = {
    search: params.get('q') || undefined,
    status: (params.get('status') as StudentStatus) || undefined,
    class_id: Number(params.get('class')) || undefined,
    academic_year_id: Number(params.get('year')) || undefined,
    unenrolled: params.get('class') === UNPLACED || undefined,
    page: Number(params.get('page')) || 1,
    per_page: 50,
  }
  const students = useStudents(filters)

  const update = (patch: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === ALL) next.delete(key)
        else next.set(key, value)
      }
      if (!('page' in patch)) next.delete('page')
      return next
    }, { replace: true })

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((params.get('q') ?? '') !== search.trim()) update({ q: search.trim() })
    }, 350)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps -- runs on typing only

  const viewedYearId = filters.academic_year_id ?? years.data?.find((y) => y.is_current)?.id
  const yearName = years.data?.find((y) => y.id === viewedYearId)?.name

  return (
    <>
      <PageHeader
        title="Pupils"
        description="Every pupil in the school, with the class they are in for the year you are viewing."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/students/import">
                <FileUpIcon /> Import
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/students/promotion">
                <ArrowUpRightIcon /> End of year
              </Link>
            </Button>
            <Button onClick={() => setAdding(true)}>
              <UserPlusIcon /> Admit pupil
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Name or assessment no." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={params.get('year') ?? ALL} onValueChange={(v) => update({ year: v })}>
          <SelectTrigger className="w-36" aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Current year</SelectItem>
            {years.data?.map((y) => (
              <SelectItem key={y.id} value={String(y.id)}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get('class') ?? ALL} onValueChange={(v) => update({ class: v })}>
          <SelectTrigger className="w-44" aria-label="Class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            <SelectItem value={UNPLACED}>Not in a class</SelectItem>
            {classes.data?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get('status') ?? ALL} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="w-36" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {(Object.keys(studentStatusLabel) as StudentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {studentStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {students.data && <span className="text-sm text-muted-foreground">{students.data.meta.total} pupils</span>}
      </div>

      {students.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : students.isError ? (
        <ErrorPanel error={students.error} onRetry={() => void students.refetch()} />
      ) : students.data.data.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No pupils found"
          description={filters.search || filters.class_id || filters.status ? 'Try different filters.' : 'Admit pupils one at a time or import a spreadsheet.'}
        />
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pupil</TableHead>
                  <TableHead>Assessment no.</TableHead>
                  <TableHead>Class{yearName ? ` (${yearName})` : ''}</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.data.data.map((student) => (
                  <TableRow key={student.id} className="cursor-pointer" onClick={() => navigate(`/students/${student.id}`)}>
                    <TableCell className="font-medium">
                      <Link to={`/students/${student.id}`} onClick={(e) => e.stopPropagation()}>
                        {student.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{student.assessment_no}</TableCell>
                    <TableCell>{student.enrolment?.class_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {student.guardian_name ?? '—'}
                      {student.guardian_phone && <div className="text-xs text-muted-foreground">{student.guardian_phone}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>{studentStatusLabel[student.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {students.data.meta.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {students.data.meta.current_page} of {students.data.meta.last_page}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={students.data.meta.current_page <= 1} onClick={() => update({ page: String((filters.page ?? 1) - 1) })}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={students.data.meta.current_page >= students.data.meta.last_page}
                  onClick={() => update({ page: String((filters.page ?? 1) + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {adding && (
        <StudentDialog
          open
          onOpenChange={setAdding}
          defaultClassId={filters.class_id}
          onSaved={(student) => navigate(`/students/${student.id}`)}
        />
      )}
    </>
  )
}
