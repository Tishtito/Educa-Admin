import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, ChevronLeftIcon, GraduationCapIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAcademicYears, useClasses } from '@/features/reference/api'
import { errorMessage } from '@/lib/api/errors'
import type { AcademicYear, PromotionPreview, PromotionResult, SchoolClass } from '@/lib/api/types'
import { usePromote, usePromotionPreview, useStudents, type PromotionInput } from '../api'

type Mapping = PromotionInput['mappings'][number]
const GRADUATE = 'graduate'
const SKIP = 'skip'

export function PromotionPage() {
  const years = useAcademicYears()
  const sorted = [...(years.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const current = sorted.find((y) => y.is_current)
  const [fromId, setFromId] = useState<number | null>(null)
  const [toId, setToId] = useState<number | null>(null)
  const from = fromId ?? current?.id ?? null
  const to = toId ?? (current ? sorted[sorted.indexOf(current) + 1]?.id : undefined) ?? null
  const preview = usePromotionPreview(from, to)

  return (
    <>
      <Link to="/students" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Pupils
      </Link>
      <PageHeader
        title="End of year"
        description="Move every class up a grade into the new academic year, and graduate the top class. Each pupil keeps last year’s class in their history."
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3">
          <YearSelect label="From" years={sorted} value={from} onChange={setFromId} />
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <YearSelect label="Into" years={sorted} value={to} onChange={setToId} />
          {sorted.length < 2 && (
            <span className="text-sm text-muted-foreground">
              Create next year first under <Link className="underline" to="/setup/calendar">Calendar</Link>.
            </span>
          )}
        </CardContent>
      </Card>
      {from !== null && to !== null && from !== to ? (
        <QueryState query={preview}>{(data) => <PromotionForm key={`${from}:${to}`} preview={data} />}</QueryState>
      ) : (
        <EmptyState title="Choose two different years" />
      )}
    </>
  )
}

function YearSelect({ label, years, value, onChange }: { label: string; years: AcademicYear[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-40" aria-label={label}>
        <span className="text-muted-foreground">{label}</span>
        <SelectValue placeholder="year" />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y.id} value={String(y.id)}>
            {y.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PromotionForm({ preview }: { preview: PromotionPreview }) {
  const classes = useClasses({ active: true })
  const promote = usePromote()
  const [mappings, setMappings] = useState<Mapping[]>(() =>
    preview.classes.map((c) => ({
      class_id: c.class_id,
      action: c.suggestion.action,
      target_class_id: c.suggestion.target_class_id,
    })),
  )
  const [excluded, setExcluded] = useState<number[]>([])
  const [result, setResult] = useState<PromotionResult | null>(null)
  const incomplete = mappings.filter((m) => m.action === 'promote' && !m.target_class_id)

  const setMapping = (classId: number, value: string) =>
    setMappings((all) =>
      all.map((m) =>
        m.class_id !== classId
          ? m
          : value === GRADUATE || value === SKIP
            ? { ...m, action: value, target_class_id: null }
            : { ...m, action: 'promote', target_class_id: Number(value) },
      ),
    )

  async function run(dryRun: boolean) {
    try {
      const outcome = await promote.mutateAsync({
        from_year_id: preview.from_year.id,
        to_year_id: preview.to_year.id,
        dry_run: dryRun,
        mappings,
        excluded_student_ids: excluded,
      })
      setResult(outcome)
      if (!dryRun) toast.success(`Done: ${outcome.promoted} moved up, ${outcome.graduated} graduated.`)
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  if (preview.classes.length === 0) {
    return <EmptyState title={`No pupils are in a class in ${preview.from_year.name}`} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {preview.from_year.name} → {preview.to_year.name}
        </CardTitle>
        <CardDescription>
          Check where each class goes. Tick pupils who are repeating the year or leaving — they are left where they are. Pupils already placed
          in {preview.to_year.name} are never moved again.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {preview.classes.map((c) => {
          const mapping = mappings.find((m) => m.class_id === c.class_id)!
          return (
            <ClassMapping
              key={c.class_id}
              row={c}
              mapping={mapping}
              classes={classes.data ?? []}
              fromYearId={preview.from_year.id}
              excluded={excluded}
              onExclude={setExcluded}
              onChange={(v) => {
                setMapping(c.class_id, v)
                setResult(null)
              }}
            />
          )
        })}

        {result && (
          <Alert>
            <AlertDescription>
              {result.dry_run ? 'If you go ahead: ' : 'Finished: '}
              <strong>{result.promoted}</strong> move up, <strong>{result.graduated}</strong> graduate, {result.excluded} stay back,{' '}
              {result.skipped} in skipped classes, {result.already_enrolled} already placed in {preview.to_year.name}.
            </AlertDescription>
          </Alert>
        )}
        {incomplete.length > 0 && <p className="text-sm text-destructive">Choose a class to move {incomplete.length} class{incomplete.length === 1 ? '' : 'es'} into.</p>}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" disabled={incomplete.length > 0 || promote.isPending} onClick={() => void run(true).catch(() => undefined)}>
          {promote.isPending && <Loader2Icon className="animate-spin" />}
          Preview counts
        </Button>
        <ConfirmDialog
          trigger={
            <Button disabled={incomplete.length > 0 || promote.isPending}>
              <GraduationCapIcon /> Move pupils up
            </Button>
          }
          title={`Move pupils into ${preview.to_year.name}?`}
          description={
            <>
              <p>Every ticked class moves as shown. Graduating pupils are marked graduated.</p>
              <p>This is not undone automatically; individual pupils can be moved afterwards.</p>
            </>
          }
          confirmLabel="Move pupils up"
          onConfirm={() => run(false)}
        />
      </CardFooter>
    </Card>
  )
}

function ClassMapping({
  row,
  mapping,
  classes,
  fromYearId,
  excluded,
  onExclude,
  onChange,
}: {
  row: PromotionPreview['classes'][number]
  mapping: Mapping
  classes: SchoolClass[]
  fromYearId: number
  excluded: number[]
  onExclude: (ids: number[]) => void
  onChange: (value: string) => void
}) {
  const [showPupils, setShowPupils] = useState(false)
  const value = mapping.action === 'promote' ? (mapping.target_class_id ? String(mapping.target_class_id) : undefined) : mapping.action

  return (
    <div className="rounded-lg border p-3">
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_16rem]">
        <div>
          <div className="font-medium">{row.class_name}</div>
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowPupils((s) => !s)}>
            {row.pupils} pupils · {showPupils ? 'hide' : 'choose who stays back'}
          </button>
        </div>
        <ArrowRightIcon className="hidden size-4 text-muted-foreground sm:block" />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full" aria-label={`Where ${row.class_name} goes`}>
            <SelectValue placeholder="Choose a class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GRADUATE}>Graduate (leave the school)</SelectItem>
            <SelectItem value={SKIP}>Leave this class as it is</SelectItem>
            {classes
              .filter((c) => c.id !== row.class_id)
              .map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {showPupils && <PupilExclusions classId={row.class_id} yearId={fromYearId} excluded={excluded} onChange={onExclude} />}
    </div>
  )
}

function PupilExclusions({ classId, yearId, excluded, onChange }: { classId: number; yearId: number; excluded: number[]; onChange: (ids: number[]) => void }) {
  const pupils = useStudents({ class_id: classId, academic_year_id: yearId, status: 'active', per_page: 200 })

  return (
    <div className="mt-3 grid gap-1 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
      {pupils.isPending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
      {pupils.data?.data.map((p) => (
        <label key={p.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={excluded.includes(p.id)}
            onCheckedChange={(checked) => onChange(checked ? [...excluded, p.id] : excluded.filter((id) => id !== p.id))}
          />
          <span className="truncate">{p.full_name}</span>
        </label>
      ))}
    </div>
  )
}
