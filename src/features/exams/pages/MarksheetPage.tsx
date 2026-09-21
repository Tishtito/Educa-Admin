import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeftIcon, Loader2Icon, RotateCcwIcon, SaveIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { Marksheet } from '@/lib/api/types'
import { formatScore } from '@/lib/format'
import { useMarksheet, useSaveMarksheet } from '../api'
import { MaxMarksPopover } from '../marksheet/MaxMarksPopover'
import {
  buildPayload,
  cellError,
  cellKey,
  dirtyKeys,
  draftFromSheet,
  progress,
  serverErrorsToCells,
  type Cell,
  type Draft,
} from '../marksheet/model'
import { useExamContext } from '../useExamContext'

export function MarksheetPage() {
  const { exam } = useExamContext()
  const params = useParams()
  const classId = Number(params.classId)
  const levelSubjectId = Number(params.levelSubjectId)
  const sheet = useMarksheet(exam.id, classId, levelSubjectId)

  // The editor works on a snapshot. New server data (after a save, or a
  // background recompute) replaces it only while there are no unsaved edits,
  // so a refetch can never wipe marks someone is typing.
  const [dirty, setDirty] = useState(false)
  const [snapshot, setSnapshot] = useState<{ sheet: Marksheet; version: number } | null>(null)
  if (sheet.data && sheet.dataUpdatedAt !== snapshot?.version && !dirty) {
    setSnapshot({ sheet: sheet.data, version: sheet.dataUpdatedAt })
  }
  const newerOnServer = !!snapshot && sheet.dataUpdatedAt !== snapshot.version

  return (
    <>
      <Link to=".." relative="path" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> All marksheets
      </Link>
      <QueryState query={sheet}>
        {() =>
          snapshot && (
            <MarksheetEditor
              key={snapshot.version}
              examId={exam.id}
              sheet={snapshot.sheet}
              newerOnServer={newerOnServer}
              onDirtyChange={setDirty}
            />
          )
        }
      </QueryState>
    </>
  )
}

