import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDownIcon, ArrowUpIcon, ListPlusIcon, LockIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLevels } from '@/features/reference/api'
import type { AggregationRule, GradingScale, Level, LevelSubject, Subject } from '@/lib/api/types'
import { formatScore } from '@/lib/format'
import { ApiError } from '@/lib/api/errors'
import { numberOrNull, showFormError } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { useCurriculumMutations, useGradingScales, useLevelSubjects, useSubjects } from '../api'
import { aggregationLabels } from '../labels'

const SCHOOL_DEFAULT = 'default'

export function SubjectsPage() {
  const levels = useLevels()
  const levelSubjects = useLevelSubjects()
  const subjects = useSubjects()
  const scales = useGradingScales()
  const [params, setParams] = useSearchParams()
  // Open on the first level that teaches something, not on an empty tab.
  const firstTaught = levels.data?.find((l) => levelSubjects.data?.some((ls) => ls.level_id === l.id))
  const levelId = Number(params.get('level')) || firstTaught?.id || levels.data?.[0]?.id
  const level = levels.data?.find((l) => l.id === levelId)
  const [editing, setEditing] = useState<LevelSubject | 'new' | null>(null)
  const [addingDefaults, setAddingDefaults] = useState(false)
  const { applyDefaults } = useCurriculumMutations()

  return (
    <>
      <PageHeader
        title="Subjects"
        description="What each level teaches, how each subject's papers combine into one score, and its order on mark lists and report cards."
        actions={
          <>
            <Button variant="outline" onClick={() => setAddingDefaults(true)}>
              <ListPlusIcon /> Add default subjects
            </Button>
            <Button onClick={() => setEditing('new')} disabled={!level}>
              <PlusIcon /> Add subject{level ? ` to ${level.name}` : ''}
            </Button>
          </>
        }
      />

      {levels.data && (
        <Tabs value={String(levelId)} onValueChange={(v) => setParams({ level: v }, { replace: true })} className="mb-4">
          <TabsList>
            {levels.data.map((l) => (
              <TabsTrigger key={l.id} value={String(l.id)}>
                {l.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <QueryState query={levelSubjects}>
          {(data) => {
            const rows = data.filter((ls) => ls.level_id === levelId)
            return rows.length === 0 ? (
              <EmptyState
                title={`No subjects at ${level?.name ?? 'this level'} yet`}
                description="Add the subjects this level teaches. Exams at this level examine every active subject unless you choose otherwise."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setAddingDefaults(true)}>
                      <ListPlusIcon /> Add default subjects
                    </Button>
                    <Button variant="outline" onClick={() => setEditing('new')}>
                      Add a subject
                    </Button>
                  </div>
                }
              />
            ) : (
              <LevelSubjectList rows={rows} scales={scales.data ?? []} onEdit={setEditing} />
            )
          }}
        </QueryState>
        <CatalogueCard subjects={subjects.data ?? []} />
      </div>

      <ConfirmDialog
        open={addingDefaults}
        onOpenChange={setAddingDefaults}
        title="Add the default subjects?"
        description={
          <span className="grid gap-2">
            <span>Adds the standard CBC subjects for each level that this school does not offer yet:</span>
            <span className="text-xs">
              <strong>Lower primary</strong> — Mathematics, English (Reading + Grammar), Kiswahili (Kusoma + Lugha), Environmental Activities,
              Creative Arts, CRE.
              <br />
              <strong>Upper primary</strong> — Mathematics, English, Kiswahili, Science and Technology, Social Studies, Agriculture and
              Nutrition, Creative Arts, CRE.
              <br />
              <strong>Junior secondary</strong> — English and Kiswahili (Paper 1 + Paper 2), Mathematics, Creative Arts, Pre-Technical Studies,
              Agriculture, Social Studies, Integrated Science, CRE.
            </span>
            <span>Subjects already set up are not changed. You can rename or edit any of them afterwards.</span>
          </span>
        }
        confirmLabel="Add default subjects"
        onConfirm={async () => {
          const result = await applyDefaults.mutateAsync()
          const added = result.data.level_subjects_added
          toast.success(added === 0 ? 'Every default subject is already set up.' : `Added ${added} subject${added === 1 ? '' : 's'} across the levels.`)
        }}
      />

      {editing && level && (
        <LevelSubjectDialog
          open
          onOpenChange={() => setEditing(null)}
          level={level}
          levelSubject={editing === 'new' ? undefined : editing}
          subjects={subjects.data ?? []}
          taken={(levelSubjects.data ?? []).filter((ls) => ls.level_id === level.id).map((ls) => ls.subject_id)}
          scales={(scales.data ?? []).filter((s) => s.level_id === null || s.level_id === level.id)}
          nextOrder={Math.max(0, ...(levelSubjects.data ?? []).filter((ls) => ls.level_id === level.id).map((ls) => ls.display_order)) + 1}
        />
      )}
    </>
  )
}

function LevelSubjectList({ rows, scales, onEdit }: { rows: LevelSubject[]; scales: GradingScale[]; onEdit: (ls: LevelSubject) => void }) {
  const { updateLevelSubject, deleteLevelSubject } = useCurriculumMutations()
  const [removing, setRemoving] = useState<LevelSubject | null>(null)

  function move(index: number, direction: -1 | 1) {
    const a = rows[index]
    const b = rows[index + direction]
    if (!a || !b) return
    // Swap positions; equal orders get distinct ones.
    const aOrder = b.display_order === a.display_order ? a.display_order + direction : b.display_order
    updateLevelSubject.mutate({ id: a.id, display_order: Math.max(0, aOrder) })
    updateLevelSubject.mutate({ id: b.id, display_order: a.display_order })
  }

  return (
    <div className="grid content-start gap-2">
      {rows.map((ls, index) => (
        <Card key={ls.id} className={cn('gap-2 py-3', !ls.is_active && 'opacity-60')}>
          <CardContent className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon-xs" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                <ArrowDownIcon />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{ls.subject.name}</span>
                <span className="text-xs text-muted-foreground">{ls.subject.code}</span>
                {!ls.is_active && <Badge variant="outline">Inactive</Badge>}
                {!ls.counts_toward_total && <Badge variant="secondary">Not in total</Badge>}
                {ls.in_use && (
                  <Badge variant="outline" title="Examined: papers and how they combine are fixed">
                    <LockIcon /> Examined
                  </Badge>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {ls.papers.length > 1 ? `${aggregationLabels[ls.aggregation_rule]} · ` : ''}
                {ls.papers
                  .map((p) => `${p.name}${p.default_max_marks ? ` /${formatScore(p.default_max_marks)}` : ''}${ls.aggregation_rule === 'weighted_sum' ? ` ×${p.weight}` : ''}`)
                  .join(' · ')}
                {' · '}
                {scales.find((s) => s.id === ls.grading_scale_id)?.name ?? 'School default grading'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${ls.subject.name}`} onClick={() => onEdit(ls)}>
                <PencilIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${ls.subject.name}`} disabled={ls.in_use} onClick={() => setRemoving(ls)}>
                <Trash2Icon />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.subject.name}?`}
        description="It will no longer be offered at this level. The subject stays in the school's catalogue."
        confirmLabel="Remove"
        destructive
        onConfirm={() => (removing ? deleteLevelSubject.mutateAsync(removing.id) : undefined)}
      />
    </div>
  )
}

// ----------------------------------------------------------- level subject

const paperSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(1, 'Name the paper').max(80),
  default_max_marks: z.string().refine((v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0), 'Marks out of, e.g. 50'),
  weight: z.string().refine((v) => v === '' || (/^\d+(\.\d{1,3})?$/.test(v) && Number(v) > 0), 'A positive number'),
})

const levelSubjectSchema = z
  .object({
    subject_mode: z.enum(['existing', 'new']),
    subject_id: z.string(),
    new_code: z.string().trim().max(40),
    new_name: z.string().trim().max(160),
    aggregation_rule: z.enum(['single', 'percentage_of_combined_max', 'sum', 'average', 'weighted_sum']),
    counts_toward_total: z.boolean(),
    grading_scale_id: z.string(),
    is_active: z.boolean(),
    papers: z.array(paperSchema).min(1, 'Add at least one paper').max(10),
  })
  .superRefine((v, ctx) => {
    if (v.subject_mode === 'existing' && !v.subject_id) ctx.addIssue({ code: 'custom', path: ['subject_id'], message: 'Choose a subject' })
    if (v.subject_mode === 'new' && !v.new_name) ctx.addIssue({ code: 'custom', path: ['new_name'], message: 'Name the subject' })
    if (v.subject_mode === 'new' && !/^[A-Za-z0-9_-]+$/.test(v.new_code)) {
      ctx.addIssue({ code: 'custom', path: ['new_code'], message: 'A short code, e.g. ENG' })
    }
    if (v.aggregation_rule !== 'single' && v.papers.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['papers'], message: 'Combining papers needs at least two' })
    }
  })

type LevelSubjectValues = z.infer<typeof levelSubjectSchema>

function LevelSubjectDialog({
  open,
  onOpenChange,
  level,
  levelSubject,
  subjects,
  taken,
  scales,
  nextOrder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  level: Level
  levelSubject?: LevelSubject
  subjects: Subject[]
  taken: number[]
  scales: GradingScale[]
  nextOrder: number
}) {
  const { createLevelSubject, updateLevelSubject, createSubject } = useCurriculumMutations()
  const frozen = levelSubject?.in_use ?? false
  const available = subjects.filter((s) => s.is_active && !taken.includes(s.id))

  const form = useForm<LevelSubjectValues>({
    resolver: zodResolver(levelSubjectSchema),
    defaultValues: {
      subject_mode: levelSubject || available.length > 0 ? 'existing' : 'new',
      subject_id: levelSubject ? String(levelSubject.subject_id) : '',
      new_code: '',
      new_name: '',
      aggregation_rule: levelSubject?.aggregation_rule ?? 'single',
      counts_toward_total: levelSubject?.counts_toward_total ?? true,
      grading_scale_id: levelSubject?.grading_scale_id ? String(levelSubject.grading_scale_id) : SCHOOL_DEFAULT,
      is_active: levelSubject?.is_active ?? true,
      papers: levelSubject?.papers.map((p) => ({
        id: p.id,
        name: p.name,
        default_max_marks: p.default_max_marks === null ? '' : String(p.default_max_marks),
        weight: String(p.weight),
      })) ?? [{ name: 'Paper 1', default_max_marks: '100', weight: '1' }],
    },
  })
  const papers = useFieldArray({ control: form.control, name: 'papers' })
  const [mode, rule, countsTowardTotal, isActive, subjectId, scaleId] = useWatch({
    control: form.control,
    name: ['subject_mode', 'aggregation_rule', 'counts_toward_total', 'is_active', 'subject_id', 'grading_scale_id'],
  })
  const { errors, isSubmitting } = form.formState

  function setRule(next: AggregationRule) {
    form.setValue('aggregation_rule', next, { shouldValidate: form.formState.isSubmitted })
    // Keep the paper count consistent with the rule the admin picked.
    if (next !== 'single' && papers.fields.length < 2) papers.append({ name: 'Paper 2', default_max_marks: '100', weight: '1' })
  }

  async function submit(values: LevelSubjectValues) {
    const common = {
      aggregation_rule: values.aggregation_rule,
      counts_toward_total: values.counts_toward_total,
      grading_scale_id: values.grading_scale_id === SCHOOL_DEFAULT ? null : Number(values.grading_scale_id),
      is_active: values.is_active,
      papers: values.papers.map((p) => ({
        id: p.id,
        name: p.name,
        default_max_marks: numberOrNull(p.default_max_marks),
        weight: numberOrNull(p.weight) ?? 1,
      })),
    }

    try {
      if (levelSubject) {
        await updateLevelSubject.mutateAsync({
          id: levelSubject.id,
          ...common,
          // Frozen subjects must not send structural changes they cannot make.
          ...(frozen ? { aggregation_rule: undefined } : {}),
        })
      } else {
        let subjectIdValue = Number(values.subject_id)
        if (values.subject_mode === 'new') {
          try {
            subjectIdValue = (await createSubject.mutateAsync({ code: values.new_code, name: values.new_name })).id
          } catch (error) {
            if (error instanceof ApiError && error.isValidation) {
              if (error.field('code')) form.setError('new_code', { message: error.field('code') })
              if (error.field('name')) form.setError('new_name', { message: error.field('name') })
              return
            }
            throw error
          }
          // Later failures should not create the catalogue subject twice.
          form.setValue('subject_mode', 'existing')
          form.setValue('subject_id', String(subjectIdValue))
        }
        await createLevelSubject.mutateAsync({ ...common, level_id: level.id, subject_id: subjectIdValue, display_order: nextOrder })
      }
      toast.success('Subject saved.')
      onOpenChange(false)
    } catch (error) {
      showFormError(form, error, ['subject_id', 'aggregation_rule', 'papers', 'grading_scale_id'])
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={levelSubject ? `${levelSubject.subject.name} at ${level.name}` : `Add a subject to ${level.name}`}
      busy={isSubmitting}
      onSubmit={form.handleSubmit(submit)}
    >
      {frozen && (
        <Alert>
          <LockIcon />
          <AlertDescription>
            This subject has been examined, so its existing papers and how they combine are fixed. You can still <strong>add</strong> a paper —
            each exam chooses which papers it sets — and rename papers, change their default marks-out-of, grading, order and whether the
            subject is active.
          </AlertDescription>
        </Alert>
      )}

      {!levelSubject && (
        <div className="grid gap-3 rounded-lg border p-3">
          <Tabs value={mode} onValueChange={(v) => form.setValue('subject_mode', v as 'existing' | 'new')}>
            <TabsList>
              <TabsTrigger value="existing" disabled={available.length === 0}>
                From the catalogue
              </TabsTrigger>
              <TabsTrigger value="new">New subject</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === 'existing' ? (
            <Field label="Subject" error={errors.subject_id?.message}>
              <Select value={subjectId} onValueChange={(v) => form.setValue('subject_id', v, { shouldValidate: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <Field label="Code" htmlFor="new-code" error={errors.new_code?.message}>
                <Input id="new-code" placeholder="ENG" className="uppercase" {...form.register('new_code')} />
              </Field>
              <Field label="Name" htmlFor="new-name" error={errors.new_name?.message}>
                <Input id="new-name" placeholder="English" {...form.register('new_name')} />
              </Field>
            </div>
          )}
        </div>
      )}

      <Field label="How papers combine into the subject score" error={errors.aggregation_rule?.message}>
        <Select value={rule} onValueChange={(v) => setRule(v as AggregationRule)} disabled={frozen}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(aggregationLabels) as AggregationRule[]).map((key) => (
              <SelectItem key={key} value={key}>
                {aggregationLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Papers</div>
        {papers.fields.map((paper, index) => (
          <div key={paper.id} className="grid grid-cols-[1fr_6rem_auto] items-start gap-2 sm:grid-cols-[1fr_7rem_6rem_auto]">
            <Field label={<span className="sr-only">Paper name</span>} error={errors.papers?.[index]?.name?.message} className="grid gap-1">
              <Input aria-label={`Paper ${index + 1} name`} {...form.register(`papers.${index}.name`)} />
            </Field>
            <Field label={<span className="sr-only">Out of</span>} error={errors.papers?.[index]?.default_max_marks?.message} className="grid gap-1">
              <Input aria-label={`Paper ${index + 1} marks out of`} placeholder="Out of" inputMode="decimal" {...form.register(`papers.${index}.default_max_marks`)} />
            </Field>
            {rule === 'weighted_sum' ? (
              <Field label={<span className="sr-only">Weight</span>} error={errors.papers?.[index]?.weight?.message} className="hidden gap-1 sm:grid">
                <Input aria-label={`Paper ${index + 1} weight`} placeholder="Weight" inputMode="decimal" disabled={frozen} {...form.register(`papers.${index}.weight`)} />
              </Field>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove paper ${index + 1}`}
              // Examined subjects keep the papers they had; only papers added
              // in this dialog can still be taken back out.
              disabled={papers.fields.length <= 1 || (frozen && index < (levelSubject?.papers.length ?? 0))}
              onClick={() => papers.remove(index)}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        {errors.papers?.message && <p className="text-xs text-destructive">{errors.papers.message}</p>}
        {papers.fields.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => papers.append({ name: `Paper ${papers.fields.length + 1}`, default_max_marks: '100', weight: '1' })}
          >
            <PlusIcon /> Add paper
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Marks-out-of here is the default for new exams; each exam can change it.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grading">
          <Select value={scaleId} onValueChange={(v) => form.setValue('grading_scale_id', v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCHOOL_DEFAULT}>School default</SelectItem>
              {scales.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                  {s.is_platform ? ' (platform)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 pt-1">
          <label className="flex items-center justify-between gap-2 text-sm">
            Counts toward the total
            <Switch checked={countsTowardTotal} onCheckedChange={(v) => form.setValue('counts_toward_total', v)} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Active
            <Switch checked={isActive} onCheckedChange={(v) => form.setValue('is_active', v)} />
          </label>
        </div>
      </div>
    </FormDialog>
  )
}

// -------------------------------------------------------------- catalogue

function CatalogueCard({ subjects }: { subjects: Subject[] }) {
  const { updateSubject, deleteSubject } = useCurriculumMutations()
  const [editing, setEditing] = useState<{ id: number; code: string; name: string } | null>(null)
  const [removing, setRemoving] = useState<Subject | null>(null)

  async function save() {
    if (!editing) return
    try {
      await updateSubject.mutateAsync(editing)
      setEditing(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the subject.')
    }
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="text-base">Catalogue</CardTitle>
        <CardDescription>Every subject the school teaches, at any level.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {editing?.id === subject.id ? (
                <form
                  className="grid flex-1 grid-cols-[5rem_1fr_auto] gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void save()
                  }}
                >
                  <Input aria-label="Code" className="h-7 uppercase" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                  <Input aria-label="Name" className="h-7" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">{subject.code}</span>
                  <span className={cn('flex-1', !subject.is_active && 'text-muted-foreground line-through')}>{subject.name}</span>
                  <Switch
                    aria-label={`${subject.name} active`}
                    checked={subject.is_active}
                    onCheckedChange={(v) => updateSubject.mutate({ id: subject.id, is_active: v })}
                  />
                  <Button variant="ghost" size="icon-xs" aria-label={`Edit ${subject.name}`} onClick={() => setEditing({ id: subject.id, code: subject.code, name: subject.name })}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete ${subject.name}`} onClick={() => setRemoving(subject)}>
                    <Trash2Icon />
                  </Button>
                </>
              )}
            </li>
          ))}
          {subjects.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">No subjects yet.</li>}
        </ul>
      </CardContent>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.name}?`}
        description="Only a subject that has never been examined can be deleted. It is removed from every level."
        confirmLabel="Delete"
        destructive
        onConfirm={() => (removing ? deleteSubject.mutateAsync(removing.id) : undefined)}
      />
    </Card>
  )
}
