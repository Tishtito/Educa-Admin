import { useState } from 'react'
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon, WandSparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { QueryState } from '@/components/data/QueryState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError, errorMessage } from '@/lib/api/errors'
import { useBellSchedules, useTimetableMutations, type BellSchedule, type PeriodKind } from '../api'
import { DAY_NAMES } from '../week'

interface DraftPeriod {
  kind: PeriodKind
  label: string
  starts_at: string
  ends_at: string
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export function BellSchedulesPanel() {
  const schedules = useBellSchedules()
  const { applyDefaultSchedules } = useTimetableMutations()

  return (
    <QueryState query={schedules}>
      {(data) => {
        const missing = data.levels.filter((level) => !data.schedules.some((s) => s.level_id === level.id))

        return (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              The school day for each level: lessons, breaks and lunch, with real times. A level without its own day follows the school default. Changing a day
              never moves lessons in a timetable already generated.
            </p>
            {missing.length > 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">
                    {missing.map((l) => l.name).join(', ')} {missing.length === 1 ? 'has' : 'have'} no school day yet. Start from the CBC lesson lengths (30 minutes in lower
                    primary, 35 in upper primary, 40 in junior secondary) and adjust.
                  </p>
                  <Button
                    variant="outline"
                    disabled={applyDefaultSchedules.isPending}
                    onClick={() => applyDefaultSchedules.mutate(undefined, { onSuccess: (r) => toast.success(`Added ${r.created} school day${r.created === 1 ? '' : 's'}.`) })}
                  >
                    <WandSparklesIcon /> Use CBC defaults
                  </Button>
                </CardContent>
              </Card>
            )}
            {data.levels.map((level) => (
              <ScheduleEditor
                key={`${level.id}:${data.schedules.find((s) => s.level_id === level.id)?.id ?? 'new'}`}
                levelId={level.id}
                title={level.name}
                schedule={data.schedules.find((s) => s.level_id === level.id) ?? null}
              />
            ))}
            <ScheduleEditor key={`default:${data.schedules.find((s) => s.level_id === null)?.id ?? 'new'}`} levelId={null} title="School default" schedule={data.schedules.find((s) => s.level_id === null) ?? null} />
          </div>
        )
      }}
    </QueryState>
  )
}

function ScheduleEditor({ levelId, title, schedule }: { levelId: number | null; title: string; schedule: BellSchedule | null }) {
  const { saveBellSchedule, deleteBellSchedule } = useTimetableMutations()
  const [editing, setEditing] = useState(false)
  const [days, setDays] = useState<number[]>(schedule?.days ?? [1, 2, 3, 4, 5])
  const [periods, setPeriods] = useState<DraftPeriod[]>(
    schedule?.periods.map((p) => ({ kind: p.kind, label: p.label ?? '', starts_at: p.starts_at, ends_at: p.ends_at })) ?? [],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const lessons = periods.filter((p) => p.kind === 'lesson').length

  function add(kind: PeriodKind) {
    setPeriods((current) => {
      const last = current.at(-1)
      const lastLesson = [...current].reverse().find((p) => p.kind === 'lesson')
      const start = last ? toMinutes(last.ends_at) : 8 * 60
      const length = kind === 'lesson' ? (lastLesson ? toMinutes(lastLesson.ends_at) - toMinutes(lastLesson.starts_at) : 35) : kind === 'lunch' ? 60 : 20
      return [...current, { kind, label: kind === 'lesson' ? '' : kind === 'lunch' ? 'Lunch' : 'Break', starts_at: toTime(start), ends_at: toTime(start + length) }]
    })
  }

  function update(index: number, patch: Partial<DraftPeriod>) {
    setPeriods((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  async function save() {
    setErrors({})
    try {
      await saveBellSchedule.mutateAsync({
        level_id: levelId,
        name: title,
        days,
        periods: periods.map((p) => ({ kind: p.kind, label: p.label.trim() || null, starts_at: p.starts_at, ends_at: p.ends_at })),
      })
      toast.success(`${title}: school day saved.`)
      setEditing(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0]])))
        toast.error(Object.values(error.fieldErrors)[0]?.[0] ?? error.message)
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              {schedule
                ? `${schedule.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')} · ${schedule.lessons_per_day} lessons a day, ${schedule.periods[0]?.starts_at}–${schedule.periods.at(-1)?.ends_at}`
                : levelId === null
                  ? 'Not set. Levels without their own day need one.'
                  : 'Not set: follows the school default.'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {schedule ? 'Edit' : 'Set up'}
          </Button>
        </CardHeader>
        {schedule && (
          <CardContent className="flex flex-wrap gap-1.5">
            {schedule.periods.map((p) => (
              <span
                key={p.sequence}
                className={p.kind === 'lesson' ? 'rounded-md border px-2 py-0.5 text-xs tabular-nums' : 'rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums'}
              >
                {p.kind === 'lesson' ? p.starts_at : `${p.label ?? p.kind} ${p.starts_at}`}
              </span>
            ))}
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{lessons} lessons a day · {lessons * days.length} a week</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5, 6].map((day) => (
            <label key={day} className="flex items-center gap-2 text-sm">
              <Checkbox checked={days.includes(day)} onCheckedChange={(on) => setDays((d) => (on ? [...d, day].sort() : d.filter((x) => x !== day)))} />
              {DAY_NAMES[day]}
            </label>
          ))}
        </div>
        <div className="grid gap-2">
          {periods.map((period, index) => (
            <div key={index} className="grid grid-cols-[7rem_1fr_6.5rem_6.5rem_2rem] items-center gap-2">
              <Select value={period.kind} onValueChange={(kind) => update(index, { kind: kind as PeriodKind })}>
                <SelectTrigger aria-label="Kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lesson">Lesson</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                </SelectContent>
              </Select>
              <Input aria-label="Label" placeholder={period.kind === 'lesson' ? `Lesson ${periods.slice(0, index + 1).filter((p) => p.kind === 'lesson').length}` : 'Label'} value={period.label} onChange={(e) => update(index, { label: e.target.value })} />
              <Input aria-label="Starts" type="time" value={period.starts_at} aria-invalid={!!errors[`periods.${index}.starts_at`]} onChange={(e) => update(index, { starts_at: e.target.value })} />
              <Input aria-label="Ends" type="time" value={period.ends_at} aria-invalid={!!errors[`periods.${index}.ends_at`]} onChange={(e) => update(index, { ends_at: e.target.value })} />
              <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setPeriods((p) => p.filter((_, i) => i !== index))}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {periods.length === 0 && <p className="text-sm text-muted-foreground">No periods yet.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => add('lesson')}>
            <PlusIcon /> Lesson
          </Button>
          <Button variant="outline" size="sm" onClick={() => add('break')}>
            <PlusIcon /> Break
          </Button>
          <Button variant="outline" size="sm" onClick={() => add('lunch')}>
            <PlusIcon /> Lunch
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <div>
          {schedule && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2Icon /> Remove
                </Button>
              }
              title={`Remove the ${title} school day?`}
              description={levelId === null ? 'Levels without their own day will have none.' : 'This level will follow the school default.'}
              confirmLabel="Remove"
              destructive
              onConfirm={async () => {
                await deleteBellSchedule.mutateAsync(schedule.id)
                setEditing(false)
              }}
            />
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saveBellSchedule.isPending || days.length === 0 || lessons === 0}>
            {saveBellSchedule.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
