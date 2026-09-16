import { useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { CopyIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLevels } from '@/features/reference/api'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { GradeBand, GradingScale, Level } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { useGradingMutations, useGradingScales } from '../api'
import { bandProblems, nextBandStart } from '../bands'

const ALL_LEVELS = 'all'

export function GradingPage() {
  const scales = useGradingScales()
  const levels = useLevels()
  const [editor, setEditor] = useState<{ scale?: GradingScale; copyFrom?: GradingScale } | null>(null)

  return (
    <>
      <PageHeader
        title="Grading"
        description="The bands marks fall into — e.g. Meeting Expectations for 51–75. The default scale for a level grades pupils' means and every subject without a scale of its own."
        actions={
          <Button onClick={() => setEditor({})}>
            <PlusIcon /> New scale
          </Button>
        }
      />
      <QueryState query={scales}>
        {(data) => (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.map((scale) => (
              <ScaleCard
                key={scale.id}
                scale={scale}
                levels={levels.data ?? []}
                onEdit={() => setEditor({ scale })}
                onCopy={() => setEditor({ copyFrom: scale })}
              />
            ))}
          </div>
        )}
      </QueryState>
      {editor && (
        <ScaleDialog open onOpenChange={() => setEditor(null)} scale={editor.scale} copyFrom={editor.copyFrom} levels={levels.data ?? []} />
      )}
    </>
  )
}

