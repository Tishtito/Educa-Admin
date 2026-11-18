import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LockIcon, Loader2Icon, SaveIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { QueryState } from '@/components/data/QueryState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAcademicYears, useClasses, useLevels } from '@/features/reference/api'
import { useExamSetup, useExamSetupMutations } from '@/features/setup/api'
import type { Exam, ExamSetup } from '@/lib/api/types'
import { formatScore } from '@/lib/format'
import { showFormError } from '@/lib/forms'
import { useExamContext } from '../useExamContext'

const NONE = 'none'

const examTypes = [
  ['opener', 'Opener'],
  ['midterm', 'Mid-Term'],
  ['endterm', 'End-Term'],
  ['cat', 'CAT'],
  ['weekly', 'Weekly test'],
  ['mock', 'Mock'],
  ['other', 'Other'],
] as const

export function ExamSetupTab() {
  const { exam } = useExamContext()
  const setup = useExamSetup(exam.id)
  const draft = exam.status === 'draft'
  const issued = exam.status === 'published' || exam.status === 'archived'

  return (
    <div className="grid gap-4">
      {!draft && (
        <Alert>
          <LockIcon />
          <AlertDescription>
            {issued
              ? 'Report cards for this exam have been issued, so nothing about it can change.'
              : 'This exam has been opened, so its classes, subjects and rules are fixed. You can still rename it or change its dates.'}
          </AlertDescription>
        </Alert>
      )}
      <DetailsCard key={`${exam.id}:${exam.status}`} exam={exam} />
      <QueryState query={setup}>{(data) => <SubjectsCard exam={exam} setup={data} />}</QueryState>
      {draft && <DeleteCard exam={exam} />}
    </div>
  )
}

// --------------------------------------------------------------- details

const detailsSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the exam a name').max(120),
    exam_type: z.string(),
    term_id: z.string(),
    level_id: z.string(),
    starts_on: z.string(),
    ends_on: z.string(),
    mean_policy: z.string(),
    tie_policy: z.string(),
    class_ids: z.array(z.number()),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { path: ['ends_on'], message: 'The exam cannot end before it starts' })

type DetailsValues = z.infer<typeof detailsSchema>

function DetailsCard({ exam }: { exam: Exam }) {
  const draft = exam.status === 'draft'
  const issued = exam.status === 'published' || exam.status === 'archived'
  const years = useAcademicYears()
  const levels = useLevels()
  const { updateExam } = useExamSetupMutations(exam.id)

  const initial: DetailsValues = {
    name: exam.name,
    exam_type: exam.exam_type,
    term_id: exam.term ? String(exam.term.id) : NONE,
    level_id: exam.level ? String(exam.level.id) : NONE,
    starts_on: exam.starts_on ?? '',
    ends_on: exam.ends_on ?? '',
    mean_policy: exam.mean_policy,
    tie_policy: exam.tie_policy,
    class_ids: exam.classes?.map((c) => c.id) ?? [],
  }
  const form = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: initial })
  const [termId, levelId, examType, classIds, meanPolicy, tiePolicy] = useWatch({
    control: form.control,
    name: ['term_id', 'level_id', 'exam_type', 'class_ids', 'mean_policy', 'tie_policy'],
  })
  const classes = useClasses({ active: true, level_id: levelId === NONE ? undefined : Number(levelId) })
  const year = years.data?.find((y) => y.id === exam.academic_year?.id)
  const { errors, isSubmitting, isDirty, dirtyFields } = form.formState

  async function submit(values: DetailsValues) {
    // Send only what changed: an opened exam refuses any structural field, even unchanged.
    const all: Record<string, unknown> = {
      name: values.name,
      exam_type: values.exam_type,
      term_id: values.term_id === NONE ? null : Number(values.term_id),
      level_id: values.level_id === NONE ? null : Number(values.level_id),
      starts_on: values.starts_on || null,
      ends_on: values.ends_on || null,
      mean_policy: values.mean_policy,
      tie_policy: values.tie_policy,
      class_ids: values.class_ids,
    }
    const changed = Object.fromEntries(Object.entries(all).filter(([key]) => dirtyFields[key as keyof DetailsValues]))
    if (Object.keys(changed).length === 0) return

    try {
      await updateExam.mutateAsync(changed)
      form.reset(values)
      toast.success('Exam updated.')
    } catch (error) {
      showFormError(form, error, ['name', 'exam_type', 'term_id', 'level_id', 'starts_on', 'ends_on', 'class_ids'])
    }
  }

  const set = <K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) =>
    // RHF's path-value type does not narrow through a generic key; the signature above keeps callers typed.
    form.setValue(key, value as never, { shouldDirty: true })

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            {year?.name ?? exam.academic_year?.name} · created as {exam.exam_type_label}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="setup-name" error={errors.name?.message}>
            <Input id="setup-name" disabled={issued} {...form.register('name')} />
          </Field>
          <Field label="Type">
            <Select value={examType} onValueChange={(v) => set('exam_type', v)} disabled={!draft}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {examTypes.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Term" error={errors.term_id?.message}>
            <Select value={termId} onValueChange={(v) => set('term_id', v)} disabled={!draft}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No term</SelectItem>
                {year?.terms.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Starts" htmlFor="setup-start">
              <Input id="setup-start" type="date" disabled={issued} {...form.register('starts_on')} />
            </Field>
            <Field label="Ends" htmlFor="setup-end" error={errors.ends_on?.message}>
              <Input id="setup-end" type="date" disabled={issued} {...form.register('ends_on')} />
            </Field>
          </div>
          <Field label="Class means include">
            <Select value={meanPolicy} onValueChange={(v) => set('mean_policy', v)} disabled={!draft}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complete_students_only">Only pupils with every subject</SelectItem>
                <SelectItem value="all_entered">Every pupil with marks</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Equal totals">
            <Select value={tiePolicy} onValueChange={(v) => set('tie_policy', v)} disabled={!draft || exam.is_legacy_import}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="competition">Share a position, skip the next (1, 1, 3)</SelectItem>
                <SelectItem value="dense">Share a position, no gap (1, 1, 2)</SelectItem>
                {exam.is_legacy_import && <SelectItem value="legacy_ordinal">No ties (old system)</SelectItem>}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:col-span-2">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Level" className="grid w-56 gap-1.5">
                <Select
                  value={levelId}
                  onValueChange={(v) => {
                    set('level_id', v)
                    set('class_ids', [])
                  }}
                  disabled={!draft}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>All levels</SelectItem>
                    {levels.data?.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <span className="pb-2 text-sm text-muted-foreground">{classIds.length} classes chosen</span>
            </div>
            <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
              {(draft ? classes.data ?? [] : exam.classes ?? []).map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    disabled={!draft}
                    checked={classIds.includes(item.id)}
                    onCheckedChange={(checked) => set('class_ids', checked ? [...classIds, item.id] : classIds.filter((id) => id !== item.id))}
                  />
                  {item.name}
                </label>
              ))}
            </div>
            {errors.class_ids?.message && <p className="text-xs text-destructive">{errors.class_ids.message}</p>}
          </div>
        </CardContent>
        {!issued && (
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => form.reset(initial)}>
              Discard
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Save details
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  )
}

