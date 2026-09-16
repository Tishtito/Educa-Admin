import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeftIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Field } from '@/components/data/Field'
import { PageHeader } from '@/components/data/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAcademicYears, useClasses, useLevels } from '@/features/reference/api'
import { ApiError, errorMessage } from '@/lib/api/errors'
import type { ExamType } from '@/lib/api/types'
import { useCreateExam, type CreateExamInput } from '../api'

const examTypes: { value: ExamType; label: string }[] = [
  { value: 'opener', label: 'Opener' },
  { value: 'midterm', label: 'Mid-Term' },
  { value: 'endterm', label: 'End-Term' },
  { value: 'cat', label: 'CAT' },
  { value: 'weekly', label: 'Weekly test' },
  { value: 'mock', label: 'Mock' },
  { value: 'other', label: 'Other' },
]

const NONE = 'none'

const schema = z
  .object({
    academic_year_id: z.string().min(1, 'Choose the academic year'),
    term_id: z.string(),
    level_id: z.string(),
    exam_type: z.string().min(1, 'Choose the exam type'),
    name: z.string().trim().min(1, 'Give the exam a name').max(120, 'At most 120 characters'),
    starts_on: z.string(),
    ends_on: z.string(),
    class_ids: z.array(z.number()).min(1, 'Choose at least one class'),
    mean_policy: z.enum(['complete_students_only', 'all_entered']),
    tie_policy: z.enum(['competition', 'dense']),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, {
    path: ['ends_on'],
    message: 'The exam cannot end before it starts',
  })

type Values = z.infer<typeof schema>

export function ExamCreatePage() {
  const navigate = useNavigate()
  const years = useAcademicYears()
  const levels = useLevels()
  const create = useCreateExam()
  const [nameTouched, setNameTouched] = useState(false)

  const currentYear = years.data?.find((y) => y.is_current) ?? years.data?.[0]
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      academic_year_id: currentYear ? String(currentYear.id) : '',
      term_id: currentYear?.terms.find((t) => t.is_current)?.id.toString() ?? NONE,
      level_id: NONE,
      exam_type: '',
      name: '',
      starts_on: '',
      ends_on: '',
      class_ids: [],
      mean_policy: 'complete_students_only',
      tie_policy: 'competition',
    },
    resetOptions: { keepDirtyValues: true },
  })

  const [yearId, termId, levelId, examType, classIds, meanPolicy, tiePolicy] = useWatch({
    control: form.control,
    name: ['academic_year_id', 'term_id', 'level_id', 'exam_type', 'class_ids', 'mean_policy', 'tie_policy'],
  })
  const year = years.data?.find((y) => String(y.id) === yearId)
  const classes = useClasses({ active: true, level_id: levelId === NONE ? undefined : Number(levelId) })

  // Suggest "Term 1 Mid-Term" until the admin types a name of their own.
  function suggestName(next: { yearId?: string; termId?: string; examType?: string }) {
    if (nameTouched) return
    const y = years.data?.find((item) => String(item.id) === (next.yearId ?? yearId))
    const term = y?.terms.find((t) => String(t.id) === (next.termId ?? termId))
    const type = examTypes.find((t) => t.value === (next.examType ?? examType))
    const suggestion = [term?.name, type?.label].filter(Boolean).join(' ')
    if (suggestion) form.setValue('name', suggestion, { shouldValidate: form.formState.isSubmitted, shouldDirty: true })
  }

  async function onSubmit(values: Values) {
    const input: CreateExamInput = {
      academic_year_id: Number(values.academic_year_id),
      term_id: values.term_id === NONE ? null : Number(values.term_id),
      level_id: values.level_id === NONE ? null : Number(values.level_id),
      name: values.name,
      exam_type: values.exam_type as ExamType,
      starts_on: values.starts_on || null,
      ends_on: values.ends_on || null,
      class_ids: values.class_ids,
      mean_policy: values.mean_policy,
      tie_policy: values.tie_policy,
    }
    try {
      const exam = await create.mutateAsync(input)
      toast.success(`${exam.name} created as a draft.`)
      navigate(`/exams/${exam.id}`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const field = key.startsWith('class_ids') ? 'class_ids' : key
          form.setError(field as keyof Values, { message: messages[0] })
        }
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  const { errors, isSubmitting } = form.formState
  const allClassIds = classes.data?.map((c) => c.id) ?? []
  const allSelected = allClassIds.length > 0 && allClassIds.every((id) => classIds.includes(id))

  return (
    <>
      <Link to="/exams" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-3.5" /> Exams
      </Link>
      <PageHeader title="New exam" description="The exam starts as a draft. Nothing is visible to examiners until you open it and start marking." />

      {years.data && years.data.length === 0 && (
        <Alert className="mb-4">
          <AlertDescription>This school has no academic year yet. An academic year is needed before exams can be created.</AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">When and what</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Academic year" error={errors.academic_year_id?.message}>
              <Select
                value={yearId}
                onValueChange={(v) => {
                  form.setValue('academic_year_id', v, { shouldValidate: true, shouldDirty: true })
                  form.setValue('term_id', NONE, { shouldDirty: true })
                  suggestName({ yearId: v, termId: NONE })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a year" />
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
            </Field>

            <Field label="Term" hint="Needed for term report cards." error={errors.term_id?.message}>
              <Select value={termId} onValueChange={(v) => {
                  form.setValue('term_id', v, { shouldDirty: true })
                  suggestName({ termId: v })
                }}>
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

            <Field label="Exam type" error={errors.exam_type?.message}>
              <Select value={examType} onValueChange={(v) => {
                  form.setValue('exam_type', v, { shouldValidate: true, shouldDirty: true })
                  suggestName({ examType: v })
                }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Name" htmlFor="name" error={errors.name?.message}>
              <Input
                id="name"
                {...form.register('name', { onChange: () => setNameTouched(true) })}
                placeholder="e.g. Term 1 Mid-Term"
              />
            </Field>

            <Field label="Starts" htmlFor="starts_on">
              <Input id="starts_on" type="date" {...form.register('starts_on')} />
            </Field>
            <Field label="Ends" htmlFor="ends_on" error={errors.ends_on?.message}>
              <Input id="ends_on" type="date" {...form.register('ends_on')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classes</CardTitle>
            <CardDescription>Classes cannot be changed once the exam is opened.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Level" className="grid max-w-xs gap-1.5">
              <Select
                value={levelId}
                onValueChange={(v) => {
                  form.setValue('level_id', v, { shouldDirty: true })
                  form.setValue('class_ids', [], { shouldDirty: true })
                }}
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

            {classes.data && classes.data.length > 0 ? (
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      form.setValue('class_ids', checked ? allClassIds : [], { shouldValidate: true, shouldDirty: true })
                    }
                  />
                  Select all ({allClassIds.length})
                </label>
                <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {classes.data.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={classIds.includes(item.id)}
                        onCheckedChange={(checked) =>
                          form.setValue(
                            'class_ids',
                            checked ? [...classIds, item.id] : classIds.filter((id) => id !== item.id),
                            { shouldValidate: true, shouldDirty: true },
                          )
                        }
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{classes.isPending ? 'Loading classes…' : 'No active classes at this level.'}</p>
            )}
            {errors.class_ids?.message && <p className="text-xs text-destructive">{errors.class_ids.message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking</CardTitle>
            <CardDescription>The defaults suit most schools.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Class means include">
              <Select
                value={meanPolicy}
                onValueChange={(v) => form.setValue('mean_policy', v as Values['mean_policy'], { shouldDirty: true })}
              >
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
              <Select
                value={tiePolicy}
                onValueChange={(v) => form.setValue('tie_policy', v as Values['tie_policy'], { shouldDirty: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competition">Share a position, skip the next (1, 1, 3)</SelectItem>
                  <SelectItem value="dense">Share a position, no gap (1, 1, 2)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" asChild>
            <Link to="/exams">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Create draft
          </Button>
        </div>
      </form>
    </>
  )
}
