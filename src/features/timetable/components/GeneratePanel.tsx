import { useState } from 'react'
import { AlertTriangleIcon, CheckCircle2Icon, CircleXIcon, CopyIcon, EyeIcon, Loader2Icon, SendIcon, SparklesIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { AcademicYear } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { isRunning, useReadiness, useTimetableMutations, useTimetables, type Readiness, type ReadinessFix, type Timetable, type TimetableStatus } from '../api'

const FIX_TAB: Record<ReadinessFix, string> = {
  bell_schedules: 'day',
  requirements: 'lessons',
  teachers: 'teachers',
  classes: 'day',
  calendar: 'day',
}

const STATUS: Record<TimetableStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  queued: { label: 'Queued', variant: 'outline' },
  generating: { label: 'Generating', variant: 'outline' },
  draft: { label: 'Draft', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
  published: { label: 'Published', variant: 'default' },
  archived: { label: 'Archived', variant: 'outline' },
}

export function StatusBadge({ status }: { status: TimetableStatus }) {
  return (
    <Badge variant={STATUS[status].variant}>
      {isRunning(status) && <Loader2Icon className="animate-spin" />}
      {STATUS[status].label}
    </Badge>
  )
}

export function GeneratePanel({ year, onOpen, onFix }: { year: AcademicYear; onOpen: (timetable: Timetable) => void; onFix: (tab: string) => void }) {
  const readiness = useReadiness(year.id)
  const timetables = useTimetables(year.id)
  const running = timetables.data?.some((t) => isRunning(t.status)) ?? false

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready to generate?</CardTitle>
          <CardDescription>Everything a timetable needs, checked before it runs.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={readiness}>{(data) => <ReadinessList readiness={data} onFix={onFix} />}</QueryState>
        </CardContent>
        <CardFooter>
          <GenerateDialog year={year} disabled={!readiness.data?.ready || running} drafts={(timetables.data ?? []).filter((t) => t.status === 'draft' || t.status === 'published')} />
        </CardFooter>
      </Card>
      <QueryState query={timetables}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No timetables yet" description="When the checklist is clear, generate one. It takes a few seconds and you can review it before anyone sees it." />
          ) : (
            <div className="grid content-start gap-3">
              {rows.map((timetable) => (
                <TimetableCard key={timetable.id} timetable={timetable} onOpen={() => onOpen(timetable)} />
              ))}
            </div>
          )
        }
      </QueryState>
    </div>
  )
}