// -------------------------------------------------------------- subjects

/** level_subject_id => the papers this exam sets for it. */
type Chosen = Record<number, number[]>

const chosenFrom = (setup: ExamSetup): Chosen =>
  Object.fromEntries(
    setup.subjects.map((subject) => [subject.level_subject_id, subject.selected ? subject.papers.filter((p) => p.selected).map((p) => p.subject_paper_id) : []]),
  )

const defaultPapers = (subject: ExamSetup['subjects'][number]) =>
  subject.aggregation_rule === 'single' ? subject.papers.slice(0, 1).map((p) => p.subject_paper_id) : subject.papers.map((p) => p.subject_paper_id)

/** A one-paper subject swaps its paper rather than adding a second. */
function togglePaper(papers: number[], subject: ExamSetup['subjects'][number], paperId: number, on: boolean): number[] {
  if (!on) return papers.filter((id) => id !== paperId)
  if (subject.aggregation_rule === 'single') return [paperId]
  return [...subject.papers.filter((p) => papers.includes(p.subject_paper_id) || p.subject_paper_id === paperId).map((p) => p.subject_paper_id)]
}

/** The same rules the API enforces, said before the request goes out. */
function firstProblem(setup: ExamSetup, chosen: Chosen): string | null {
  if (!Object.values(chosen).some((papers) => papers.length > 0)) return 'Choose at least one subject.'

  for (const subject of setup.subjects) {
    const papers = chosen[subject.level_subject_id] ?? []
    if (papers.length === 0) continue
    if (subject.aggregation_rule === 'single' && papers.length > 1) {
      return `${subject.name} is a one-paper subject, so this exam can set only one of its papers.`
    }
  }

  return null
}

