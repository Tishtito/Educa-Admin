import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarPlusIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/data/ConfirmDialog'
import { Field } from '@/components/data/Field'
import { FormDialog } from '@/components/data/FormDialog'
import { PageHeader } from '@/components/data/PageHeader'
import { EmptyState, QueryState } from '@/components/data/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAcademicYears } from '@/features/reference/api'
import type { AcademicYear, Term } from '@/lib/api/types'
import { formatDate, formatMoney } from '@/lib/format'
import { numberOrNull, showFormError } from '@/lib/forms'
import { useCalendarMutations } from '../api'

export function CalendarPage() {
  const years = useAcademicYears()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Academic calendar"
        description="Years and terms. Report cards print the term's closing date, next opening date and feeding fee from here."
        actions={
          <Button onClick={() => setCreating(true)}>
            <CalendarPlusIcon /> New academic year
          </Button>
        }
      />
      <QueryState query={years}>
        {(data) =>
          data.length === 0 ? (
            <EmptyState
              title="No academic years yet"
              description="Create the current year to start adding exams and enrolling pupils."
              action={<Button onClick={() => setCreating(true)}>New academic year</Button>}
            />
          ) : (
            <div className="grid gap-4">
              {data.map((year) => (
                <YearCard key={year.id} year={year} />
              ))}
            </div>
          )
        }
      </QueryState>
      {creating && <YearDialog open onOpenChange={setCreating} suggestedName={suggestNextYear(years.data)} />}
    </>
  )
}

function suggestNextYear(years: AcademicYear[] | undefined): string {
  const latest = Math.max(0, ...(years ?? []).map((y) => Number.parseInt(y.name, 10)).filter(Number.isFinite))
  return String(latest ? latest + 1 : new Date().getFullYear())
}