function ReadinessList({ readiness, onFix }: { readiness: Readiness; onFix: (tab: string) => void }) {
  const errors = readiness.issues.filter((i) => i.level === 'error')
  const warnings = readiness.issues.filter((i) => i.level === 'warning')

  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">
        {readiness.summary.classes} classes · {readiness.summary.lessons} lessons a week · {readiness.summary.teachers} teachers
      </p>
      {errors.length === 0 && (
        <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4" /> Ready to generate.
        </p>
      )}
      {[...errors, ...warnings].map((issue, i) => (
        <div key={i} className="flex items-start gap-2">
          {issue.level === 'error' ? <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" /> : <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />}
          <div className="min-w-0">
            <p>{issue.message}</p>
            {issue.level === 'error' && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onFix(FIX_TAB[issue.fix])}>
                Fix this
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function GenerateDialog({ year, disabled, drafts }: { year: AcademicYear; disabled: boolean; drafts: Timetable[] }) {
  const { generate } = useTimetableMutations()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [termId, setTermId] = useState<string>('year')
  const [keepFrom, setKeepFrom] = useState<string>('none')

  async function submit() {
    try {
      await generate.mutateAsync({
        academic_year_id: year.id,
        term_id: termId === 'year' ? null : Number(termId),
        name: name.trim() || null,
        keep_locked_from: keepFrom === 'none' ? null : Number(keepFrom),
      })
      toast.success('Generating. This usually takes a few seconds.')
      setOpen(false)
      setName('')
    } catch (error) {
      const readiness = error instanceof ApiError ? (error.body as { readiness?: Readiness } | null)?.readiness : undefined
      toast.error(readiness ? readiness.issues.find((i) => i.level === 'error')?.message ?? errorMessage(error) : errorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="w-full">
          <SparklesIcon /> Generate timetable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a timetable for {year.name}</DialogTitle>
          <DialogDescription>It is created as a draft. Staff see it only after you publish it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tt-name">Name</Label>
            <Input id="tt-name" placeholder={`Timetable ${year.name}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label>For</Label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">The whole year</SelectItem>
                {year.terms.map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {term.name} only
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {drafts.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Keep locked lessons from</Label>
              <Select value={keepFrom} onValueChange={setKeepFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nothing: start fresh</SelectItem>
                  {drafts.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Lock lessons in a draft to keep them exactly where they are when you generate again.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TimetableCard({ timetable, onOpen }: { timetable: Timetable; onOpen: () => void }) {
  const { publish, duplicate, remove } = useTimetableMutations()
  const unplaced = timetable.diagnostics?.unplaced ?? []
  const issues = timetable.diagnostics?.issues ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="truncate">{timetable.name}</span>
            <StatusBadge status={timetable.status} />
          </CardTitle>
          <CardDescription>
            {timetable.term ? timetable.term.name : 'Whole year'}
            {timetable.generated_at && ` · generated ${formatDateTime(timetable.generated_at)}`}
            {timetable.published_at && ` · published ${formatDateTime(timetable.published_at)}`}
            {timetable.generated_by && ` · by ${timetable.generated_by.name}`}
          </CardDescription>
        </div>
      </CardHeader>
      {(timetable.stats || timetable.diagnostics) && (
        <CardContent className="grid gap-2 text-sm">
          {timetable.stats && timetable.lessons_count > 0 && (
            <p className="text-muted-foreground">
              {timetable.lessons_count} lessons{timetable.stats.classes ? ` across ${timetable.stats.classes} classes` : ''}
              {timetable.stats.teachers ? ` and ${timetable.stats.teachers} teachers` : ''} · solved in {(timetable.stats.milliseconds / 1000).toFixed(1)} s
            </p>
          )}
          {timetable.status === 'failed' && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="font-medium text-destructive">{timetable.diagnostics?.message ?? 'Generation failed.'}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {unplaced.slice(0, 8).map((row, i) => (
                  <li key={i}>{row.message}</li>
                ))}
                {issues
                  .filter((i) => i.level === 'error')
                  .slice(0, 8)
                  .map((issue, i) => (
                    <li key={`i${i}`}>{issue.message}</li>
                  ))}
              </ul>
              {unplaced.length > 8 && <p className="mt-1 text-muted-foreground">…and {unplaced.length - 8} more.</p>}
            </div>
          )}
        </CardContent>
      )}
      {!isRunning(timetable.status) && timetable.status !== 'failed' && (
        <CardFooter className="flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <EyeIcon /> View
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={duplicate.isPending}
            onClick={() => duplicate.mutate(timetable.id, { onSuccess: () => toast.success('Copied as a new draft.') })}
          >
            <CopyIcon /> Duplicate
          </Button>
          {timetable.status === 'draft' && (
            <ConfirmDialog
              trigger={
                <Button size="sm">
                  <SendIcon /> Publish
                </Button>
              }
              title={`Publish “${timetable.name}”?`}
              description="Teachers will see it in the staff portal straight away. The timetable published now is archived."
              confirmLabel="Publish"
              onConfirm={async () => {
                await publish.mutateAsync(timetable.id)
                toast.success('Published. Teachers can see it now.')
              }}
            />
          )}
        </CardFooter>
      )}
      {(timetable.status === 'draft' || timetable.status === 'failed' || timetable.status === 'archived') && (
        <CardFooter className="justify-end pt-0">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2Icon /> Delete
              </Button>
            }
            title={`Delete “${timetable.name}”?`}
            description="Its lessons are deleted with it. This cannot be undone."
            confirmLabel="Delete"
            destructive
            onConfirm={async () => {
              await remove.mutateAsync(timetable.id)
              toast.success('Deleted.')
            }}
          />
        </CardFooter>
      )}
    </Card>
  )
}