function SubjectsCard({ exam, setup }: { exam: Exam; setup: ExamSetup }) {
  const { chooseSubjects } = useExamSetupMutations(exam.id)
  const levels = useLevels()
  const [chosen, setChosen] = useState<Chosen>(() => chosenFrom(setup))
  const [baseline, setBaseline] = useState(setup)
  if (baseline !== setup) {
    setBaseline(setup)
    setChosen(chosenFrom(setup))
  }
  const dirty = JSON.stringify(chosen) !== JSON.stringify(chosenFrom(setup))
  const byLevel = new Map<number, ExamSetup['subjects']>()
  for (const subject of setup.subjects) byLevel.set(subject.level_id, [...(byLevel.get(subject.level_id) ?? []), subject])

  const problem = firstProblem(setup, chosen)

  async function save() {
    try {
      await chooseSubjects.mutateAsync(
        setup.subjects
          .filter((subject) => chosen[subject.level_subject_id]?.length)
          .map((subject) => ({
            level_subject_id: subject.level_subject_id,
            papers: chosen[subject.level_subject_id].map((paperId) => ({
              subject_paper_id: paperId,
              max_marks: subject.papers.find((p) => p.subject_paper_id === paperId)?.max_marks ?? null,
            })),
          })),
      )
      toast.success('Subjects saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the subjects.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subjects and papers</CardTitle>
        <CardDescription>
          {setup.uses_defaults && setup.editable
            ? 'Every active subject at these classes’ levels is examined, with all of its papers, unless you choose otherwise.'
            : 'What this exam examines. Papers are chosen per exam, so this exam can set fewer papers than the subject allows.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {setup.subjects.length === 0 && (
          <p className="text-sm text-muted-foreground">No subjects are set up for the levels of this exam’s classes. Add them under School set-up → Subjects.</p>
        )}
        {[...byLevel.entries()].map(([levelId, subjects]) => (
          <div key={levelId} className="grid gap-2">
            {byLevel.size > 1 && <div className="text-sm font-medium">{levels.data?.find((l) => l.id === levelId)?.name}</div>}
            <ul className="divide-y rounded-lg border">
              {subjects.map((subject) => {
                const papers = chosen[subject.level_subject_id] ?? []
                const examined = papers.length > 0

                return (
                  <li key={subject.level_subject_id} className="grid gap-2 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <Checkbox
                        aria-label={`Examine ${subject.name}`}
                        disabled={!setup.editable}
                        checked={examined}
                        onCheckedChange={(checked) =>
                          setChosen((current) => ({
                            ...current,
                            [subject.level_subject_id]: checked ? defaultPapers(subject) : [],
                          }))
                        }
                      />
                      <span className="min-w-40 flex-1">
                        {subject.name} <span className="text-xs text-muted-foreground">{subject.code}</span>
                        {!subject.is_active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                      </span>
                      {!examined && (
                        <span className="text-xs text-muted-foreground">
                          {subject.papers.map((p) => p.name).join(' · ')}
                        </span>
                      )}
                    </div>

                    {examined && (
                      <div className="ml-7 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {subject.papers.map((paper) => {
                          const on = papers.includes(paper.subject_paper_id)
                          const only = subject.papers.length === 1

                          return (
                            <label key={paper.subject_paper_id} className="flex items-center gap-2 text-xs">
                              <Checkbox
                                aria-label={`${subject.name}: ${paper.name}`}
                                disabled={!setup.editable || only}
                                checked={on}
                                onCheckedChange={(checked) =>
                                  setChosen((current) => ({
                                    ...current,
                                    [subject.level_subject_id]: togglePaper(current[subject.level_subject_id] ?? [], subject, paper.subject_paper_id, !!checked),
                                  }))
                                }
                              />
                              <span className={on ? '' : 'text-muted-foreground'}>
                                {paper.name} <span className="text-muted-foreground">/{formatScore(paper.max_marks ?? paper.default_max_marks ?? 100)}</span>
                              </span>
                            </label>
                          )
                        })}
                        {subject.papers.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {papers.length} of {subject.papers.length} papers · {subject.aggregation_rule_label.toLowerCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {problem && <p className="text-xs text-destructive">{problem}</p>}
        {setup.editable && (
          <p className="text-xs text-muted-foreground">
            Marks-out-of come from the subject’s set-up; change one for this exam from its marksheet, once marking is open.
          </p>
        )}
        {!setup.editable && exam.status !== 'draft' && (
          <p className="text-xs text-muted-foreground">Change marks-out-of for a paper from its marksheet, before marking is locked.</p>
        )}
      </CardContent>
      {setup.editable && setup.subjects.length > 0 && (
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" disabled={!dirty || chooseSubjects.isPending} onClick={() => setChosen(chosenFrom(setup))}>
            Discard
          </Button>
          <Button disabled={!dirty || !!problem || chooseSubjects.isPending} onClick={() => void save()}>
            {chooseSubjects.isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            Save subjects
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- delete

function DeleteCard({ exam }: { exam: Exam }) {
  const navigate = useNavigate()
  const { deleteExam } = useExamSetupMutations(exam.id)

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Delete this draft</CardTitle>
        <CardDescription>Only drafts with no marks, remarks or fee balances can be deleted.</CardDescription>
      </CardHeader>
      <CardFooter>
        <ConfirmDialog
          trigger={
            <Button variant="destructive">
              <Trash2Icon /> Delete exam
            </Button>
          }
          title={`Delete "${exam.name}"?`}
          description="The exam and its class and subject choices are removed. This cannot be undone."
          confirmLabel="Delete exam"
          destructive
          onConfirm={async () => {
            await deleteExam.mutateAsync()
            toast.success(`${exam.name} deleted.`)
            navigate('/exams', { replace: true })
          }}
        />
      </CardFooter>
    </Card>
  )
}
