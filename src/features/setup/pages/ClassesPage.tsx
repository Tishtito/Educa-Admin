import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLevels, useStreams } from '@/features/reference/api'
import type { Level, SchoolClass, Stream } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { numberOrNull, showFormError } from '@/lib/forms'
import { useClassMutations, useClassesWithCounts } from '../api'

const NO_STREAM = 'none'

export function ClassesPage() {
  const classes = useClassesWithCounts()
  const levels = useLevels()
  const streams = useStreams()
  const [editing, setEditing] = useState<SchoolClass | 'new' | null>(null)

  return (
    <>
      <PageHeader
        title="Classes and streams"
        description="A class is a grade and, if the school has more than one per grade, a stream. Pupils move between classes each year; the classes stay."
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon /> New class
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <QueryState query={classes}>
          {(data) =>
            data.length === 0 ? (
              <EmptyState title="No classes yet" action={<Button onClick={() => setEditing('new')}>New class</Button>} />
            ) : (
              <div className="grid gap-4">
                {(levels.data ?? []).map((level) => {
                  const inLevel = data.filter((c) => c.level_id === level.id)
                  if (inLevel.length === 0) return null
                  return <LevelClasses key={level.id} level={level} classes={inLevel} onEdit={setEditing} />
                })}
              </div>
            )
          }
        </QueryState>
        <StreamsCard streams={streams.data ?? []} />
      </div>
      {editing && (
        <ClassDialog
          open
          onOpenChange={() => setEditing(null)}
          schoolClass={editing === 'new' ? undefined : editing}
          levels={levels.data ?? []}
          streams={streams.data ?? []}
        />
      )}
    </>
  )
}