function ScaleCard({ scale, levels, onEdit, onCopy }: { scale: GradingScale; levels: Level[]; onEdit: () => void; onCopy: () => void }) {
  const { makeDefault, deleteScale } = useGradingMutations()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingDefault, setConfirmingDefault] = useState(false)
  const levelName = scale.level_id ? levels.find((l) => l.id === scale.level_id)?.name : 'All levels'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {scale.name}
          {scale.is_default && <Badge>Default</Badge>}
          {scale.is_platform && <Badge variant="outline">Platform</Badge>}
        </CardTitle>
        <CardDescription>
          {levelName}
          {scale.used_by_subjects > 0 && ` · used by ${scale.used_by_subjects} subject${scale.used_by_subjects === 1 ? '' : 's'}`}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${scale.name}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!scale.is_platform && (
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon /> Edit bands
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onCopy}>
                <CopyIcon /> {scale.is_platform ? 'Copy to my school' : 'Duplicate'}
              </DropdownMenuItem>
              {!scale.is_platform && !scale.is_default && (
                <DropdownMenuItem onSelect={() => setConfirmingDefault(true)}>
                  <StarIcon /> Make default
                </DropdownMenuItem>
              )}
              {!scale.is_platform && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                    <Trash2Icon /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            open={confirmingDefault}
            onOpenChange={setConfirmingDefault}
            title={`Make "${scale.name}" the default?`}
            description={
              <>
                <p>It will grade pupils’ means and every subject without its own scale at {levelName?.toLowerCase()}.</p>
                <p>Exams still in marking or locked are recalculated. Published report cards keep the grading they were issued with.</p>
              </>
            }
            confirmLabel="Make default"
            onConfirm={() => makeDefault.mutateAsync(scale.id).then(() => toast.success(`${scale.name} is now the default.`))}
          />
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={`Delete "${scale.name}"?`}
            description="A scale that has graded any results, or that a subject uses, cannot be deleted."
            confirmLabel="Delete"
            destructive
            onConfirm={() => deleteScale.mutateAsync(scale.id)}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <BandBar bands={scale.bands} />
        <ul className="mt-3 grid gap-1 text-sm">
          {scale.bands.map((band) => (
            <li key={band.id ?? band.sort_order} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full border" style={{ background: band.color ?? undefined }} />
              <span className="w-14 shrink-0 font-medium">{band.abbreviation}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{band.label}</span>
              <span className="shrink-0 tabular-nums">
                {band.min_marks}–{band.max_marks}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** The scale drawn to proportion, so a gap or a lopsided band is visible at a glance. */
function BandBar({ bands }: { bands: Pick<GradeBand, 'min_marks' | 'max_marks' | 'abbreviation' | 'color'>[] }) {
  const sorted = [...bands].sort((a, b) => Number(a.min_marks) - Number(b.min_marks))
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-md border text-[10px]" aria-hidden>
      {sorted.map((band, i) => {
        const width = Math.max(0, Number(band.max_marks) - Number(band.min_marks) + 1)
        return (
          <div
            key={i}
            className={cn('flex items-center justify-center border-r text-white last:border-r-0', !band.color && 'bg-muted text-foreground')}
            style={{ width: `${width}%`, background: band.color ?? undefined }}
            title={`${band.abbreviation}: ${band.min_marks}–${band.max_marks}`}
          >
            {width >= 10 ? band.abbreviation : ''}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- editor

const defaultColors = ['#e11d48', '#f59e0b', '#3b82f6', '#16a34a', '#7c3aed', '#0891b2', '#64748b']

interface BandRow {
  label: string
  abbreviation: string
  points: string
  min_marks: string
  max_marks: string
  color: string
}

interface ScaleValues {
  name: string
  kind: GradingScale['kind']
  level_id: string
  bands: BandRow[]
}

const toRow = (band: GradeBand): BandRow => ({
  label: band.label,
  abbreviation: band.abbreviation,
  points: band.points === null ? '' : String(band.points),
  min_marks: String(band.min_marks),
  max_marks: String(band.max_marks),
  color: band.color ?? '',
})

function ScaleDialog({
  open,
  onOpenChange,
  scale,
  copyFrom,
  levels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scale?: GradingScale
  copyFrom?: GradingScale
  levels: Level[]
}) {
  const { createScale, renameScale, replaceBands } = useGradingMutations()
  const source = scale ?? copyFrom
  const form = useForm<ScaleValues>({
    defaultValues: {
      name: scale?.name ?? (copyFrom ? `${copyFrom.name} (school)` : ''),
      kind: source?.kind ?? 'performance_level',
      level_id: source?.level_id ? String(source.level_id) : ALL_LEVELS,
      bands: source?.bands.map(toRow) ?? [
        { label: 'BELOW EXPECTATIONS', abbreviation: 'BE', points: '1', min_marks: '0', max_marks: '25', color: defaultColors[0] },
        { label: 'APPROACHING EXPECTATIONS', abbreviation: 'AE', points: '2', min_marks: '26', max_marks: '50', color: defaultColors[1] },
        { label: 'MEETING EXPECTATIONS', abbreviation: 'ME', points: '3', min_marks: '51', max_marks: '75', color: defaultColors[2] },
        { label: 'EXCEEDING EXPECTATIONS', abbreviation: 'EE', points: '4', min_marks: '76', max_marks: '100', color: defaultColors[3] },
      ],
    },
  })
  const bands = useFieldArray({ control: form.control, name: 'bands' })
  const [rows, levelId, kind] = useWatch({ control: form.control, name: ['bands', 'level_id', 'kind'] })
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  const parsed: GradeBand[] = useMemo(
    () =>
      rows.map((row) => ({
        label: row.label.trim(),
        abbreviation: row.abbreviation.trim(),
        points: row.points === '' ? null : Number(row.points),
        min_marks: row.min_marks === '' ? Number.NaN : Number(row.min_marks),
        max_marks: row.max_marks === '' ? Number.NaN : Number(row.max_marks),
        color: row.color || null,
      })),
    [rows],
  )
  const problems = { ...bandProblems(parsed), ...serverErrors }
  parsed.forEach((band, i) => {
    if (!band.label) problems[`bands.${i}.label`] ??= 'Label required'
    if (!band.abbreviation) problems[`bands.${i}.abbreviation`] ??= 'Abbreviation required'
  })
  const rowProblem = (i: number) =>
    problems[`bands.${i}.min_marks`] ?? problems[`bands.${i}.max_marks`] ?? problems[`bands.${i}.label`] ?? problems[`bands.${i}.abbreviation`]

  async function submit() {
    setSubmitted(true)
    setServerErrors({})
    const name = form.getValues('name').trim()
    setNameError(name ? null : 'Name the scale')
    if (!name || Object.keys(problems).length > 0) return

    setBusy(true)
    try {
      if (scale) {
        if (name !== scale.name || kind !== scale.kind) await renameScale.mutateAsync({ id: scale.id, name, kind })
        await replaceBands.mutateAsync({ id: scale.id, bands: parsed })
        toast.success('Bands saved. Exams still in marking or locked are being recalculated.')
      } else {
        await createScale.mutateAsync({
          name,
          kind,
          level_id: levelId === ALL_LEVELS ? null : Number(levelId),
          bands: parsed,
        })
        toast.success(`${name} created. Make it the default, or choose it for particular subjects.`)
      }
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setServerErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0]])))
        if (error.field('name')) setNameError(error.field('name') ?? null)
      } else {
        toast.error(errorMessage(error))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={scale ? `Edit ${scale.name}` : copyFrom ? `Copy ${copyFrom.name}` : 'New grading scale'}
      description="Bands are whole numbers that cover 0 to 100 with no gaps or overlaps."
      submitLabel={scale ? 'Save bands' : 'Create scale'}
      busy={busy}
      onSubmit={() => void submit()}
    >
      {scale && (
        <Alert>
          <AlertDescription>
            If these bands already appear on published report cards they cannot be changed — create a new scale and make it the default instead.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="scale-name" error={nameError ?? undefined} className="grid gap-1.5 sm:col-span-1">
          <Input id="scale-name" {...form.register('name')} />
        </Field>
        <Field label="Kind">
          <Select value={kind} onValueChange={(v) => form.setValue('kind', v as GradingScale['kind'])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="performance_level">Performance levels</SelectItem>
              <SelectItem value="grade">Letter grades</SelectItem>
              <SelectItem value="points">Points</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Level">
          <Select value={levelId} onValueChange={(v) => form.setValue('level_id', v)} disabled={!!scale}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LEVELS}>All levels</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <BandBar bands={parsed.map((b) => ({ ...b, min_marks: b.min_marks || 0, max_marks: b.max_marks || 0 }))} />

      <div className="grid gap-2 overflow-x-auto">
        <div className="grid min-w-[40rem] grid-cols-[2.5rem_1fr_5rem_4rem_4.5rem_4.5rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
          <span>Colour</span>
          <span>Label</span>
          <span>Short</span>
          <span>Points</span>
          <span>From</span>
          <span>To</span>
          <span />
        </div>
        {bands.fields.map((field, index) => {
          // Checked live: a gap or overlap is easier to fix while typing the number that caused it.
          const problem = rowProblem(index)
          const showProblem = !!problem && (submitted || rows[index]?.label !== '')
          return (
            <div key={field.id} className="grid min-w-[40rem] gap-1">
              <div className="grid grid-cols-[2.5rem_1fr_5rem_4rem_4.5rem_4.5rem_2rem] items-center gap-2">
                <Input type="color" aria-label={`Band ${index + 1} colour`} className="h-8 w-10 p-1" {...form.register(`bands.${index}.color`)} />
                <Input aria-label={`Band ${index + 1} label`} {...form.register(`bands.${index}.label`)} />
                <Input aria-label={`Band ${index + 1} abbreviation`} {...form.register(`bands.${index}.abbreviation`)} />
                <Input aria-label={`Band ${index + 1} points`} inputMode="numeric" {...form.register(`bands.${index}.points`)} />
                <Input
                  aria-label={`Band ${index + 1} from`}
                  inputMode="numeric"
                  aria-invalid={!!problems[`bands.${index}.min_marks`] && !!showProblem}
                  {...form.register(`bands.${index}.min_marks`)}
                />
                <Input
                  aria-label={`Band ${index + 1} to`}
                  inputMode="numeric"
                  aria-invalid={!!problems[`bands.${index}.max_marks`] && !!showProblem}
                  {...form.register(`bands.${index}.max_marks`)}
                />
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove band ${index + 1}`} disabled={bands.fields.length <= 1} onClick={() => bands.remove(index)}>
                  <XIcon />
                </Button>
              </div>
              {showProblem && <p className="pl-12 text-xs text-destructive">{problem}</p>}
            </div>
          )
        })}
        {problems.bands && <p className="text-xs text-destructive">{problems.bands}</p>}
        {bands.fields.length < 20 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              bands.append({
                label: '',
                abbreviation: '',
                points: '',
                min_marks: String(nextBandStart(parsed.map((b) => ({ max_marks: Number.isNaN(b.max_marks) ? 0 : b.max_marks })))),
                max_marks: '100',
                color: defaultColors[bands.fields.length % defaultColors.length],
              })
            }
          >
            <PlusIcon /> Add band
          </Button>
        )}
      </div>
    </FormDialog>
  )
}