function MarksheetEditor({
  examId,
  sheet,
  newerOnServer,
  onDirtyChange,
}: {
  examId: number
  sheet: Marksheet
  newerOnServer: boolean
  onDirtyChange: (dirty: boolean) => void
}) {
  const [original, setOriginal] = useState<Draft>(() => draftFromSheet(sheet))
  const [draft, setDraft] = useState<Draft>(original)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const save = useSaveMarksheet(examId, sheet.class.id, sheet.subject.level_subject_id)

  const editable = sheet.can_enter && sheet.exam.accepts_score_entry
  const changed = useMemo(() => dirtyKeys(original, draft), [original, draft])
  const isDirty = changed.length > 0
  const counts = progress(sheet, draft)
  const maxByPaper = new Map(sheet.papers.map((p) => [p.subject_paper_id, p.max_marks]))

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange])
  const guard = useUnsavedChangesGuard(isDirty, 'The marks you typed on this sheet have not been saved.')

  const students = sheet.students.filter((s) => {
    const q = search.trim().toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || (s.assessment_no ?? '').toLowerCase().includes(q)
  })

  function update(key: string, patch: Partial<Cell>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
    setServerErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function onSave() {
    const { marks, keys, errors } = buildPayload(sheet, original, draft)
    if (Object.keys(errors).length > 0) {
      toast.error(`Fix ${Object.keys(errors).length} highlighted mark(s) before saving.`)
      return
    }
    if (marks.length === 0) return

    try {
      const result = await save.mutateAsync(marks)
      // Saved cells are now the baseline; the page then adopts fresh server data.
      setOriginal((current) => {
        const next = { ...current }
        for (const key of keys) next[key] = draft[key]
        return next
      })
      setServerErrors({})
      const { saved, cleared } = result.data
      toast.success(
        [saved && `${saved} mark${saved === 1 ? '' : 's'} saved`, cleared && `${cleared} cleared`].filter(Boolean).join(', ') +
          '. Results are being recalculated.',
      )
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        const cells = serverErrorsToCells(error.rows('marks'), keys)
        setServerErrors(cells)
        toast.error(Object.keys(cells).length ? 'Some marks were refused. Nothing was saved.' : error.message)
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  function focusCell(row: number, col: number) {
    document.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)?.focus()
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusCell(row + 1, col)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusCell(row - 1, col)
    } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault()
      void onSave()
    }
  }

  const invalidCount = changed.filter((key) => {
    const paperId = Number(key.split(':')[1])
    return cellError(draft[key], maxByPaper.get(paperId) ?? null)
  }).length

  return (
    <>
      {guard}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {sheet.subject.name} <span className="font-normal text-muted-foreground">· {sheet.class.name}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {sheet.papers.length > 1 ? `${sheet.papers.length} papers, combined by ${sheet.subject.aggregation_rule_label.toLowerCase()}` : 'One paper'}{' '}
            · {counts.entered}/{counts.expected} marks entered
          </p>
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setDraft(original)} disabled={!isDirty || save.isPending}>
              <RotateCcwIcon /> Discard
            </Button>
            <Button onClick={() => void onSave()} disabled={!isDirty || save.isPending}>
              {save.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Save{isDirty ? ` ${changed.length}` : ''}
            </Button>
          </div>
        )}
      </div>

      {!editable && (
        <Alert className="mb-4">
          <AlertDescription>
            {!sheet.exam.accepts_score_entry
              ? 'This exam is not in marking, so marks cannot be changed.'
              : 'You can view this sheet but are not assigned to enter its marks.'}
          </AlertDescription>
        </Alert>
      )}
      {newerOnServer && (
        <Alert className="mb-4">
          <AlertDescription>Newer results are available. Save or discard your changes to load them.</AlertDescription>
        </Alert>
      )}
      {invalidCount > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {invalidCount} mark{invalidCount === 1 ? ' needs' : 's need'} fixing before you can save.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Find a pupil" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {editable && <p className="hidden text-xs text-muted-foreground md:block">Enter moves down · Ctrl+S saves</p>}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-max text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 font-medium">Pupil</th>
              {sheet.papers.map((paper) => (
                <th key={paper.subject_paper_id} className="px-3 py-2 font-medium">
                  <div>{paper.name}</div>
                  <MaxMarksPopover
                    examId={examId}
                    classId={sheet.class.id}
                    className={sheet.class.name}
                    paper={paper}
                    disabled={isDirty || !sheet.can_enter || ['locked', 'published', 'archived'].includes(sheet.exam.status)}
                    disabledReason={isDirty ? 'Save or discard your marks first.' : 'Marks-out-of can no longer be changed.'}
                  />
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">
                Score
                <div className="text-xs font-normal text-muted-foreground">as last computed</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, row) => (
              <tr key={student.enrolment_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="sticky left-0 z-10 max-w-52 bg-card px-3 py-1.5">
                  <div className="truncate font-medium">{student.name}</div>
                  <div className="text-xs text-muted-foreground">{student.assessment_no}</div>
                </td>
                {sheet.papers.map((paper, col) => {
                  const key = cellKey(student.enrolment_id, paper.subject_paper_id)
                  const cell = draft[key]
                  const isChanged = changed.includes(key)
                  const error = serverErrors[key] ?? (isChanged ? cellError(cell, paper.max_marks) : null)
                  return (
                    <td key={paper.subject_paper_id} className="px-3 py-1.5">
                      {editable ? (
                        <MarkCell
                          cell={cell}
                          error={error}
                          changed={isChanged}
                          row={row}
                          col={col}
                          label={`${student.name}, ${paper.name}`}
                          onChange={(patch) => update(key, patch)}
                          onKeyDown={onCellKeyDown}
                        />
                      ) : (
                        <span className="tabular-nums">{cell.absent ? 'Absent' : cell.value || '—'}</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatScore(student.subject_score)}
                  {student.subject_band && <span className="ml-1.5 text-xs text-muted-foreground">{student.subject_band}</span>}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={sheet.papers.length + 2} className="px-3 py-8 text-center text-muted-foreground">
                  {sheet.students.length === 0 ? 'No pupils are enrolled in this class for the exam’s year.' : 'No pupil matches.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function MarkCell({
  cell,
  error,
  changed,
  row,
  col,
  label,
  onChange,
  onKeyDown,
}: {
  cell: Cell
  error: string | null
  changed: boolean
  row: number
  col: number
  label: string
  onChange: (patch: Partial<Cell>) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => void
}) {
  const input = (
    <Input
      data-row={row}
      data-col={col}
      aria-label={label}
      aria-invalid={!!error}
      inputMode="decimal"
      autoComplete="off"
      className={cn('h-8 w-20 text-right tabular-nums', changed && !error && 'border-primary bg-primary/5')}
      value={cell.absent ? '' : cell.value}
      placeholder={cell.absent ? 'Abs' : ''}
      disabled={cell.absent}
      onChange={(e) => onChange({ value: e.target.value })}
      onKeyDown={(e) => onKeyDown(e, row, col)}
      onFocus={(e) => e.target.select()}
    />
  )

  return (
    <div className="flex items-center gap-1">
      {/* Always wrapped: swapping the wrapper when an error appears would remount
          the input and drop focus while the user is typing. */}
      <Tooltip open={error ? undefined : false}>
        <TooltipTrigger asChild>{input}</TooltipTrigger>
        <TooltipContent>{error}</TooltipContent>
      </Tooltip>
      <Button
        type="button"
        variant={cell.absent ? 'secondary' : 'ghost'}
        size="xs"
        className={cn('w-9 text-[11px]', !cell.absent && 'text-muted-foreground')}
        aria-pressed={cell.absent}
        title={cell.absent ? 'Marked absent — click to undo' : 'Mark absent'}
        onClick={() => onChange({ absent: !cell.absent })}
      >
        Abs
      </Button>
    </div>
  )
}