function LevelClasses({ level, classes, onEdit }: { level: Level; classes: SchoolClass[]; onEdit: (c: SchoolClass) => void }) {
  const { deleteClass } = useClassMutations()
  const pupils = classes.reduce((sum, c) => sum + (c.students_count ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{level.name}</CardTitle>
        <CardDescription>
          {classes.length} class{classes.length === 1 ? '' : 'es'} · {pupils} pupil{pupils === 1 ? '' : 's'} this year
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Stream</TableHead>
              <TableHead className="text-right">Pupils</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((item) => {
              const full = item.capacity !== null && (item.students_count ?? 0) > item.capacity
              return (
                <TableRow key={item.id} className={cn(!item.is_active && 'text-muted-foreground')}>
                  <TableCell className="font-medium">
                    {item.name} {!item.is_active && <Badge variant="outline">Inactive</Badge>}
                  </TableCell>
                  <TableCell>{item.stream ?? '—'}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', full && 'font-medium text-destructive')}>
                    {item.students_count ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.capacity ?? '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
                      <PencilIcon />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`}>
                          <Trash2Icon />
                        </Button>
                      }
                      title={`Delete ${item.name}?`}
                      description="A class that has had pupils, exams or teachers cannot be deleted — mark it inactive instead so its history stays."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => deleteClass.mutateAsync(item.id).then(() => toast.success(`${item.name} deleted.`))}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

const classSchema = z.object({
  grade_id: z.string().min(1, 'Choose the grade'),
  stream_id: z.string(),
  name: z.string().trim().max(120),
  capacity: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 1000), 'Enter a number of pupils'),
  is_active: z.boolean(),
})

type ClassValues = z.infer<typeof classSchema>

function ClassDialog({
  open,
  onOpenChange,
  schoolClass,
  levels,
  streams,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolClass?: SchoolClass
  levels: Level[]
  streams: Stream[]
}) {
  const { createClass, updateClass } = useClassMutations()
  const form = useForm<ClassValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      grade_id: schoolClass ? String(schoolClass.grade_id) : '',
      stream_id: schoolClass?.stream_id ? String(schoolClass.stream_id) : NO_STREAM,
      name: schoolClass?.name ?? '',
      capacity: schoolClass?.capacity ? String(schoolClass.capacity) : '',
      is_active: schoolClass?.is_active ?? true,
    },
  })
  const [gradeId, streamId, isActive] = useWatch({ control: form.control, name: ['grade_id', 'stream_id', 'is_active'] })
  const { errors, isSubmitting } = form.formState

  const gradeName = levels.flatMap((l) => l.grades).find((g) => String(g.id) === gradeId)?.name
  const streamName = streams.find((s) => String(s.id) === streamId)?.name
  const suggested = [gradeName, streamName].filter(Boolean).join(' ')

  async function submit(values: ClassValues) {
    const input = {
      grade_id: Number(values.grade_id),
      stream_id: values.stream_id === NO_STREAM ? null : Number(values.stream_id),
      // Blank lets the server name it after the grade and stream.
      name: values.name || null,
      capacity: numberOrNull(values.capacity),
      is_active: values.is_active,
    }
    try {
      if (schoolClass) await updateClass.mutateAsync({ id: schoolClass.id, ...input })
      else await createClass.mutateAsync(input)
      toast.success('Class saved.')
      onOpenChange(false)
    } catch (error) {
      showFormError(form, error, ['grade_id', 'stream_id', 'name', 'capacity'])
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={schoolClass ? `Edit ${schoolClass.name}` : 'New class'}
      busy={isSubmitting}
      onSubmit={form.handleSubmit(submit)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grade" error={errors.grade_id?.message}>
          <Select value={gradeId} onValueChange={(v) => form.setValue('grade_id', v, { shouldValidate: true })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a grade" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((level) => (
                <SelectGroup key={level.id}>
                  <SelectLabel>{level.name}</SelectLabel>
                  {level.grades.map((grade) => (
                    <SelectItem key={grade.id} value={String(grade.id)}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Stream" error={errors.stream_id?.message}>
          <Select value={streamId} onValueChange={(v) => form.setValue('stream_id', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_STREAM}>No stream</SelectItem>
              {streams.map((stream) => (
                <SelectItem key={stream.id} value={String(stream.id)}>
                  {stream.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Name" htmlFor="class-name" error={errors.name?.message} hint={suggested ? `Leave blank to use “${suggested}”.` : undefined}>
        <Input id="class-name" placeholder={suggested} {...form.register('name')} />
      </Field>
      <Field label="Capacity" htmlFor="class-capacity" error={errors.capacity?.message} hint="Optional. Used to flag overfull classes.">
        <Input id="class-capacity" inputMode="numeric" className="max-w-32" {...form.register('capacity')} />
      </Field>
      {schoolClass && (
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            Active
            <span className="block text-xs text-muted-foreground">Inactive classes are left out of new exams and enrolment.</span>
          </span>
          <Switch checked={isActive} onCheckedChange={(v) => form.setValue('is_active', v)} />
        </label>
      )}
    </FormDialog>
  )
}

function StreamsCard({ streams }: { streams: Stream[] }) {
  const { createStream, updateStream, deleteStream } = useClassMutations()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)

  async function add() {
    if (!name.trim()) return
    try {
      await createStream.mutateAsync({ name: name.trim() })
      setName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the stream.')
    }
  }

  async function rename() {
    if (!editing?.name.trim()) return
    try {
      await updateStream.mutateAsync({ id: editing.id, name: editing.name.trim() })
      setEditing(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not rename the stream.')
    }
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-base">Streams</CardTitle>
        <CardDescription>e.g. Blue, East. Optional.</CardDescription>
        <CardAction />
      </CardHeader>
      <CardContent className="grid gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <Input aria-label="New stream name" placeholder="New stream" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!name.trim() || createStream.isPending}>
            Add
          </Button>
        </form>
        <ul className="divide-y rounded-lg border">
          {streams.map((stream) => (
            <li key={stream.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              {editing?.id === stream.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void rename()
                  }}
                >
                  <Input
                    autoFocus
                    aria-label="Stream name"
                    className="h-7"
                    value={editing.name}
                    onChange={(e) => setEditing({ id: stream.id, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                  />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1">{stream.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {stream.classes_count ?? 0} class{stream.classes_count === 1 ? '' : 'es'}
                  </span>
                  <Button variant="ghost" size="icon-xs" aria-label={`Rename ${stream.name}`} onClick={() => setEditing({ id: stream.id, name: stream.name })}>
                    <PencilIcon />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-xs" aria-label={`Delete ${stream.name}`} disabled={(stream.classes_count ?? 0) > 0}>
                        <Trash2Icon />
                      </Button>
                    }
                    title={`Delete stream ${stream.name}?`}
                    description="No class uses it."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => deleteStream.mutateAsync(stream.id)}
                  />
                </>
              )}
            </li>
          ))}
          {streams.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">No streams.</li>}
        </ul>
      </CardContent>
    </Card>
  )
}