function YearCard({ year }: { year: AcademicYear }) {
  const { makeYearCurrent, deleteYear, makeTermCurrent } = useCalendarMutations()
  const [editingYear, setEditingYear] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [addingTerm, setAddingTerm] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const nextTermNumber = Math.max(0, ...year.terms.map((t) => t.term_number)) + 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {year.name}
          {year.is_current && <Badge>Current</Badge>}
        </CardTitle>
        <CardDescription>
          {formatDate(year.starts_on)} – {formatDate(year.ends_on)}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${year.name}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditingYear(true)}>
                <PencilIcon /> Edit year
              </DropdownMenuItem>
              {!year.is_current && (
                <DropdownMenuItem
                  onSelect={() => makeYearCurrent.mutate(year.id, { onSuccess: () => toast.success(`${year.name} is now the current year.`) })}
                >
                  <StarIcon /> Make current
                </DropdownMenuItem>
              )}
              {nextTermNumber <= 4 && (
                <DropdownMenuItem onSelect={() => setAddingTerm(true)}>
                  <PlusIcon /> Add term {nextTermNumber}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                <Trash2Icon /> Delete year
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={`Delete ${year.name}?`}
            description="Only a year with no exams, enrolments or assignments can be deleted. Its terms are deleted with it."
            confirmLabel="Delete"
            destructive
            onConfirm={() => deleteYear.mutateAsync(year.id).then(() => toast.success(`${year.name} deleted.`))}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Opens</TableHead>
              <TableHead>Closes</TableHead>
              <TableHead className="text-right">Feeding fee</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {year.terms.map((term) => (
              <TableRow key={term.id}>
                <TableCell className="font-medium">
                  {term.name} {term.is_current && <Badge variant="secondary">Current</Badge>}
                </TableCell>
                <TableCell>{formatDate(term.starts_on)}</TableCell>
                <TableCell>{formatDate(term.ends_on)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(term.feeding_fee)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {!term.is_current && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Make current term"
                      aria-label={`Make ${term.name} current`}
                      onClick={() =>
                        makeTermCurrent.mutate(term.id, { onSuccess: () => toast.success(`${term.name} ${year.name} is now the current term.`) })
                      }
                    >
                      <StarIcon />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${term.name}`} onClick={() => setEditingTerm(term)}>
                    <PencilIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {year.terms.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No terms.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {editingYear && <YearDialog open onOpenChange={setEditingYear} year={year} />}
      {editingTerm && <TermDialog open onOpenChange={() => setEditingTerm(null)} term={editingTerm} yearId={year.id} />}
      {addingTerm && <TermDialog open onOpenChange={setAddingTerm} yearId={year.id} termNumber={nextTermNumber} />}
    </Card>
  )
}

// ------------------------------------------------------------------ year

const yearSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the year, e.g. 2027').max(20),
    starts_on: z.string().min(1, 'When does the year start?'),
    ends_on: z.string().min(1, 'When does the year end?'),
    make_current: z.boolean(),
  })
  .refine((v) => v.ends_on > v.starts_on, { path: ['ends_on'], message: 'The year must end after it starts' })

type YearValues = z.infer<typeof yearSchema>

function YearDialog({
  open,
  onOpenChange,
  year,
  suggestedName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year?: AcademicYear
  suggestedName?: string
}) {
  const { createYear, updateYear } = useCalendarMutations()
  const name = year?.name ?? suggestedName ?? ''
  const form = useForm<YearValues>({
    resolver: zodResolver(yearSchema),
    defaultValues: {
      name,
      starts_on: year?.starts_on ?? (/^\d{4}$/.test(name) ? `${name}-01-05` : ''),
      ends_on: year?.ends_on ?? (/^\d{4}$/.test(name) ? `${name}-11-27` : ''),
      make_current: false,
    },
  })
  const { errors, isSubmitting } = form.formState
  const makeCurrent = useWatch({ control: form.control, name: 'make_current' })

  async function submit(values: YearValues) {
    try {
      if (year) {
        await updateYear.mutateAsync({ id: year.id, name: values.name, starts_on: values.starts_on, ends_on: values.ends_on })
        toast.success('Academic year updated.')
      } else {
        await createYear.mutateAsync(values)
        toast.success(`${values.name} created with three terms. Add their dates next.`)
      }
      onOpenChange(false)
    } catch (error) {
      showFormError(form, error, ['name', 'starts_on', 'ends_on'])
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={year ? `Edit ${year.name}` : 'New academic year'}
      description={year ? undefined : 'Terms 1, 2 and 3 are created with it. You can set their dates afterwards.'}
      submitLabel={year ? 'Save' : 'Create year'}
      busy={isSubmitting}
      onSubmit={form.handleSubmit(submit)}
    >
      <Field label="Name" htmlFor="year-name" error={errors.name?.message}>
        <Input id="year-name" {...form.register('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="year-start" error={errors.starts_on?.message}>
          <Input id="year-start" type="date" {...form.register('starts_on')} />
        </Field>
        <Field label="Ends" htmlFor="year-end" error={errors.ends_on?.message}>
          <Input id="year-end" type="date" {...form.register('ends_on')} />
        </Field>
      </div>
      {!year && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={makeCurrent} onCheckedChange={(v) => form.setValue('make_current', v === true)} />
          Make this the current year
        </label>
      )}
    </FormDialog>
  )
}

// ------------------------------------------------------------------ term

const termSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the term').max(40),
    starts_on: z.string(),
    ends_on: z.string(),
    feeding_fee: z.string().refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v.trim()), 'Enter an amount, e.g. 3500'),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { path: ['ends_on'], message: 'A term cannot close before it opens' })

type TermValues = z.infer<typeof termSchema>

function TermDialog({
  open,
  onOpenChange,
  term,
  yearId,
  termNumber,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  term?: Term
  yearId: number
  termNumber?: number
}) {
  const { createTerm, updateTerm } = useCalendarMutations()
  const form = useForm<TermValues>({
    resolver: zodResolver(termSchema),
    defaultValues: {
      name: term?.name ?? `Term ${termNumber}`,
      starts_on: term?.starts_on ?? '',
      ends_on: term?.ends_on ?? '',
      feeding_fee: term?.feeding_fee === null || term?.feeding_fee === undefined ? '' : String(term.feeding_fee),
    },
  })
  const { errors, isSubmitting } = form.formState

  async function submit(values: TermValues) {
    const input = {
      name: values.name,
      starts_on: values.starts_on || null,
      ends_on: values.ends_on || null,
      feeding_fee: numberOrNull(values.feeding_fee),
    }
    try {
      if (term) {
        await updateTerm.mutateAsync({ id: term.id, ...input })
      } else {
        await createTerm.mutateAsync({ ...input, academic_year_id: yearId, term_number: termNumber ?? 1 })
      }
      toast.success(`${values.name} saved.`)
      onOpenChange(false)
    } catch (error) {
      showFormError(form, error, ['name', 'starts_on', 'ends_on', 'feeding_fee'])
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={term ? `Edit ${term.name}` : `Add term ${termNumber}`}
      description="Dates and the feeding fee print on report cards issued in this term."
      busy={isSubmitting}
      onSubmit={form.handleSubmit(submit)}
    >
      <Field label="Name" htmlFor="term-name" error={errors.name?.message}>
        <Input id="term-name" {...form.register('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Opens" htmlFor="term-start" error={errors.starts_on?.message}>
          <Input id="term-start" type="date" {...form.register('starts_on')} />
        </Field>
        <Field label="Closes" htmlFor="term-end" error={errors.ends_on?.message}>
          <Input id="term-end" type="date" {...form.register('ends_on')} />
        </Field>
      </div>
      <Field label="Feeding fee (KSh)" htmlFor="term-fee" error={errors.feeding_fee?.message}>
        <Input id="term-fee" inputMode="decimal" {...form.register('feeding_fee')} />
      </Field>
    </FormDialog>
  )
}
