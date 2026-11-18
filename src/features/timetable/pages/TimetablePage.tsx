import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/auth/useAuth'
import { useAcademicYears } from '@/features/reference/api'
import { useTimetables } from '../api'
import { BellSchedulesPanel } from '../components/BellSchedulesPanel'
import { GeneratePanel } from '../components/GeneratePanel'
import { RequirementsPanel } from '../components/RequirementsPanel'
import { TeachersPanel } from '../components/TeachersPanel'
import { TimetableViewer, type ViewerSelection } from '../components/TimetableViewer'

type Tab = 'generate' | 'view' | 'day' | 'lessons' | 'teachers'

/**
 * Timetables, in the order a school sets them up: the school day, lessons per
 * week, who teaches what, then generate, review and publish. Everything lives
 * in the URL so a link (and the readiness check's "Fix this") lands on the
 * right tab.
 */
export function TimetablePage() {
  const { can } = useAuth()
  const years = useAcademicYears()
  const [params, setParams] = useSearchParams()
  const current = years.data?.find((y) => y.is_current) ?? years.data?.[0]
  const yearId = Number(params.get('year')) || current?.id || null
  const year = years.data?.find((y) => y.id === yearId) ?? null
  const timetables = useTimetables(yearId)

  const manage = can('manage_timetables')
  const tabs: { value: Tab; label: string; show: boolean }[] = [
    { value: 'generate', label: 'Generate', show: manage },
    { value: 'view', label: 'View', show: can('view_timetables') },
    { value: 'day', label: 'School day', show: manage },
    { value: 'lessons', label: 'Lessons per week', show: manage },
    { value: 'teachers', label: 'Subject teachers', show: can('manage_assignments') && can('view_staff') },
  ]
  const visible = tabs.filter((t) => t.show)
  const tab = (visible.find((t) => t.value === params.get('tab'))?.value ?? visible[0]?.value ?? 'view') as Tab

  const set = (values: Record<string, string | number | null>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        for (const [key, value] of Object.entries(values)) {
          if (value === null) next.delete(key)
          else next.set(key, String(value))
        }
        return next
      },
      { replace: true },
    )

  const selection: ViewerSelection = {
    timetableId: Number(params.get('timetable')) || null,
    mode: params.get('by') === 'teacher' ? 'teacher' : 'class',
    subjectId: Number(params.get('of')) || null,
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Timetable"
          description="Set the school day and lessons per week, choose who teaches what, then generate a timetable, check it and publish it to staff."
          actions={
            <Select value={yearId ? String(yearId) : undefined} onValueChange={(v) => set({ year: v, timetable: null, of: null })}>
              <SelectTrigger className="w-36" aria-label="Academic year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.data?.map((y) => (
                  <SelectItem key={y.id} value={String(y.id)}>
                    {y.name}
                    {y.is_current ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <Tabs value={tab} onValueChange={(v) => set({ tab: v })} className="mb-4">
          <TabsList className="max-w-full overflow-x-auto">
            {visible.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {year === null ? (
        <EmptyState title="No academic year" description="Create an academic year under School set-up → Calendar first." />
      ) : tab === 'generate' ? (
        <GeneratePanel year={year} onOpen={(t) => set({ tab: 'view', timetable: t.id, of: null })} onFix={(next) => set({ tab: next })} />
      ) : tab === 'view' ? (
        <QueryState query={timetables}>
          {(rows) => (
            <TimetableViewer
              timetables={rows}
              selection={selection}
              onChange={(next) =>
                set({
                  ...(next.timetableId !== undefined && { timetable: next.timetableId }),
                  ...(next.mode !== undefined && { by: next.mode }),
                  ...(next.subjectId !== undefined && { of: next.subjectId }),
                })
              }
            />
          )}
        </QueryState>
      ) : tab === 'day' ? (
        <BellSchedulesPanel />
      ) : tab === 'lessons' ? (
        <RequirementsPanel year={year} years={years.data ?? []} gradeId={Number(params.get('grade')) || null} onGrade={(id) => set({ grade: id })} />
      ) : (
        <TeachersPanel year={year} years={years.data ?? []} classId={Number(params.get('class')) || null} onClass={(id) => set({ class: id })} />
      )}
    </>
  )
}
